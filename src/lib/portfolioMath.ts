import type { Position } from '@/api/types'
import type { PriceMap } from '@/api/marketData/MarketDataSimulator'
import { optionMark } from '@/lib/optionMath'

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
}

/**
 * Options are quoted per share but traded in 100-share contracts. Everything
 * downstream uses this multiplier so option P/L is not understated by 100x.
 */
export function contractMultiplier(position: Position): number {
  return position.assetType === 'option' ? 100 : 1
}

export function valuePosition(position: Position, prices: PriceMap): PositionValuation {
  const snap = prices[position.symbol]
  const multiplier = contractMultiplier(position)

  // Options are priced from the underlying via the deterministic option model,
  // so a contract's mark and its day change can never contradict the stock.
  let price: number
  let previousClose: number
  if (position.assetType === 'option' && position.option && snap) {
    price = optionMark(position.option, snap.price)
    previousClose = optionMark(position.option, snap.previousClose)
  } else if (position.assetType === 'option' && snap) {
    // Legacy contracts without structured terms: leveraged move on the stock.
    const underlyingMove = snap.price / snap.open - 1
    price = Math.max(0.01, position.avgCost * (1 + underlyingMove * 4.5))
    previousClose = Math.max(
      0.01,
      position.avgCost * (1 + (snap.previousClose / snap.open - 1) * 4.5),
    )
  } else {
    price = snap?.price ?? position.avgCost
    previousClose = snap?.previousClose ?? position.avgCost
  }

  const dayChange = price - previousClose
  const dayChangePct = previousClose > 0 ? (dayChange / previousClose) * 100 : 0
  const marketValue = price * position.quantity * multiplier
  const costBasis = position.avgCost * position.quantity * multiplier
  const totalReturn = marketValue - costBasis

  return {
    position,
    multiplier,
    price,
    underlyingPrice: snap?.price ?? price,
    previousClose,
    dayChange,
    dayChangePct,
    marketValue,
    costBasis,
    totalReturn,
    totalReturnPct: costBasis > 0 ? (totalReturn / costBasis) * 100 : 0,
    dayPl: dayChange * position.quantity * multiplier,
    history: snap?.history ?? [],
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
}

export function computeTotals(positions: Position[], prices: PriceMap): PortfolioTotals {
  const valuations = positions.map((p) => valuePosition(p, prices))
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
  }
}
