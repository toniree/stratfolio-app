import type { OptionContract } from '@/api/types'
import type { OptionMark } from '@/api/marketData/types'
import { hashString, mulberry32 } from '@/lib/prng'

/**
 * The mark for a contract, in preference order (APP-108).
 *
 * 1. **A server chain mid.** When mnd has quoted the contract, that number is
 *    the mark — a real one, and the whole point of Wave B0: plt never marks an
 *    open position (`unrealized_pnl` is 0 until close), so before this the
 *    app's unrealized P&L was an in-browser estimate wearing a real position's
 *    clothes.
 * 2. **The deterministic demo model below**, for mock mode.
 *
 * A live contract carries no `extrinsicBase`, so when the server has no quote
 * the model degrades to pure intrinsic — understated, never invented — and
 * callers label the valuation `synthetic`.
 */
export function optionMark(
  contract: OptionContract,
  underlying: number,
  mark?: OptionMark,
): number {
  // A server mid of 0 is not a mark: it is an unquoted contract.
  if (mark?.mid !== undefined && mark.mid > 0) return mark.mid
  return modelMark(contract, underlying)
}

/**
 * A deliberately simple, fully deterministic option model.
 *
 * Not Black–Scholes — it does not need to be. What it must guarantee is that
 * a contract's mark is a pure function of the live underlying, so a carousel
 * tile and its details page can never print contradictory numbers, and the
 * option's day change is always coherent with the underlying's day change.
 *
 * mark = intrinsic + extrinsic, where extrinsic peaks at the money and decays
 * as the contract moves away from the strike in either direction.
 */
export function modelMark(contract: OptionContract, underlying: number): number {
  const intrinsic =
    contract.right === 'CALL'
      ? Math.max(0, underlying - contract.strike)
      : Math.max(0, contract.strike - underlying)

  // Gaussian decay of time value around the strike. The width scales with the
  // underlying so the curve behaves the same for a $20 and a $700 stock.
  const width = Math.max(underlying * 0.3, 1)
  const gap = (underlying - contract.strike) / width
  // A live contract carries no `extrinsicBase` — real time value comes from
  // the mnd chain (Wave B0), and guessing it in the browser is exactly the
  // IV/OI fabrication plan §6 removes. With none, the mark is pure intrinsic:
  // understated, but not invented.
  const extrinsic = (contract.extrinsicBase ?? 0) * Math.exp(-(gap * gap))

  return Math.max(0.01, Math.round((intrinsic + extrinsic) * 100) / 100)
}

/** Cash-settled breakeven at expiry, per share. */
export function breakeven(contract: OptionContract, premiumPaid: number): number {
  return contract.right === 'CALL'
    ? contract.strike + premiumPaid
    : contract.strike - premiumPaid
}

/**
 * Percentage the strike sits out of the money. Positive means OTM; negative
 * means the contract is already in the money.
 */
export function percentOutOfMoney(contract: OptionContract, underlying: number): number {
  if (underlying <= 0) return 0
  const raw =
    contract.right === 'CALL'
      ? (contract.strike - underlying) / underlying
      : (underlying - contract.strike) / underlying
  return raw * 100
}

/** Numeric delta, estimated from the model's own local slope. */
export function estimateDelta(contract: OptionContract, underlying: number): number {
  const step = Math.max(underlying * 0.005, 0.01)
  const up = modelMark(contract, underlying + step)
  const down = modelMark(contract, underlying - step)
  const delta = (up - down) / (2 * step)
  return Math.max(0, Math.min(1, contract.right === 'CALL' ? delta : -delta))
}

/** Curvature of delta, from the model's own second derivative. */
export function estimateGamma(contract: OptionContract, underlying: number): number {
  const step = Math.max(underlying * 0.01, 0.02)
  const up = estimateDelta(contract, underlying + step)
  const down = estimateDelta(contract, underlying - step)
  return Math.abs(up - down) / (2 * step)
}

/**
 * Premium lost per day. The model's extrinsic value is the whole of time
 * value, so decaying it over the remaining life gives a coherent theta.
 */
export function estimateTheta(contract: OptionContract, underlying: number): number {
  const days = Math.max(1, daysToExpiry(contract))
  const intrinsic =
    contract.right === 'CALL'
      ? Math.max(0, underlying - contract.strike)
      : Math.max(0, contract.strike - underlying)
  const extrinsic = Math.max(0, modelMark(contract, underlying) - intrinsic)
  // Decay accelerates into expiry rather than running down in a straight line.
  return -(extrinsic / days) * (1 + 30 / (days + 30))
}

