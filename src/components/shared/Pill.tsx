import { cn } from '@/lib/cn'

interface PillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
}

export function Pill({ active, className, children, ...props }: PillProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors duration-150',
        active
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-line-strong bg-surface text-ink-soft hover:border-brand-300 hover:text-ink',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function StaticPill({
  className,
  children,
  tone = 'neutral',
}: {
  className?: string
  children: React.ReactNode
  tone?: 'neutral' | 'positive' | 'negative' | 'ai' | 'muted'
}) {
  const tones: Record<string, string> = {
    neutral: 'border-line-strong bg-surface-sunken text-ink-soft',
    positive: 'border-transparent bg-up-soft text-up',
    negative: 'border-transparent bg-down-soft text-down',
    ai: 'border-transparent bg-ai-soft text-brand-300',
    muted: 'border-line bg-surface text-ink-muted',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold tracking-[0.01em]',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
