import type { PortfolioTotals, PositionValuation } from '@/lib/portfolioMath'
import { formatSignedMoney, formatSignedPercent } from '@/lib/format'

/**
 * The one place a day change is turned into something a person reads.
 *
 * A day change needs two real observations: a mark now and a mark at the prior
 * close. For an option marked from the mnd chain there is only the first — the
 * facade exposes no historical chain (`GetChainSnapshotHistory` and
 * `GetHistoricalChain` are deferred from V1 with no route at all), so the
 * position's "yesterday" simply does not exist.
 *
 * `valuePosition()` records that as `dayChangeBasis: 'unavailable'` and leaves
 * the number at 0. Printing that 0 would be the worst possible rendering of
 * it: "+$0.00 (+0.00%)" reads as *unchanged*, a confident factual claim, when
 * the truth is *unknown*. That is a fabricated zero, and §6/D4 forbid it as
 * squarely as an invented price. Everything below renders "—" instead, drops
 * the up/down tint (a green or red number is itself a claim about direction),
 * and carries a tooltip saying why.
 *
 * The same rule applies one level up: a book-level day P&L that quietly omits
 * the holdings it could not measure is a partial sum wearing a whole number's
 * clothes, so `PortfolioTotals.dayPlAvailable` gates the aggregates too.
 */

export const DAY_CHANGE_UNKNOWN = '—'

export const DAY_CHANGE_UNKNOWN_TITLE =
  'No prior mark for this contract: the market data service exposes no historical option chain in V1, so today’s change cannot be measured.'

export const DAY_PL_UNKNOWN_TITLE =
  'At least one holding has no prior mark, so a day P&L for the book would be a partial sum.'

export interface DayChangeView {
  /** False when the figure is unknown rather than flat. */
  available: boolean
  /** Signed money, or "—". */
  money: string
  /** Signed percent, or "—". */
  percent: string
  /** "+$12.40 (+1.20%)", or "—". */
  combined: string
  /** `undefined` when unknown: an unknown value has no direction to colour. */
  tone: 'up' | 'down' | undefined
  /** Tooltip explaining the gap. `undefined` when the figure is real. */
  title: string | undefined
  /** Screen-reader text; never a bare dash. */
  accessible: string
}

function unknown(title: string, label: string): DayChangeView {
  return {
    available: false,
    money: DAY_CHANGE_UNKNOWN,
    percent: DAY_CHANGE_UNKNOWN,
    combined: DAY_CHANGE_UNKNOWN,
    tone: undefined,
    title,
    accessible: `${label} unavailable`,
  }
}

function known(amount: number, pct: number, digits = 2): DayChangeView {
  const money = formatSignedMoney(amount)
  const percent = formatSignedPercent(pct, digits)
  return {
    available: true,
    money,
    percent,
    combined: `${money} (${percent})`,
    tone: amount >= 0 ? 'up' : 'down',
    title: undefined,
    accessible: `${money} (${percent})`,
  }
}

/** One holding's day change: per-share move and its percentage. */
export function dayChangeOf(valuation: PositionValuation, digits = 2): DayChangeView {
  if (valuation.dayChangeBasis === 'unavailable')
    return unknown(DAY_CHANGE_UNKNOWN_TITLE, 'Day change')
  return known(valuation.dayChange, valuation.dayChangePct, digits)
}

/** One holding's day P&L: the same fact scaled by size, so the same gate. */
export function dayPlOf(valuation: PositionValuation, digits = 2): DayChangeView {
  if (valuation.dayChangeBasis === 'unavailable') return unknown(DAY_CHANGE_UNKNOWN_TITLE, 'Day P/L')
  return known(valuation.dayPl, valuation.dayChangePct, digits)
}

/** The book's day P&L, withheld entirely when any holding could not be measured. */
export function dayPlTotal(totals: PortfolioTotals, digits = 2): DayChangeView {
  if (!totals.dayPlAvailable) return unknown(DAY_PL_UNKNOWN_TITLE, 'Day P/L')
  return known(totals.dayPl, totals.dayPlPct, digits)
}

/**
 * A day P&L summed over an arbitrary subset of holdings (a brokerage filter,
 * say). Availability is a property of the subset, not of the whole book.
 */
export function dayPlOver(valuations: PositionValuation[], digits = 2): DayChangeView {
  const available = valuations.every((v) => v.dayChangeBasis !== 'unavailable')
  if (!available) return unknown(DAY_PL_UNKNOWN_TITLE, 'Day P/L')
  const dayPl = valuations.reduce((sum, v) => sum + v.dayPl, 0)
  const openValue = valuations.reduce((sum, v) => sum + v.marketValue, 0) - dayPl
  return known(dayPl, openValue > 0 ? (dayPl / openValue) * 100 : 0, digits)
}

/**
 * Sort key for a day-change column.
 *
 * Unknown sorts to the bottom in both directions rather than to the middle as
 * a 0 would: an unmeasured holding is not a flat one, and letting it rank
 * among the flat ones is the ordering equivalent of printing 0.00%.
 */
export function dayChangeSortKey(valuation: PositionValuation): number {
  return valuation.dayChangeBasis === 'unavailable' ? Number.NEGATIVE_INFINITY : valuation.dayChangePct
}