/** Premium change per 1 vol point, proportional to remaining time value. */
export function estimateVega(contract: OptionContract, underlying: number): number {
  const intrinsic =
    contract.right === 'CALL'
      ? Math.max(0, underlying - contract.strike)
      : Math.max(0, contract.strike - underlying)
  const extrinsic = Math.max(0, modelMark(contract, underlying) - intrinsic)
  return extrinsic * 0.02
}

/**
 * Implied vol backed out of the demo book's own extrinsic base, annualised
 * over the time left. Stands in for a solver against a real vol surface.
 *
 * Returns `undefined` for a contract with no `extrinsicBase` — i.e. every live
 * one. Real IV comes from the mnd chain in Wave B0 (HKP-MND-1); inventing a
 * number here is the in-browser IV fabrication §6 deletes, and a caller that
 * prints "—" is telling the truth.
 */
export function estimateImpliedVol(
  contract: OptionContract,
  underlying: number,
): number | undefined {
  if (underlying <= 0) return 0
  if (contract.extrinsicBase === undefined) return undefined
  const years = Math.max(daysToExpiry(contract), 1) / 365
  // Brenner–Subrahmanyam: atm premium ≈ 0.4 · S · σ · √T
  const iv = contract.extrinsicBase / (0.4 * underlying * Math.sqrt(years))
  return Math.max(0.05, Math.min(3, iv)) * 100
}

/**
 * True when a contract carries the demo book's model terms.
 *
 * `extrinsicBase` exists only on seeded mock contracts — a live contract built
 * from a plt position or an mnd chain has none — so it is the one honest
 * marker of "this contract may be priced by the in-browser model". Every
 * model-derived stat below is gated on it (§6).
 */
export function hasModelTerms(contract: OptionContract): boolean {
  return contract.extrinsicBase !== undefined
}

/**
 * Deterministic session volume and open interest **for the demo book only**.
 *
 * Returns `undefined` for a contract with no `extrinsicBase` — i.e. every live
 * one. Volume and open interest are facts about a real market that a browser
 * cannot know; the seeded PRNG below produces numbers that look exactly like
 * those facts, which is precisely the fabrication §6 removes from live mode.
 * Real volume and OI come from the mnd chain (`OptionQuote`), and a caller
 * without one prints "—".
 */
export function estimateLiquidity(
  contract: OptionContract,
  symbol: string,
): { volume: number; openInterest: number } | undefined {
  if (!hasModelTerms(contract)) return undefined
  const rand = mulberry32(hashString(`${symbol}|${contract.strike}|${contract.expiry}`))
  const openInterest = Math.round(400 + rand() * 24_000)
  const volume = Math.round(openInterest * (0.05 + rand() * 0.35))
  return { volume, openInterest }
}

export function daysToExpiry(contract: OptionContract, now = Date.now()): number {
  // Expiry is a UTC calendar date; Date parses it as UTC midnight.
  return Math.max(0, Math.round((new Date(contract.expiry).getTime() - now) / 86400000))
}

export function moneynessLabel(contract: OptionContract, underlying: number): string {
  const otm = percentOutOfMoney(contract, underlying)
  if (otm > 0.5) return `${otm.toFixed(1)}% OTM`
  if (otm < -0.5) return `${Math.abs(otm).toFixed(1)}% ITM`
  return 'At the money'
}

/** "$120 Call · Nov 20 '26" */
export function contractLabel(contract: OptionContract): string {
  return `$${contract.strike} ${contract.right === 'CALL' ? 'Call' : 'Put'} · ${contract.expiryLabel}`
}

export interface OptionExitEstimate {
  exitLow: number
  exitHigh: number
  profitLow: number
  profitHigh: number
  returnLowPct: number
  returnHighPct: number
}

/** Total position profit across an estimated option-premium exit range. */
export function estimateOptionExit(
  entryPremium: number,
  exitA: number,
  exitB: number,
  contracts: number,
): OptionExitEstimate {
  const exitLow = Math.min(exitA, exitB)
  const exitHigh = Math.max(exitA, exitB)
  const units = contracts * 100
  const costBasis = entryPremium * units
  // Currency shown in the UI should never leak binary floating-point noise.
  const profitLow = roundCurrency((exitLow - entryPremium) * units)
  const profitHigh = roundCurrency((exitHigh - entryPremium) * units)

  return {
    exitLow,
    exitHigh,
    profitLow,
    profitHigh,
    returnLowPct: costBasis > 0 ? (profitLow / costBasis) * 100 : 0,
    returnHighPct: costBasis > 0 ? (profitHigh / costBasis) * 100 : 0,
  }
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}
