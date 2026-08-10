import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Shared chrome for every carousel tile: equal height, keyboard activatable,
 * click-anywhere-to-open, with inner buttons free to stop propagation.
 */
export function TileShell({
  children,
  onActivate,
  ariaLabel,
  className,
  accent,
}: {
  children: ReactNode
  onActivate: () => void
  ariaLabel: string
  className?: string
  accent?: 'ai' | 'user'
}) {
  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onActivate()
        }
      }}
      className={cn(
        // glass-flat, not glass: tiles repeat many times inside a scrolling
        // carousel and a backdrop-filter per tile is what makes those rows jank.
        'glass-flat group relative isolate flex h-full cursor-pointer flex-col overflow-hidden rounded-[22px] p-3.5',
        'transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-white/[0.14] hover:shadow-[0_18px_46px_-22px_rgba(0,0,0,0.86),0_12px_30px_-24px_rgba(47,123,255,0.5)]',
        className,
      )}
    >
      <span
        className="pointer-events-none absolute top-0 right-7 left-7 -z-10 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
        aria-hidden
      />
      {accent === 'ai' ? (
        <span className="ai-gradient absolute inset-x-0 top-0 hidden h-[3px] shadow-[0_5px_16px_-7px_rgba(47,123,255,0.9)] lg:block" aria-hidden />
      ) : accent === 'user' ? (
        <span className="absolute inset-x-0 top-0 hidden h-[3px] bg-line-strong lg:block" aria-hidden />
      ) : null}
      {children}
    </div>
  )
}

export function TileStat({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'up' | 'down' | 'ai'
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[9.5px] font-bold tracking-[0.07em] text-ink-muted uppercase">{label}</dt>
      <dd
        className={cn(
          'num mt-0.5 truncate text-[13px] font-bold',
          tone === 'up' ? 'text-up' : tone === 'down' ? 'text-down' : tone === 'ai' ? 'text-brand-300' : 'text-ink',
        )}
      >
        {value}
      </dd>
      {hint ? <dd className="truncate text-[10.5px] text-ink-muted">{hint}</dd> : null}
    </div>
  )
}
