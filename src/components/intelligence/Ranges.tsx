import { AlertTriangle, Zap } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatMoney } from '@/lib/format'

interface RangeProps {
  low: number
  high: number
  className?: string
  label?: string
}

export function EntryRange({ low, high, className, label = 'Entry range' }: RangeProps) {
  return (
    <RangeStat label={label} value={`${formatMoney(low)} – ${formatMoney(high)}`} className={className} />
  )
}

export function TargetRange({ low, high, className, label = 'Target range' }: RangeProps) {
  return (
    <RangeStat
      label={label}
      value={`${formatMoney(low)} – ${formatMoney(high)}`}
      className={className}
      tone="up"
    />
  )
}

export function RangeStat({
  label,
  value,
  hint,
  tone,
  className,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'up' | 'down' | 'ai'
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="text-[10.5px] font-bold tracking-[0.07em] text-ink-muted uppercase">
        {label}
      </div>
      <div
        className={cn(
          'num mt-0.5 truncate text-[14.5px] font-bold',
          tone === 'up' ? 'text-up' : tone === 'down' ? 'text-down' : 'text-ink',
        )}
      >
        {value}
      </div>
      {hint ? <div className="mt-0.5 truncate text-[11.5px] text-ink-muted">{hint}</div> : null}
    </div>
  )
}

export function CatalystList({ items, className }: { items: string[]; className?: string }) {
  if (items.length === 0) return null
  return (
    <section className={className}>
      <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold tracking-[0.08em] text-ink-muted uppercase">
        <Zap size={13} className="text-brand-300" />
        Why now?
      </h4>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-ink-soft">
            <span className="ai-gradient mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function RiskFactors({ items, className }: { items: string[]; className?: string }) {
  if (items.length === 0) return null
  return (
    <section className={className}>
      <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold tracking-[0.08em] text-ink-muted uppercase">
        <AlertTriangle size={13} className="text-down" />
        Risk factors
      </h4>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-ink-soft">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-down/45" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
