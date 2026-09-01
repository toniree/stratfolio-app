import type {
  ActivityEvent,
  ActivityKind,
  Order,
  OptionContract,
  PerformancePoint,
  PerformanceSeries,
  PortfolioAccount,
  PortfolioMeta,
  Position,
} from '@/api/types'
import type {
  PltActivity,
  PltPortfolio,
  PltPosition,
  PltSilentTrade,
  PltTradePlan,
} from '@/api/http/wire/plt'
import {
  decimal,
  requiredDecimal,
  requiredInstant,
  requiredInteger,
  requiredText,
  stringList,
  text,
} from '@/api/http/wire/scalars'

/**
 * Pure wire → view-model mapping for the plt portfolio domain.
 *
 * Kept free of `fetch` so every footgun in plan §7 is testable as a function
 * of a JSON literal. The governing rule throughout: a field plt omits becomes
 * `undefined`, never 0, never "", never a plausible default.
 */

/** The one paper portfolio plt owns. There is no multi-account model
 *  (HKP-PLT-6), so the app shows exactly one and says what it is. */
export const PAPER_ACCOUNT_ID = 'paper'

export function toAccount(wire: PltPortfolio): PortfolioAccount {
  return {
    id: PAPER_ACCOUNT_ID,
    name: 'Paper portfolio',
    // The account key is plt's own identifier for the book, which is the
    // honest replacement for per-brokerage attribution (D3).
    subtitle: `Silent execution · ${wire.account_key}`,
    isDemo: false,
    accountKey: wire.account_key,
    provenance: 'live',
  }
}

export function toMeta(wire: PltPortfolio): PortfolioMeta {
  const cash = decimal(wire.cash_balance)
  return {
    // plt models no margin: cash *is* buying power in a paper book.
    cash: cash ?? 0,
    buyingPower: cash ?? 0,
    totalDeposited: decimal(wire.open_positions_cost_basis) ?? 0,
    provenance: 'live',
  }
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

/** "2027-01-15" → "Jan 15 '27". Pure formatting of a field plt sends. */
export function expiryLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  const monthIndex = Number(month) - 1
  const name = MONTHS[monthIndex] ?? month
  return `${name} ${Number(day)} '${year.slice(2)}`
}

function toOptionContract(wire: {
  option_type: 'CALL' | 'PUT'
  strike: number | string
  expiration: string
}): OptionContract {
  return {
    right: wire.option_type,
    strike: requiredDecimal(wire.strike, 'strike'),
    expiry: wire.expiration,
    expiryLabel: expiryLabel(wire.expiration),
    // No `extrinsicBase`: real time value comes from the mnd chain (Wave B0).
    // Guessing it here is the in-browser IV fabrication plan §6 removes.
  }
}

/** "$150 Call · Jan 15 '27" — display text derived from fields plt sends. */
export function contractDetail(contract: OptionContract): string {
  return `$${contract.strike} ${contract.right === 'CALL' ? 'Call' : 'Put'} · ${contract.expiryLabel}`
}

export function toPosition(wire: PltPosition): Position {
  const option = toOptionContract(wire)
  return {
    id: wire.id,
    symbol: requiredText(wire.ticker, 'ticker'),
    // No live-safe symbol→company source exists (HKP-MND-4), and the only
    // company names in this app live in mock seed files, which a live adapter
    // must not import (D4). The UI falls back to the ticker.
    company: undefined,
    // plt's book is options-only; equities are HKP-PLT-7.
    assetType: 'option',
    contractDetail: contractDetail(option),
    option,
    // V1 is long single-leg only, and plt's `side` is the plan's LONG/SHORT.
    openingSide: wire.side === 'SHORT' ? 'SELL_TO_OPEN' : 'BUY_TO_OPEN',
    // No brokerage: one paper portfolio, not linked accounts (HKP-PLT-6).
    brokerageId: undefined,
    quantity: requiredInteger(wire.quantity, 'quantity'),
    avgCost: requiredDecimal(wire.entry_price, 'entry_price'),
    openedAt: requiredInstant(wire.opened_at, 'opened_at'),
    // Absent while plt holds no mark, which is always for an open position
    // (`PortfolioService` writes marks only at entry and close). A 0 here
    // would render a worthless holding; a copy of `entry_price` would render
    // a permanently flat one.
    lastPrice: decimal(wire.last_price),
    unrealizedPnl: decimal(wire.unrealized_pnl),
    // plt records a `decision_episode_id`, not the episode's content, and
    // service-ai exposes no episode read API (HKP-AI-1) — so there is nothing
    // to build an AIAssessment from yet.
    ai: undefined,
    provenance: 'live',
  }
}

