import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/cn'

export function DetailStat({
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
      <dt className="text-[10.5px] font-bold tracking-[0.07em] text-ink-muted uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          'num mt-0.5 truncate text-[16px] font-extrabold tracking-[-0.01em]',
          tone === 'up' ? 'text-up' : tone === 'down' ? 'text-down' : tone === 'ai' ? 'text-brand-300' : 'text-ink',
        )}
      >
        {value}
      </dd>
      {hint ? <dd className="num mt-0.5 truncate text-[11.5px] text-ink-muted">{hint}</dd> : null}
    </div>
  )
}

export function NotFound({
  title,
  detail,
  backTo,
  backLabel,
}: {
  title: string
  detail: string
  backTo: string
  backLabel: string
}) {
  return (
    <div className="card mx-auto mt-6 max-w-[440px] px-6 py-12 text-center">
      <h1 className="text-[19px] font-extrabold tracking-[-0.02em] text-ink">{title}</h1>
      <p className="mx-auto mt-2 max-w-[320px] text-[13.5px] leading-relaxed text-ink-soft">
        {detail}
      </p>
      <Link
        to={backTo}
        aria-label={backLabel}
        className="nav-gloss-button mx-auto mt-5 h-9 w-9"
      >
        <ChevronLeft size={17} strokeWidth={2.4} />
      </Link>
    </div>
  )
}
