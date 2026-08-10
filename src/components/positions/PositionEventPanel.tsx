import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Hammer, ListChecks } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  formatEventTimestamp,
  isPlanEvent,
  type PositionEvent,
} from '@/lib/positionEvents'

/**
 * Replaces the tile's AI note rail while a chart marker is selected: what
 * changed, when, and the execution detail behind it. Stepping and closing
 * live in the header so the rail never grows past the chart beside it.
 */
export function PositionEventPanel({
  event,
  index,
  total,
  onStep,
  trailing,
}: {
  event: PositionEvent
  index: number
  total: number
  onStep: (delta: number) => void
  /** Rendered at the end of the pager row, opposite the stepper. */
  trailing?: ReactNode
}) {
  const plan = isPlanEvent(event.kind)

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex items-center gap-1">
        <StepButton label="Previous event" disabled={total < 2} onClick={() => onStep(-1)}>
          <ChevronLeft size={11} strokeWidth={2.8} />
        </StepButton>
        <span className="num text-[8.5px] font-bold text-ink-muted">
          {index + 1}/{total}
        </span>
        <StepButton label="Next event" disabled={total < 2} onClick={() => onStep(1)}>
          <ChevronRight size={11} strokeWidth={2.8} />
        </StepButton>
        {trailing ? <span className="mr-1 ml-auto shrink-0">{trailing}</span> : null}
      </div>

      <p className="mt-1.5 flex items-center gap-1.5 text-[9px] font-extrabold tracking-[0.08em] text-white uppercase">
        <span
          className={cn(
            'grid h-[16px] w-[16px] shrink-0 place-items-center rounded-full border',
            plan
              ? 'border-[#ca8eff]/60 bg-[#6b2fb0]/35 text-[#d9b3ff]'
              : 'border-amber-300/55 bg-amber-400/20 text-amber-200',
          )}
        >
          {plan ? <ListChecks size={9} strokeWidth={2.6} /> : <Hammer size={9} strokeWidth={2.6} />}
        </span>
        {plan ? 'Plan' : 'Action'}
      </p>

      <p className="mt-1 text-[9.5px] leading-tight font-bold text-white">{event.title}</p>
      <p className="num mt-px text-[7.5px] font-semibold text-ink-muted">
        {formatEventTimestamp(event.time)}
      </p>

      <p className="mt-1 line-clamp-3 text-[9px] leading-[1.3] text-white/85">{event.summary}</p>

      {event.prompt ? (
        <p className="mt-1 line-clamp-2 border-l border-white/25 pl-1.5 text-[8.5px] leading-[1.3] text-[#e6ecf5] italic">
          “{event.prompt}”
        </p>
      ) : null}

      <dl className="mt-1.5 min-h-0 flex-1 overflow-hidden">
        {event.facts.map((fact) => (
          <div
            key={fact.label}
            className="flex items-baseline justify-between gap-1.5 border-b border-line/40 py-[2px] last:border-b-0"
          >
            <dt className="shrink-0 text-[7px] font-bold tracking-[0.06em] text-ink-muted uppercase">
              {fact.label}
            </dt>
            <dd
              className={cn(
                'num truncate text-[8.5px] font-bold text-ink',
                fact.tone === 'up' && 'text-up',
                fact.tone === 'down' && 'text-down',
              )}
            >
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function StepButton({
  children,
  label,
  onClick,
  disabled,
  className,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className={cn(
        'grid h-[17px] w-[17px] shrink-0 place-items-center text-ink-muted transition-colors hover:text-ink disabled:opacity-30',
        className,
      )}
    >
      {children}
    </button>
  )
}
