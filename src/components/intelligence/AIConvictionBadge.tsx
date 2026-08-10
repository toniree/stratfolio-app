import { ArrowDown, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/cn'

interface AIConvictionBadgeProps {
  score: number
  delta?: number
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
  showLabel?: boolean
}

/**
 * The single most important AI element in the product — a dark neon-violet
 * treatment reserved exclusively for intelligence scores.
 */
export function AIConvictionBadge({
  score,
  delta,
  size = 'md',
  className,
  showLabel = true,
}: AIConvictionBadgeProps) {
  const sizes = {
    xs: 'h-[18px] gap-px px-1 text-[9px]',
    sm: 'h-6 pl-2 pr-2 text-[11.5px] gap-1',
    md: 'h-7 pl-2.5 pr-2.5 text-[13px] gap-1.5',
    lg: 'h-9 pl-3.5 pr-3.5 text-[15px] gap-2',
  }[size]

  const deltaLabel =
    delta === undefined || delta === 0
      ? null
      : `${delta > 0 ? '▲' : '▼'} ${Math.abs(delta)}`
  const isLargePositiveMove = delta !== undefined && delta >= 20

  return (
    <span
      className={cn(
        'ai-score-neon-purple num inline-flex items-center rounded-full font-bold text-white',
        sizes,
        className,
      )}
      title={`AI conviction ${score} out of 100${deltaLabel ? ` · ${deltaLabel}` : ''}`}
    >
      {showLabel ? (
        <span className="text-[0.78em] font-semibold tracking-[0.08em] text-white">AI</span>
      ) : null}
      <span>
        {score}
        <span className="font-semibold text-[#f2f6ff]">/100</span>
      </span>
      {deltaLabel ? (
        <span
          aria-label={size === 'xs' ? `${delta && delta > 0 ? 'Up' : 'Down'} ${Math.abs(delta ?? 0)}` : undefined}
          className={cn(
            'ml-0.5 rounded-full font-semibold',
            size === 'xs'
              ? 'inline-flex items-center justify-center gap-px px-0.5 py-0 text-[6.75px] leading-none'
              : 'px-1.5 py-px text-[0.78em]',
            // Green matches the BUY recommendation chip so "positive" reads
            // as one colour across the product.
            isLargePositiveMove
              ? 'bg-up/34 text-up ring-1 ring-up/50 shadow-[0_0_9px_rgba(52,211,153,0.42)]'
              : delta && delta > 0
                ? 'bg-up/28 text-up'
                : 'bg-pink-200/34 text-pink-50',
          )}
        >
          {size === 'xs' ? (
            <>
              {delta && delta > 0 ? (
                <ArrowUp size={7.5} strokeWidth={3} aria-hidden />
              ) : (
                <ArrowDown size={7.5} strokeWidth={3} aria-hidden />
              )}
              <span>{Math.abs(delta ?? 0)}</span>
            </>
          ) : (
            deltaLabel
          )}
        </span>
      ) : null}
    </span>
  )
}

/** Compact, non-gradient variant for dense list contexts. */
export function ConvictionChip({ score, className }: { score: number; className?: string }) {
  return (
    <span
      className={cn(
        'ai-score-neon-purple num inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-bold text-[#e8d5ff]',
        className,
      )}
    >
      {score}
      <span className="font-semibold opacity-60">/100</span>
    </span>
  )
}
