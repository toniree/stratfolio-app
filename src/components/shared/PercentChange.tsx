import { cn } from '@/lib/cn'
import { formatSignedMoney, formatSignedPercent } from '@/lib/format'

export function toneClass(value: number, neutralAtZero = true): string {
  if (value === 0 && neutralAtZero) return 'text-ink-soft'
  return value >= 0 ? 'text-up' : 'text-down'
}

interface PercentChangeProps {
  pct: number
  amount?: number
  className?: string
  /** Show a leading ▲ / ▼ glyph. */
  glyph?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const SIZE: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'text-[12.5px]',
  md: 'text-sm',
  lg: 'text-base',
}

export function PercentChange({
  pct,
  amount,
  className,
  glyph = false,
  size = 'md',
}: PercentChangeProps) {
  const up = pct >= 0
  return (
    <span
      className={cn('num inline-flex items-center gap-1 font-semibold', toneClass(pct), SIZE[size], className)}
    >
      {glyph ? <span aria-hidden>{up ? '▲' : '▼'}</span> : null}
      {amount !== undefined ? <span>{formatSignedMoney(amount)}</span> : null}
      <span>
        {amount !== undefined ? '(' : ''}
        {formatSignedPercent(pct)}
        {amount !== undefined ? ')' : ''}
      </span>
    </span>
  )
}
