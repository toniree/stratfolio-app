import type { PlanView, PlannerStatus } from '@/api/newsTypes'
import type { PltThesis, PltTradePlan, PltTradePlanStatus } from '@/api/http/wire/plt'
import { decimal, integer, instant, requiredInstant, requiredText, stringList, text } from '@/api/http/wire/scalars'
import { contractLabel } from '@/api/http/adapters/execution'

/**
 * plt `TradePlanResponse` → `PlanView` (APP-113).
 *
 * As with the thesis adapter, the contract is mostly *subtraction*. A trade
 * plan records a contract, an entry price band and **fractional** exits. It
 * records no title, no author, no target band, no absolute stop and no
 * expected upside, so none of those appear here (§3.3) — the screens render an
 * explicit absence instead.
 *
 * The two conversions deliberately not done:
 *  - `profit_target_pct` / `stop_loss_pct` stay fractions (§7.1). 0.35 is +35%,
 *    and treating it as 0.35% is the classic version of this bug.
 *  - `confidence` stays the 0..1 fraction (§7.4).
 */

/**
 * The complete backend status enum, lower-cased.
 *
 * All five, including `CANCELLED` — which the enum defines and no plt service
 * path currently sets (HKP-PLT-4). Handling it now means the day a path does
 * set it, a cancelled plan renders as cancelled instead of falling through to
 * a default.
 */
const STATUS: Record<PltTradePlanStatus, PlannerStatus> = {
  PROPOSED: 'proposed',
  VALIDATED: 'validated',
  REJECTED: 'rejected',
  EXECUTED: 'executed',
  CANCELLED: 'cancelled',
}

export function toPlanStatus(wire: string): PlannerStatus {
  return STATUS[wire as PltTradePlanStatus] ?? 'proposed'
}

/**
 * Join the plan's thesis, when one was fetched.
 *
 * plt's plan carries `thesis_id`, not the thesis. The caller fetches the
 * theses list once and passes a map — never one request per plan (that N+1 is
 * exactly what plan §3.1 rules out for order history).
 */
export function toPlanView(wire: PltTradePlan, thesis?: PltThesis): PlanView {
  const optionType = text(wire.option_type)?.toUpperCase()
  const right = optionType === 'PUT' ? 'PUT' : optionType === 'CALL' ? 'CALL' : undefined
  const strike = decimal(wire.strike)
  const expiration = text(wire.expiration)

  return {
    id: requiredText(wire.id, 'trade_plan.id'),
    // Every live plan is a model plan: nothing in plt marks authorship, and
    // the only plans a user creates here go through the same endpoint.
    source: 'ai',
    symbol: requiredText(wire.ticker, 'trade_plan.ticker').toUpperCase(),
    assetType: 'option',
    contractDetail:
      right && strike !== undefined && expiration
        ? contractLabel(right, strike, expiration)
        : undefined,
    // V1 is long premium only; a PUT plan is a bearish plan.
    direction: right === 'PUT' ? 'SHORT' : 'LONG',
    intent: 'open',
    status: toPlanStatus(wire.status),
    // No title and no author: plt has neither field. `planTitle()` names the
    // plan by its contract at render.
    notes: text(wire.reasoning) ?? thesis?.rationale ?? '',
    maxAmount: decimal(wire.capital_allocation),
    // The one real, server-validated criterion a plan carries: PolicyGate
    // checks the fill against this band (`ENTRY_RANGE_INVALID`).
    entryLow: decimal(wire.target_entry_min),
    entryHigh: decimal(wire.target_entry_max),
    // Fractions, untouched (§7.1).
    profitTargetPct: decimal(wire.profit_target_pct),
    stopLossPct: decimal(wire.stop_loss_pct),
    maxHoldingDays: integer(wire.max_holding_days),
    dteFloor: integer(wire.dte_floor),
    horizon: text(wire.expected_holding_period),
    categories: ['options'],
    // plt's free-text exit conditions. Nothing evaluates them (HKP-XSV-1).
    catalysts: stringList(wire.profit_taking_conditions) ?? [],
    risks: stringList(wire.loss_conditions) ?? stringList(wire.exit_criteria) ?? [],
    createdAt: requiredInstant(wire.created_at, 'trade_plan.created_at'),
    // Verbatim, duplicates included (§7.5).
    rejectionReasons: wire.rejection_reasons,
    thesisId: text(wire.thesis_id),
    // 0..1, formatted at render (§7.4).
    confidence: decimal(wire.confidence),
    optionType: right,
    strike,
    expiration,
    dte: integer(wire.dte),
    quantity: integer(wire.quantity),
    occSymbol: text(wire.occ_symbol_expected),
    decisionEpisodeId: text(wire.decision_episode_id),
    provenance: 'live',
  }
}

/** Newest first. plt's list endpoint promises no ordering. */
export function sortPlansNewestFirst(plans: PlanView[]): PlanView[] {
  return plans
    .slice()
    .sort((a, b) => (instant(b.createdAt) ?? '').localeCompare(instant(a.createdAt) ?? ''))
}
