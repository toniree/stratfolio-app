import type { Idea } from '@/api/types'
import {
  blackScholes,
  probabilityBeyond,
  probabilityTouch,
  realisedVolatility,
} from '@/lib/blackScholes'
import { daysToExpiry, estimateImpliedVol, estimateLiquidity } from '@/lib/optionMath'
import { hashString, mulberry32 } from '@/lib/prng'

/** Risk budget the sizing suggestion works to, in dollars of max loss. */
const RISK_BUDGET = 3000

const CONTRACT_MULTIPLIER = 100

export interface ThesisAnalytics {
  kind: 'option' | 'equity'
  spot: number
  daysToExpiry: number
  years: number

  /** Implied volatility, in vol points. */
  iv: number
  /** Realised volatility of the underlying, in vol points. */
  hv: number
  /** IV over HV as a percentage; positive means premium is rich. */
  ivPremiumPct: number
  /** Where IV sits in its trailing range, 0–100. */
  ivRank: number

  /** One-sigma move to expiry, as a percentage of spot. */
  expectedMovePct: number
  /** Move required to reach break-even, as a percentage of spot. */
  requiredMovePct: number
  /**
   * Expected move divided by required move. Above 1 means break-even sits
   * inside the distribution the market is already pricing.
   */
  cushion: number

  /** Probability of finishing beyond break-even, 0–100. */
  pop: number
  /** Probability the target trades at any point before expiry, 0–100. */
  probTouchTarget: number

  breakeven: number
  /** Debit paid per share of the contract. */
  debit: number
  /** Premium the thesis targets, per share. */
  targetPremium: number
  contracts: number
  netDebit: number
  maxLoss: number
  targetValue: number
  targetProfit: number
  rMultiple: number
  /** Probability-weighted profit per position, in dollars. */
  expectedValue: number

  delta: number
  gamma: number
  vega: number
  /** Theta per contract per day, in dollars. */
  theta: number
  /** Daily theta as a percentage of the debit. */
  thetaPctOfDebit: number

  /** Black–Scholes fair value per share at current IV. */
  modelValue: number
  /** Model value over the entry debit, as a percentage. Positive is cheap. */
  modelEdgePct: number

  /** Bid–ask spread as a percentage of mid. */
  spreadPct: number
  openInterest: number
  volume: number
}

/**
 * The full quantitative case for a trade thesis.
 *
 * Everything here is derived from the same inputs the tile already renders —
 * the contract, the live underlying, and the idea's entry/target bands — so a
 * figure in the analytics rail can never disagree with the chart beside it.
 * Where the demo has no real market data behind a concept (an IV term
 * structure, an order book), the value is synthesised deterministically from
 * the symbol and labelled as such at the call site.
 */