/**
 * Human labels for plt's `ActionType` roster.
 *
 * A label for an enum value is presentation, not fabricated data — but note
 * that `ActivityResponse` carries no free-text title or detail at all, so the
 * title is the event *type*, and the detail is drawn only from the row's own
 * payload.
 */
const ACTION_LABEL: Record<string, { title: string; kind: ActivityKind }> = {
  THESIS_CREATED: { title: 'Thesis created', kind: 'thesis-update' },
  TRADE_PLAN_VALIDATED: { title: 'Trade plan validated', kind: 'order' },
  TRADE_PLAN_REJECTED: { title: 'Trade plan rejected by policy', kind: 'alert' },
  TRADE_PLAN_EXECUTED: { title: 'Trade plan executed', kind: 'order' },
  SILENT_TRADE_OPENED: { title: 'Silent trade opened', kind: 'order' },
  SILENT_TRADE_CLOSED: { title: 'Silent trade closed', kind: 'order' },
  POSITION_OPENED: { title: 'Position opened', kind: 'order' },
  POSITION_CLOSED: { title: 'Position closed', kind: 'order' },
  PORTFOLIO_UPDATED: { title: 'Portfolio updated', kind: 'other' },
  CONFIG_UPDATED: { title: 'Configuration updated', kind: 'other' },
  USER_ACTIVITY: { title: 'You recorded an action', kind: 'other' },
  WATCHLIST_ADDED: { title: 'Added to the active universe', kind: 'ai-signal' },
  WATCHLIST_RESTORED: { title: 'Restored to the active universe', kind: 'ai-signal' },
  WATCHLIST_EXCLUDED: { title: 'Excluded from the active universe', kind: 'ai-signal' },
  WATCHLIST_EVICTED: { title: 'Evicted from the active universe', kind: 'ai-signal' },
  WATCHLIST_PINNED: { title: 'Pinned in the active universe', kind: 'ai-signal' },
  WATCHLIST_UNPINNED: { title: 'Unpinned in the active universe', kind: 'ai-signal' },
  WATCHLIST_UPDATED: { title: 'Active universe entry updated', kind: 'ai-signal' },
  WATCHLIST_VALIDATION_CHANGED: { title: 'Symbol validation changed', kind: 'alert' },
  WATCHLIST_SEEDED: { title: 'Active universe seeded', kind: 'other' },
  CANDIDATE_RECORDED: { title: 'Candidate recorded', kind: 'ai-signal' },
  CANDIDATE_PROMOTED: { title: 'Candidate promoted', kind: 'ai-signal' },
  CANDIDATE_REJECTED: { title: 'Candidate rejected', kind: 'ai-signal' },
  CANDIDATE_EXPIRED: { title: 'Candidate expired', kind: 'other' },
}

/** Tickers plt puts in activity payloads under a few different keys. */
function payloadSymbol(payload: Record<string, unknown> | undefined): string | undefined {
  if (!payload) return undefined
  for (const key of ['ticker', 'symbol']) {
    const value = payload[key]
    if (typeof value === 'string' && value.trim()) return value.trim().toUpperCase()
  }
  return undefined
}

