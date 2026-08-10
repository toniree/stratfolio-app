import { cn } from '@/lib/cn'
import type { ThesisAnalytics } from '@/lib/thesisAnalytics'
import {
  DEFAULT_THESIS_STATS,
  THESIS_STAT_LIMIT,
  thesisStatLine,
} from '@/lib/thesisStats'
import { usePositionTilePreferences } from '@/store/positionTilePreferences'

/**
 * The quant rail beside the setup chart, in the same treatment as the
 * position tile's greeks panel.
 *
 * Which studies appear is the trader's choice; the default five answer, in
 * order: is premium cheap, is it cheap versus realised, what does the model
 * think of this price, what does the trade pay, and what is it worth
 * probability-weighted.
 */
export function ThesisStatsPanel({
  analytics,
  className,
}: {
  analytics: ThesisAnalytics
  className?: string
}) {
  const stored = usePositionTilePreferences((state) => state.thesisStats)
  const selected = stored.length > 0 ? stored.slice(0, THESIS_STAT_LIMIT) : DEFAULT_THESIS_STATS
  const lines = selected.map((id) => thesisStatLine(id, analytics))

  return (
    <dl className={cn('flex min-w-0 flex-col justify-start', className)}>
      {lines.map(({ label, value, tone }) => (
        <div
          key={label}
          className="flex min-w-0 items-baseline justify-between gap-1 border-b border-line/45 py-[3px] last:border-b-0"
        >
          <dt className="-my-[3px] -ml-1.5 w-[44px] shrink-0 self-stretch truncate bg-white/[0.045] py-[4px] pr-1 pl-1.5 text-[7.5px] font-bold tracking-[0.07em] text-ink-muted uppercase">
            {label}
          </dt>
          <dd
            className={cn(
              'num truncate text-[9px] font-medium tracking-[0.005em] text-ink',
              tone === 'up' && 'text-up',
              tone === 'down' && 'text-down',
            )}
          >
            {value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

