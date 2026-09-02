import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { formatMoney, formatSignedMoney, formatSignedPercent } from '@/lib/format'
import type { PerformancePeriod } from '@/api/types'
import { Skeleton } from '@/components/ui/Skeleton'

const PERIOD_LABEL: Record<PerformancePeriod, string> = {
  '1D': 'today',
  '1W': 'past week',
  '1M': 'past month',
  '3M': 'past 3 months',
  '1Y': 'past year',
  ALL: 'all time',
}

interface PortfolioHeroProps {
  marketValue: number
  dayPl: number
  dayPlPct: number
  /** False when a holding has no prior mark and the sum would be partial. */
  dayPlAvailable?: boolean
  periodReturn: number
  periodReturnPct: number
  period: PerformancePeriod
  loading?: boolean
}

export function PortfolioHero({
  marketValue,
  dayPl,
  dayPlPct,
  dayPlAvailable = true,
  periodReturn,
  periodReturnPct,
  period,
  loading,
}: PortfolioHeroProps) {
  const flash = useValueFlash(marketValue)

  if (loading) {
    return (
      <div className="space-y-2.5">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-11 w-56" />
        <Skeleton className="h-4 w-64" />
      </div>
    )
  }

  const showPeriod = period !== '1D'

  return (
    <div>
      <div className="text-[12px] font-bold tracking-[0.09em] text-ink-muted uppercase">
        Portfolio value
      </div>
      <div
        className={cn(
          'num mt-1 inline-block text-[38px] leading-none font-extrabold tracking-[-0.03em] text-ink tabular-nums sm:text-[46px]',
          flash,
        )}
      >
        {formatMoney(marketValue)}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        {dayPlAvailable ? (
          <span
            className={cn(
              'num inline-flex items-center gap-1.5 text-[15px] font-bold',
              dayPl >= 0 ? 'text-up' : 'text-down',
            )}
          >
            <span aria-hidden>{dayPl >= 0 ? '▲' : '▼'}</span>
            {formatSignedMoney(dayPl)}
            <span className="font-semibold">({formatSignedPercent(dayPlPct)})</span>
            <span className="font-medium text-ink-muted">today</span>
          </span>
        ) : (
          <span className="num inline-flex items-center gap-1.5 text-[15px] font-bold text-ink-muted">
            —<span className="font-medium">today</span>
          </span>
        )}

        {showPeriod ? (
          <span className="num inline-flex items-center gap-1.5 border-l border-line pl-3 text-[13.5px] font-semibold text-ink-soft">
            <span className={periodReturn >= 0 ? 'text-up' : 'text-down'}>
              {formatSignedMoney(periodReturn)} ({formatSignedPercent(periodReturnPct)})
            </span>
            <span className="text-ink-muted">{PERIOD_LABEL[period]}</span>
          </span>
        ) : null}
      </div>
    </div>
  )
}

/** Brief green/red wash whenever the headline number moves. */
function useValueFlash(value: number): string {
  const previous = useRef(value)
  const [flash, setFlash] = useState('')

  useEffect(() => {
    const diff = value - previous.current
    previous.current = value
    if (Math.abs(diff) < 0.005) return
    const cls = diff > 0 ? 'flash-up' : 'flash-down'
    setFlash(cls)
    const t = setTimeout(() => setFlash(''), 700)
    return () => clearTimeout(t)
  }, [value])

  return flash
}
