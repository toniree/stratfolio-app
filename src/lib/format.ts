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

export function formatRange(low: number, high: number): string {
  return `${money.format(low)} – ${money.format(high)}`
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
