const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const moneyWhole = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export function formatMoney(value: number, opts?: { whole?: boolean }): string {
  return opts?.whole ? moneyWhole.format(value) : money.format(value)
}

export function formatSignedMoney(value: number): string {
  const sign = value >= 0 ? '+' : '−'
  return `${sign}${money.format(Math.abs(value))}`
}

export function formatPercent(value: number, digits = 2): string {
  return `${value.toFixed(digits)}%`
}

export function formatSignedPercent(value: number, digits = 2): string {
  const sign = value >= 0 ? '+' : '−'
  return `${sign}${Math.abs(value).toFixed(digits)}%`
}

export function formatCompact(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (abs >= 10_000) return `$${(value / 1000).toFixed(1)}K`
  return moneyWhole.format(value)
}

export function formatQty(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(4).replace(/0+$/, '')
}

/**
 * The one glyph for "the backend does not record this".
 *
 * Since APP-113 a live trade plan has no target band, no absolute stop and no
 * expected upside — plt has no field for any of them — so these render an
 * explicit absence rather than a zero, an empty string or a plausible default.
 */
export const MISSING = '—'

export function formatRange(low?: number, high?: number): string {
  if (low === undefined && high === undefined) return MISSING
  if (low === undefined || high === undefined) return money.format((low ?? high)!)
  return `${money.format(low)} – ${money.format(high)}`
}

/** `formatMoney` for a value that may simply not exist. */
export function formatMoneyOr(value: number | undefined, opts?: { whole?: boolean }): string {
  return value === undefined ? MISSING : formatMoney(value, opts)
}

export function relativeTime(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime())
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

/**
 * Upper-cases English month abbreviations inside a contract label, so an
 * expiry always reads `JAN 15 '27`. Applied at the data source rather than at
 * each render site, which keeps the many places that echo `expiryLabel` and
 * `contractDetail` consistent by construction.
 */
export function upperMonth(label: string): string {
  return label.replace(
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\b/g,
    (month) => month.toUpperCase(),
  )
}

/**
 * Render a backend confidence — **a 0..1 fraction** — as a percentage.
 *
 * The wire value stays fractional all the way from `ThesisResponse.confidence`
 * into `ThesisView.confidence`; this is the single place it becomes a
 * percentage for a human (§7.4). The other legal conversion is
 * `convictionFromConfidence()` in the wire scalars, which maps the same
 * fraction into the app's 0–100 conviction domain for `AIAssessment`.
 */
export function formatConfidence(fraction: number, digits = 0): string {
  const clamped = Math.max(0, Math.min(1, fraction))
  return `${(clamped * 100).toFixed(digits)}%`
}

/**
 * Render plt's `time_horizon` / `expected_holding_period`.
 *
 * Both are ISO-8601 durations on the wire (`P14D`, `P2W`, `P3M`). Anything
 * this does not recognise is echoed **verbatim** rather than guessed at: the
 * field is a free string server-side, and a horizon the app cannot parse is
 * still a horizon the model wrote.
 */
export function formatHorizon(value: string): string {
  const match = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/.exec(value.trim().toUpperCase())
  if (!match || match.slice(1).every((part) => part === undefined)) return value
  const units: [string | undefined, string][] = [
    [match[1], 'year'],
    [match[2], 'month'],
    [match[3], 'week'],
    [match[4], 'day'],
  ]
  const parts = units
    .filter(([amount]) => amount !== undefined)
    .map(([amount, unit]) => `${amount} ${unit}${Number(amount) === 1 ? '' : 's'}`)
  return parts.length > 0 ? parts.join(' ') : value
}