export function thesisAnalytics(idea: Idea, spot: number, history: number[]): ThesisAnalytics {
  const contract = idea.option
  const debit = midpoint(idea.entryLow, idea.entryHigh)
  const targetPremium = midpoint(idea.targetLow, idea.targetHigh)
  const hv = realisedVolatility(history) * 100

  if (!contract) {
    return equityAnalytics(idea, spot, hv, debit, targetPremium)
  }

  const dte = Math.max(daysToExpiry(contract), 1)
  const years = dte / 365
  const iv = estimateImpliedVol(contract, spot)
  const volatility = iv / 100
  const right = contract.right

  const model = blackScholes({
    spot,
    strike: contract.strike,
    years,
    volatility,
    right,
  })

  // Break-even at expiry, and the underlying level the premium target implies.
  const breakeven =
    right === 'CALL' ? contract.strike + debit : Math.max(0.01, contract.strike - debit)
  const targetUnderlying =
    right === 'CALL'
      ? contract.strike + targetPremium
      : Math.max(0.01, contract.strike - targetPremium)

  const pop =
    probabilityBeyond({ spot, barrier: breakeven, years, volatility, right }) * 100
  const probTouchTarget =
    probabilityTouch({ spot, barrier: targetUnderlying, years, volatility, right }) * 100

  const expectedMovePct = volatility * Math.sqrt(years) * 100
  const requiredMovePct = Math.abs((breakeven - spot) / spot) * 100
  const cushion = requiredMovePct > 0 ? expectedMovePct / requiredMovePct : Infinity

  const contracts = Math.max(1, Math.floor(RISK_BUDGET / Math.max(debit * CONTRACT_MULTIPLIER, 1)))
  const netDebit = debit * CONTRACT_MULTIPLIER * contracts
  const targetValue = targetPremium * CONTRACT_MULTIPLIER * contracts
  const targetProfit = targetValue - netDebit
  const rMultiple = debit > 0 ? (targetPremium - debit) / debit : 0

  // Deliberately conservative: the win case is the target and the loss case is
  // the whole debit, so this understates partial exits rather than flattering
  // the trade.
  const winRate = pop / 100
  const expectedValue = winRate * targetProfit - (1 - winRate) * netDebit

  const theta = model.theta * CONTRACT_MULTIPLIER
  const liquidity = estimateLiquidity(contract, idea.symbol)
  const halfSpread = Math.max(0.01, Math.min(0.18, debit * 0.0075))

  return {
    kind: 'option',
    spot,
    daysToExpiry: dte,
    years,
    iv,
    hv,
    ivPremiumPct: hv > 0 ? (iv / hv - 1) * 100 : 0,
    ivRank: impliedVolRank(idea.symbol, iv),
    expectedMovePct,
    requiredMovePct,
    cushion,
    pop,
    probTouchTarget,
    breakeven,
    debit,
    targetPremium,
    contracts,
    netDebit,
    maxLoss: netDebit,
    targetValue,
    targetProfit,
    rMultiple,
    expectedValue,
    delta: model.delta,
    gamma: model.gamma,
    vega: model.vega,
    theta,
    thetaPctOfDebit: debit > 0 ? (Math.abs(model.theta) / debit) * 100 : 0,
    modelValue: model.price,
    modelEdgePct: debit > 0 ? (model.price / debit - 1) * 100 : 0,
    spreadPct: debit > 0 ? ((halfSpread * 2) / debit) * 100 : 0,
    openInterest: liquidity.openInterest,
    volume: liquidity.volume,
  }
}

/** Shares have no contract to model, so the case reduces to entry vs target. */
function equityAnalytics(
  idea: Idea,
  spot: number,
  hv: number,
  entry: number,
  target: number,
): ThesisAnalytics {
  const stop = idea.ai.downsideRisk > 0 ? idea.ai.downsideRisk : entry * 0.85
  const risk = Math.max(entry - stop, entry * 0.05)
  const reward = Math.max(target - entry, 0)
  const shares = Math.max(1, Math.floor(RISK_BUDGET / Math.max(risk, 1)))
  const years = 0.25
  const volatility = Math.max(hv, 15) / 100
  const pop = probabilityBeyond({ spot, barrier: entry, years, volatility, right: 'CALL' }) * 100

  return {
    kind: 'equity',
    spot,
    daysToExpiry: 90,
    years,
    iv: hv,
    hv,
    ivPremiumPct: 0,
    ivRank: impliedVolRank(idea.symbol, hv),
    expectedMovePct: volatility * Math.sqrt(years) * 100,
    requiredMovePct: Math.abs((entry - spot) / Math.max(spot, 1)) * 100,
    cushion: 1,
    pop,
    probTouchTarget:
      probabilityTouch({ spot, barrier: target, years, volatility, right: 'CALL' }) * 100,
    breakeven: entry,
    debit: entry,
    targetPremium: target,
    contracts: shares,
    netDebit: entry * shares,
    maxLoss: risk * shares,
    targetValue: target * shares,
    targetProfit: reward * shares,
    rMultiple: risk > 0 ? reward / risk : 0,
    expectedValue: (pop / 100) * reward * shares - (1 - pop / 100) * risk * shares,
    delta: 1,
    gamma: 0,
    vega: 0,
    theta: 0,
    thetaPctOfDebit: 0,
    modelValue: entry,
    modelEdgePct: 0,
    spreadPct: 0.05,
    openInterest: 0,
    volume: 0,
  }
}

/**
 * Where current IV sits inside its trailing range.
 *
 * The demo has no IV history to rank against, so the range is synthesised
 * deterministically per symbol and the live IV is placed inside it. The shape
 * of the answer is right — a number a premium buyer reads before choosing a
 * structure — but it is not measured from real data.
 */
function impliedVolRank(symbol: string, iv: number): number {
  const rand = mulberry32(hashString(`${symbol}:iv-range`))
  const floor = iv * (0.55 + rand() * 0.2)
  const ceiling = iv * (1.25 + rand() * 0.55)
  if (ceiling <= floor) return 50
  return clamp(((iv - floor) / (ceiling - floor)) * 100, 1, 99)
}

function midpoint(low: number, high: number): number {
  return (low + high) / 2
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
