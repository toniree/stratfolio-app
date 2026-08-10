import { cn } from '@/lib/cn'
import { formatMoney, formatSignedMoney, formatSignedPercent } from '@/lib/format'

interface SummaryLine {
  label: string
  value: string
  percent?: string
  accessibleValue: string
  tone?: 'up' | 'down'
}

/** Dense three-line portfolio readout that fits inside the mobile top bar. */
export function MobilePortfolioSummary({
  marketValue,
  cash,
  dayPl,
  dayPlPct,
  loading = false,
}: {
  marketValue: number
  cash: number
  dayPl: number
  dayPlPct: number
  loading?: boolean
}) {
  const lines: SummaryLine[] = loading
    ? [
        { label: 'Value', value: '—', accessibleValue: '—' },
        { label: 'P/L', value: '—', accessibleValue: '—' },
        { label: 'Day P/L', value: '—', accessibleValue: '—' },
      ]
    : [
        {
          label: 'Value',
          value: formatMoney(marketValue),
          accessibleValue: formatMoney(marketValue),
        },
        {
          label: 'Cash',
          value: formatMoney(cash),
          accessibleValue: formatMoney(cash),
        },
        {
          label: 'Day P/L',
          // Value and cash carry cents; the day move stays compact so the
          // three lines keep a similar width.
          value: formatSignedCompact(dayPl),
          percent: formatSignedPercent(dayPlPct, 1),
          accessibleValue: `${formatSignedMoney(dayPl)} (${formatSignedPercent(dayPlPct)})`,
          tone: dayPl >= 0 ? 'up' : 'down',
        },
      ]

  return (
    <div
      className="grid w-[129px] shrink-0 gap-px rounded-xl border border-line bg-white/[0.04] px-2 py-1.5 lg:hidden"
      role="status"
      aria-label={lines.map((line) => `${line.label}: ${line.accessibleValue}`).join('. ')}
    >
      {lines.map((line) => (
        <div key={line.label} className="flex min-w-0 items-baseline justify-between gap-1">
          <span className="truncate text-[7.5px] leading-[10px] font-bold tracking-[0.04em] text-ink-muted uppercase">
            {line.label}
          </span>
          {/* Medium weight, not extrabold: full-precision figures need to stay
              legible at 9px rather than turn into a dense block. */}
          <span
            className={cn(
              'num flex shrink-0 items-baseline gap-1 text-[9px] leading-[10px] font-medium tracking-[0.005em]',
              line.tone === 'up' ? 'text-up' : line.tone === 'down' ? 'text-down' : 'text-white',
            )}
          >
            <span>{line.value}</span>
            {line.percent ? <span>{line.percent}</span> : null}
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * Thousands collapse to K here. The shared `formatCompact` only does so from
 * 10,000, which would leave this line much wider than the two above it.
 */
function formatSignedCompact(value: number): string {
  const abs = Math.abs(value)
  const sign = value >= 0 ? '+' : '−'
  const magnitude =
    abs >= 1000 ? `$${(abs / 1000).toFixed(1)}K` : formatMoney(abs, { whole: true })
  return `${sign}${magnitude}`
}