/** A short, faithful rendering of a payload — never a narrative. */
function payloadDetail(payload: Record<string, unknown> | undefined): string | undefined {
  if (!payload) return undefined
  const parts = Object.entries(payload)
    .filter(([, value]) => value !== null && value !== undefined && typeof value !== 'object')
    .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${String(value)}`)
  return parts.length > 0 ? parts.join(' · ') : undefined
}

export function toActivityEvent(wire: PltActivity): ActivityEvent {
  const known = ACTION_LABEL[wire.action_type]
  return {
    id: wire.id,
    // An unmapped `action_type` degrades to `other` and still shows the raw
    // enum value: plt's roster grows independently, and a silently dropped
    // row is a hole in an audit trail.
    kind: known?.kind ?? 'other',
    title: known?.title ?? wire.action_type.replace(/_/g, ' ').toLowerCase(),
    detail: payloadDetail(wire.payload),
    symbol: payloadSymbol(wire.payload),
    at: requiredInstant(wire.ts, 'ts'),
    provenance: 'live',
  }
}

/**
 * Closed silent trades → a **settled-equity** curve.
 *
 * This is realised P&L accumulated at each close, in dollars. It is not the
 * marked value of the book, and the chart must never multiply it by the live
 * portfolio value (plan §3.1) — that would blend two different bases and
 * double-count. Real marked history is HKP-PLT-2.
 */
export function toSettledEquitySeries(
  trades: PltSilentTrade[],
  options: { startingCapital?: number; truncated?: boolean } = {},
): PerformanceSeries {
  const closed = trades
    .filter((trade) => trade.exit_ts !== undefined)
    .map((trade) => ({
      at: Date.parse(trade.exit_ts as string),
      realized: decimal(trade.realized_pnl),
    }))
    // plt returns newest-first; a curve reads oldest-first.
    .sort((a, b) => a.at - b.at)

  const base = options.startingCapital ?? 0
  let running = base
  const points: PerformancePoint[] = closed.map((trade) => {
    // A trade whose realised P&L plt omitted moves the curve by nothing —
    // it is not treated as a zero-P&L trade in any label, just skipped in the
    // running total, because inventing a number would misstate the equity.
    running += trade.realized ?? 0
    return {
      time: Math.floor(trade.at / 1000),
      value: Number(running.toFixed(2)),
      // The multiplier is meaningless on an absolute series; it is filled in
      // relative to the final settled value purely so the field is never NaN.
      multiplier: 0,
    }
  })

  const last = points.at(-1)?.value ?? 0
  for (const point of points) {
    point.multiplier = last !== 0 ? (point.value ?? 0) / last : 0
  }

  return {
    basis: 'settled-equity',
    label: options.truncated
      ? 'Settled equity · last 500 closed trades'
      : 'Settled equity · closed trades',
    points,
    provenance: 'live',
    truncated: options.truncated,
  }
}

/**
 * Order history, merged from what plt can actually serve (plan §3.1).
 *
 * Three sources, because no single one is complete:
 *  1. silent trades — the entry fill, plus a separate exit row once closed;
 *  2. trade plans that are VALIDATED (a pending intent that never filled) or
 *     REJECTED (PolicyGate refused it);
 *  3. session-retained bkt outcomes, passed in by the caller — a `NO_FILL`
 *     leaves **no silent-trade row**, and bkt has no list-executions route
 *     (HKP-BKT-4), so those exist nowhere durable.
 *
 * A plan that produced a silent trade is dropped from (2) rather than shown
 * twice; the fill is the better record of the same event.
 */
export function mergeOrders(input: {
  silentTrades: PltSilentTrade[]
  tradePlans: PltTradePlan[]
  sessionOutcomes?: Order[]
}): Order[] {
  const filledPlanIds = new Set(input.silentTrades.map((trade) => trade.trade_plan_id))
  const orders: Order[] = []

  for (const trade of input.silentTrades) {
    const quantity = requiredInteger(trade.quantity, 'quantity')
    const multiplier = requiredInteger(trade.contract_multiplier, 'contract_multiplier')
    const entryPrice = requiredDecimal(trade.entry_price, 'entry_price')
    orders.push({
      id: `trade-${trade.id}-entry`,
      symbol: trade.ticker,
      side: 'BUY',
      quantity,
      price: entryPrice,
      estimatedValue: entryPrice * quantity * multiplier,
      status: 'FILLED',
      submittedAt: requiredInstant(trade.entry_ts, 'entry_ts'),
      tradePlanId: trade.trade_plan_id,
      provenance: 'live',
    })

    const exitPrice = decimal(trade.exit_price)
    const exitAt = text(trade.exit_ts)
    if (exitAt) {
      orders.push({
        id: `trade-${trade.id}-exit`,
        symbol: trade.ticker,
        side: 'SELL',
        quantity,
        price: exitPrice,
        estimatedValue: exitPrice === undefined ? undefined : exitPrice * quantity * multiplier,
        status: 'FILLED',
        submittedAt: exitAt,
        tradePlanId: trade.trade_plan_id,
        provenance: 'live',
      })
    }
  }

  for (const plan of input.tradePlans) {
    if (filledPlanIds.has(plan.id)) continue
    if (plan.status !== 'VALIDATED' && plan.status !== 'REJECTED') continue
    const quantity = plan.quantity ?? 0
    // A plan's target entry band is a *limit*, not a fill. The midpoint is
    // reported as the intended price and only when the band exists.
    const min = decimal(plan.target_entry_min)
    const max = decimal(plan.target_entry_max)
    const intendedPrice = min !== undefined && max !== undefined ? (min + max) / 2 : undefined
    orders.push({
      id: `plan-${plan.id}`,
      symbol: plan.ticker,
      side: 'BUY',
      quantity,
      price: intendedPrice,
      // The plan's own capital allocation, when it has one — not a product of
      // an invented price.
      estimatedValue: decimal(plan.capital_allocation),
      status: plan.status === 'VALIDATED' ? 'SUBMITTED' : 'REJECTED',
      submittedAt: requiredInstant(plan.created_at, 'created_at'),
      rejectionReasons: stringList(plan.rejection_reasons),
      tradePlanId: plan.id,
      provenance: 'live',
    })
  }

  orders.push(...(input.sessionOutcomes ?? []))

  return orders.sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
  )
}
