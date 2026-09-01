import { MISSING, formatMoney } from '@/lib/format'

/**
 * Rendering rules for backtest evidence (APP-122).
 *
 * One rule, applied everywhere: **a value bkt did not report renders as
 * missing, never as zero** (D4). bkt is scrupulous about the difference — a
 * `null` `no_fill_rate` means nothing was attempted, a `null` `win_rate` beside
 * a real `trade_count` means the bucket was too thin to report one — and a
 * `?? 0` anywhere in this layer would throw all of that away at the last step.
 */

export function money(value: number | undefined): string {
  return value === undefined ? MISSING : formatMoney(value)
}

export function signedMoney(value: number | undefined): string {
  if (value === undefined) return MISSING
  const sign = value >= 0 ? '+' : '−'
  return `${sign}${formatMoney(Math.abs(value))}`
}

/** A backend **fraction** (0..1) as a percentage. Never a silent ×100 of a
 *  value that was already percent points (§7.1/§7.4). */
export function ratioPercent(value: number | undefined, digits = 1): string {
  return value === undefined ? MISSING : `${(value * 100).toFixed(digits)}%`
}

export function signedRatioPercent(value: number | undefined, digits = 1): string {
  if (value === undefined) return MISSING
  const sign = value >= 0 ? '+' : '−'
  return `${sign}${(Math.abs(value) * 100).toFixed(digits)}%`
}

export function decimals(value: number | undefined, digits = 2): string {
  return value === undefined ? MISSING : value.toFixed(digits)
}

export function count(value: number | undefined): string {
  return value === undefined ? MISSING : String(value)
}

/** Human labels for the two selection modes, with the fidelity claim §19.2
 *  attaches to each. `DELTA_BAND` is what an ai submission uses; `NEAREST_DELTA`
 *  is the baseline the random-entry null is expressed in. */
export const SELECTION_LABEL: Record<string, string> = {
  DELTA_BAND: 'DELTA_BAND · strategy-faithful',
  NEAREST_DELTA: 'NEAREST_DELTA · baseline',
  OTM_PCT: 'OTM_PCT · baseline',
}

export const PROTOCOL_LABEL: Record<string, string> = {
  two_quote_band: 'two_quote_band — decide on session t, fill against t+1, band-guarded',
  single_quote_legacy: 'single_quote_legacy — decision and fill share one quote (pre-BKT-020)',
}
