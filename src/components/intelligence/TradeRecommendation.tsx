import { cn } from '@/lib/cn'
import { formatRange } from '@/lib/format'
import type { Recommendation } from '@/api/types'

const STYLES: Record<Recommendation, { chip: string; label: string }> = {
  BUY: { chip: 'bg-up-soft text-up', label: 'BUY' },
  HOLD: { chip: 'bg-surface-sunken text-ink-soft', label: 'HOLD' },
  TRIM: {
    chip: 'border border-[#c3a64a]/55 bg-[#a98b38] text-[#211a08] shadow-[inset_0_1px_rgba(255,255,255,0.12)]',
    label: 'TRIM',
  },
  REDUCE: { chip: 'bg-down-soft text-down', label: 'REDUCE' },
}

export function RecommendationChip({
  recommendation,
  className,
}: {
  recommendation: Recommendation
  className?: string
}) {
  // Plans and positions persist to localStorage, so a saved demo can still
  // carry a recommendation this build no longer defines (ACCUMULATE, before it
  // was folded into BUY). Narrowing the type does not migrate stored data, so
  // an unknown value falls back rather than crashing the whole tree.
  const style = STYLES[recommendation] ?? STYLES.BUY
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold tracking-[0.06em]',
        style.chip,
        className,
      )}
    >
      {style.label}
    </span>
  )
}

interface TradeRecommendationProps {
  recommendation: Recommendation
  targetLow: number
  targetHigh: number
  note?: string
  className?: string
}

export function TradeRecommendation({
  recommendation,
  targetLow,
  targetHigh,
  note,
  className,
}: TradeRecommendationProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-2.5 gap-y-1.5', className)}>
      <RecommendationChip recommendation={recommendation} />
      <span className="num text-[13px] font-semibold text-ink">
        Target {formatRange(targetLow, targetHigh)}
      </span>
      {note ? (
        <span className="w-full text-[12.5px] leading-snug text-ink-soft sm:w-auto sm:border-l sm:border-line sm:pl-2.5">
          {note}
        </span>
      ) : null}
    </div>
  )
}
