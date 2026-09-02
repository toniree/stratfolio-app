import type { Position, Provenance } from '@/api/types'
import type { OptionMarkMap, PriceMap } from '@/api/marketData/types'
import { optionMarkKey } from '@/api/http/adapters/market'
import { optionMark } from '@/lib/optionMath'

/**
 * Where a valuation's mark came from (APP-108).
 *
 * - `server-chain` — an mnd chain mid for this exact contract. The only source
 *   that makes unrealized P&L *real*: plt never marks an open position.
 * - `quote`        — a real underlying quote (equities).
 * - `model`        — the in-browser demo option model. Mock mode only.
 * - `entry`        — no quote at all, so the position is held at its entry
 *   price. That is a flat, obviously-wrong P&L rather than an invented one,
 *   and it is labelled `synthetic` so nothing renders it as a real mark.
 */
export type MarkSource = 'server-chain' | 'quote' | 'model' | 'entry'

/** Whether a day change could be computed from two real observations. */
export type DayChangeBasis = 'quote' | 'model' | 'unavailable'

export interface PositionValuation {
  position: Position
  /** 100 for options contracts, 1 otherwise. */
  multiplier: number
  price: number
  /** Price of the underlying stock. For equities this equals `price`. */
  underlyingPrice: number
  previousClose: number
  dayChange: number
  dayChangePct: number
  marketValue: number
  costBasis: number
  totalReturn: number
  totalReturnPct: number
  dayPl: number
  history: number[]
  markSource: MarkSource
  /**
   * `unavailable` when `dayChange` is 0 only because no prior mark exists —
   * a server chain quotes *now*, and the facade exposes no historical chain
   * (`GetChainSnapshotHistory` is deferred with no route). Callers must render
   * "—" rather than a flat 0.00%, which reads as "unchanged" when the truth is
   * "unknown".
   */
  dayChangeBasis: DayChangeBasis
  /** What this valuation is: the weaker of the position's and the mark's. */
  provenance: Provenance
}

/**
 * Options are quoted per share but traded in 100-share contracts. Everything
 * downstream uses this multiplier so option P/L is not understated by 100x.
 */
export function contractMultiplier(position: Position): number {
  return position.assetType === 'option' ? 100 : 1
}

const RANK: Record<Provenance, number> = { live: 3, replay: 2, synthetic: 1, mock: 0 }

function weaker(a: Provenance | undefined, b: Provenance | undefined): Provenance {
  if (!a) return b ?? 'synthetic'
  if (!b) return a
  return RANK[a] <= RANK[b] ? a : b
}

/**
 * Value one position.
 *
 * `marks` is the server chain, keyed by `optionMarkKey()`. When it holds this
 * contract, the mark is real and so is the unrealized P&L — the whole point of
 * Wave B0. Without it the valuation falls back to the demo option model (mock
 * mode) or to the entry price, and says so through `markSource`/`provenance`
 * so no surface can present an estimate as a quote.
 */
export function valuePosition(
  position: Position,
  prices: PriceMap,
  marks: OptionMarkMap = {},
): PositionValuation {
  const snap = prices[position.symbol]
  const multiplier = contractMultiplier(position)

  const mark =
    position.assetType === 'option' && position.option
      ? marks[
          optionMarkKey({
            symbol: position.symbol,
            right: position.option.right,
            strike: position.option.strike,
            expiry: position.option.expiry,
          })
        ]
      : undefined

  let price: number
  let previousClose: number
  let markSource: MarkSource
  let dayChangeBasis: DayChangeBasis

  if (position.assetType === 'option' && position.option) {
    if (mark?.mid !== undefined && mark.mid > 0) {
      // A real contract mid. There is no prior contract mark to compare it
      // with — the historical-chain routes are deferred from the V1 facade —
      // so the day change is *unknown*, not zero.
      price = mark.mid
      previousClose = mark.mid
      markSource = 'server-chain'
      dayChangeBasis = 'unavailable'
    } else if (snap) {
      // Mock mode: the deterministic model, priced off the same underlying at
      // both ends so a contract's day change can never contradict the stock's.
      price = optionMark(position.option, snap.price)
      previousClose = optionMark(position.option, snap.previousClose)
      markSource = 'model'
      dayChangeBasis = 'model'
    } else {
      // No quote and no model: hold it at entry rather than invent a mark.
      price = position.avgCost
      previousClose = position.avgCost
      markSource = 'entry'
      dayChangeBasis = 'unavailable'
    }
  } else if (snap) {
    price = snap.price
    previousClose = snap.previousClose
    markSource = 'quote'
    dayChangeBasis = 'quote'
  } else {
    price = position.avgCost
    previousClose = position.avgCost
    markSource = 'entry'
    dayChangeBasis = 'unavailable'
  }

  const dayChange = price - previousClose
  const dayChangePct = previousClose > 0 ? (dayChange / previousClose) * 100 : 0
  const marketValue = price * position.quantity * multiplier
  const costBasis = position.avgCost * position.quantity * multiplier
  const totalReturn = marketValue - costBasis

  // An entry-priced or model-priced holding is synthetic however real the
  // position record behind it is — the *number on screen* is the claim being
  // made, and it was not observed anywhere.
  const markProvenance: Provenance =
    markSource === 'server-chain'
      ? (mark?.provenance ?? 'synthetic')
      : markSource === 'quote'
        ? (snap?.provenance ?? 'synthetic')
        : markSource === 'model'
          ? (snap?.provenance === 'mock' ? 'mock' : 'synthetic')
          : 'synthetic'

  return {
    position,
    multiplier,
    price,
    underlyingPrice: snap?.price ?? mark?.mid ?? price,
    previousClose,
    dayChange,
    dayChangePct,
    marketValue,
    costBasis,
    totalReturn,
    totalReturnPct: costBasis > 0 ? (totalReturn / costBasis) * 100 : 0,
    dayPl: dayChange * position.quantity * multiplier,
    history: snap?.history ?? [],
    markSource,
    dayChangeBasis,
    provenance: weaker(position.provenance, markProvenance),
  }
}

