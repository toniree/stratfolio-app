import { cn } from '@/lib/cn'
import type { PerformancePeriod } from '@/api/types'

const PERIODS: PerformancePeriod[] = ['1D', '1W', '1M', '3M', '1Y', 'ALL']

export function PeriodSelector({
  value,
  onChange,
  positive,
}: {
  value: PerformancePeriod
  onChange: (period: PerformancePeriod) => void
  positive: boolean
}) {
  return (
    <div
      role="tablist"
      aria-label="Performance period"
      className="flex items-center gap-1 overflow-x-auto no-scrollbar"
    >
      {PERIODS.map((period) => {
        const active = period === value
        return (
          <button
            key={period}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(period)}
            className={cn(
              'num shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-bold transition-colors',
              active
                ? positive
                  ? 'bg-up-soft text-up'
                  : 'bg-down-soft text-down'
                : 'text-ink-muted hover:bg-surface-sunken hover:text-ink-soft',
            )}
          >
            {period}
          </button>
        )
      })}
    </div>
  )
}
