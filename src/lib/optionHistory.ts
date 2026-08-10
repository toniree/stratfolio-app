import type { OptionContract } from '@/api/types'
import { gaussian, hashString, mulberry32 } from '@/lib/prng'
import { optionMark } from '@/lib/optionMath'

export interface HistoryPoint {
  /** Unix seconds (UTC), midnight-aligned. */
  time: number
  value: number
}

const DAY = 86400

/**
 * A seeded 21-session path for the underlying that *ends* at the live price.
 *
 * Anchoring the last point to the simulator's current price is what keeps the
 * daily history, the live tick and the option mark from ever disagreeing.
 */
export function underlyingHistory(
  symbol: string,
  currentPrice: number,
  sessions = 21,
): HistoryPoint[] {
  const rand = mulberry32(hashString(`${symbol}:history`))
  const steps: number[] = []
  for (let i = 0; i < sessions; i++) {
    steps.push(gaussian(rand) * 0.018 - 0.0015)
  }

  // Walk backwards from the live price so the series terminates exactly there.
  const values: number[] = Array.from({ length: sessions })
  values[sessions - 1] = currentPrice
  for (let i = sessions - 2; i >= 0; i--) {
    values[i] = values[i + 1] / (1 + steps[i + 1])
  }

  const todayMidnight = Math.floor(Date.now() / 1000 / DAY) * DAY
  return values.map((value, i) => ({
    time: todayMidnight - (sessions - 1 - i) * DAY,
    value: Math.round(value * 100) / 100,
  }))
}

/**
 * The contract's own premium history, derived by running the underlying path
 * through the same option model the live mark uses. The option therefore
 * always responds to the underlying rather than wandering independently.
 */
export function optionPremiumHistory(
  contract: OptionContract,
  symbol: string,
  currentUnderlying: number,
  sessions = 21,
): HistoryPoint[] {
  return underlyingHistory(symbol, currentUnderlying, sessions).map((point) => ({
    time: point.time,
    value: optionMark(contract, point.value),
  }))
}