export interface PortfolioTotals {
  valuations: PositionValuation[]
  marketValue: number
  costBasis: number
  dayPl: number
  dayPlPct: number
  totalReturn: number
  totalReturnPct: number
  /** Largest single holding as a share of total market value, 0–100. */
  topWeightPct: number
  topWeightSymbol: string
  /**
   * Weighted average AI conviction across assessed holdings, 0–100.
   * Undefined when nothing in the book carries an assessment — not 0, which
   * would read as "the model has no conviction" rather than "no data".
   */
  weightedConviction?: number
  /**
   * False when any holding's day change could not be computed from two real
   * observations. `dayPl` is then a partial sum and must render as "—": a
   * book-level day P&L that quietly omits half the positions is worse than no
   * number at all.
   */
  dayPlAvailable: boolean
  /**
   * True when every holding was marked from a real server quote. False means
   * at least one mark is a model or entry-price stand-in, and the marked value
   * carries a `synthetic` tag.
   */
  fullyMarked: boolean
  /** The weakest provenance across the book — what the totals really are. */
  provenance: Provenance
}

export function computeTotals(
  positions: Position[],
  prices: PriceMap,
  marks: OptionMarkMap = {},
): PortfolioTotals {
  const valuations = positions.map((p) => valuePosition(p, prices, marks))
  const marketValue = valuations.reduce((s, v) => s + v.marketValue, 0)
  const costBasis = valuations.reduce((s, v) => s + v.costBasis, 0)
  const dayPl = valuations.reduce((s, v) => s + v.dayPl, 0)
  const totalReturn = marketValue - costBasis

  let topWeightPct = 0
  let topWeightSymbol = '—'
  for (const v of valuations) {
    const weight = marketValue > 0 ? (v.marketValue / marketValue) * 100 : 0
    if (weight > topWeightPct) {
      topWeightPct = weight
      topWeightSymbol = v.position.symbol
    }
  }

  // Weighted over *assessed* value only, and `undefined` when nothing in the
  // book has an assessment. Folding an unassessed position in as 0 conviction
  // would drag the book's average down purely as a side effect of the backend
  // not exposing episode content (HKP-AI-1) — a fabricated zero.
  const assessed = valuations.filter((v) => v.position.ai !== undefined)
  const assessedValue = assessed.reduce((s, v) => s + v.marketValue, 0)
  const weightedConviction =
    assessedValue > 0
      ? assessed.reduce((s, v) => s + (v.position.ai?.conviction ?? 0) * v.marketValue, 0) /
        assessedValue
      : undefined

  const openValue = marketValue - dayPl
  let provenance: Provenance = 'live'
  for (const v of valuations) provenance = weaker(provenance, v.provenance)

  return {
    valuations,
    marketValue,
    costBasis,
    dayPl,
    dayPlPct: openValue > 0 ? (dayPl / openValue) * 100 : 0,
    totalReturn,
    totalReturnPct: costBasis > 0 ? (totalReturn / costBasis) * 100 : 0,
    topWeightPct,
    topWeightSymbol,
    weightedConviction,
    dayPlAvailable: valuations.every((v) => v.dayChangeBasis !== 'unavailable'),
    fullyMarked: valuations.every(
      (v) => v.markSource === 'server-chain' || v.markSource === 'quote',
    ),
    // An empty book makes no claim at all; `live` would be a claim.
    provenance: valuations.length === 0 ? 'synthetic' : provenance,
  }
}
