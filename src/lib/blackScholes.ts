/**
 * Black–Scholes–Merton, used wherever the app needs to argue about an option
 * rather than merely price one for display.
 *
 * The app's own `optionMath.optionMark` is a deliberately simple model that
 * guarantees a contract's mark can never contradict the underlying. This
 * module is the opposite tool: a textbook pricer whose output is *compared*
 * against that mark to express an edge ("the model says this is 4% cheap"),
 * and whose closed-form greeks and N(d2) drive the probability figures.
 */

/** Annualised risk-free rate assumed across the demo book. */
export const RISK_FREE_RATE = 0.04

export interface BlackScholesInputs {
  /** Spot price of the underlying. */
  spot: number
  strike: number
  /** Time to expiry in years. */
  years: number
  /** Annualised volatility as a decimal, e.g. 0.34 for 34%. */
  volatility: number
  right: 'CALL' | 'PUT'
  rate?: number
}

export interface BlackScholesResult {
  price: number
  delta: number
  gamma: number
  /** Per one full volatility point (0.01), not per 1.00. */
  vega: number
  /** Per calendar day, not per year. */
  theta: number
  /** N(d2) for calls, N(−d2) for puts — risk-neutral probability of ITM. */
  probabilityItm: number
  d1: number
  d2: number
}

export function blackScholes({
  spot,
  strike,
  years,
  volatility,
  right,
  rate = RISK_FREE_RATE,
}: BlackScholesInputs): BlackScholesResult {
  const call = right === 'CALL'

  // At or past expiry the option is worth intrinsic and the greeks collapse;
  // the formulas below divide by √T, so this branch is required, not cosmetic.
  if (years <= 0 || volatility <= 0 || spot <= 0 || strike <= 0) {
    const intrinsic = call ? Math.max(0, spot - strike) : Math.max(0, strike - spot)
    const itm = intrinsic > 0
    return {
      price: intrinsic,
      delta: itm ? (call ? 1 : -1) : 0,
      gamma: 0,
      vega: 0,
      theta: 0,
      probabilityItm: itm ? 1 : 0,
      d1: 0,
      d2: 0,
    }
  }

  const sqrtT = Math.sqrt(years)
  const d1 =
    (Math.log(spot / strike) + (rate + (volatility * volatility) / 2) * years) /
    (volatility * sqrtT)
  const d2 = d1 - volatility * sqrtT
  const discount = Math.exp(-rate * years)
  const nd1 = normalCdf(d1)
  const nd2 = normalCdf(d2)
  const pdf = normalPdf(d1)

  const price = call
    ? spot * nd1 - strike * discount * nd2
    : strike * discount * normalCdf(-d2) - spot * normalCdf(-d1)

  const thetaPerYear = call
    ? -(spot * pdf * volatility) / (2 * sqrtT) - rate * strike * discount * nd2
    : -(spot * pdf * volatility) / (2 * sqrtT) + rate * strike * discount * normalCdf(-d2)

  return {
    price: Math.max(0, price),
    delta: call ? nd1 : nd1 - 1,
    gamma: pdf / (spot * volatility * sqrtT),
    // Quoted per vol point, which is how a trader reads vega.
    vega: (spot * pdf * sqrtT) / 100,
    theta: thetaPerYear / 365,
    probabilityItm: call ? nd2 : normalCdf(-d2),
    d1,
    d2,
  }
}

/**
 * Risk-neutral probability that the underlying finishes beyond `barrier`.
 * Above the barrier for calls, below it for puts.
 */
export function probabilityBeyond({
  spot,
  barrier,
  years,
  volatility,
  right,
  rate = RISK_FREE_RATE,
}: {
  spot: number
  barrier: number
  years: number
  volatility: number
  right: 'CALL' | 'PUT'
  rate?: number
}): number {
  if (years <= 0 || volatility <= 0 || spot <= 0 || barrier <= 0) {
    return (right === 'CALL' ? spot > barrier : spot < barrier) ? 1 : 0
  }
  const sqrtT = Math.sqrt(years)
  const d2 =
    (Math.log(spot / barrier) + (rate - (volatility * volatility) / 2) * years) /
    (volatility * sqrtT)
  return right === 'CALL' ? normalCdf(d2) : normalCdf(-d2)
}

/**
 * Probability the underlying *trades through* a barrier at any point before
 * expiry. Under driftless GBM this is twice the probability of finishing
 * beyond it — the standard reflection-principle approximation traders use.
 */
export function probabilityTouch(args: Parameters<typeof probabilityBeyond>[0]): number {
  return Math.min(1, probabilityBeyond(args) * 2)
}

/** Annualised realised volatility from a close series, as a decimal. */
export function realisedVolatility(closes: number[], periodsPerYear = 252): number {
  const usable = closes.filter((value) => value > 0)
  if (usable.length < 3) return 0

  const returns: number[] = []
  for (let i = 1; i < usable.length; i++) {
    returns.push(Math.log(usable[i] / usable[i - 1]))
  }
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length
  const variance =
    returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1)
  return Math.sqrt(Math.max(variance, 0) * periodsPerYear)
}

/** Abramowitz & Stegun 26.2.17 — accurate to ~7.5e-8, ample for display. */
export function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const poly =
    t *
    (0.319381530 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  const tail = normalPdf(x) * poly
  return x >= 0 ? 1 - tail : tail
}

export function normalPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
}
