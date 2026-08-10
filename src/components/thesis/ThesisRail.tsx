import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import type { Idea } from '@/api/types'
import type { ThesisAnalytics } from '@/lib/thesisAnalytics'
import { AIConvictionBadge } from '@/components/intelligence/AIConvictionBadge'

export interface ThesisPage {
  label: string
  bullets: string[]
}

/**
 * The four questions a professional asks in order before taking someone
 * else's idea: what is the claim, where is the edge, what makes it move, and
 * what proves me wrong.
 */
export function thesisPages(idea: Idea, a: ThesisAnalytics): ThesisPage[] {
  const cheap = a.ivPremiumPct < 0
  const insideCone = a.cushion >= 1

  return [
    {
      label: 'Thesis',
      bullets: [idea.ai.recommendationNote, ...idea.ai.thesis].filter(Boolean).slice(0, 3),
    },
    {
      label: 'Edge',
      bullets: [
        `IV ${a.iv.toFixed(0)} vs HV ${a.hv.toFixed(0)} — premium is ${cheap ? 'cheap' : 'rich'} by ${Math.abs(a.ivPremiumPct).toFixed(0)}%.`,
        `Needs ${a.requiredMovePct.toFixed(1)}% against a ±${a.expectedMovePct.toFixed(1)}% expected move${insideCone ? ' — inside the cone.' : ' — beyond the cone.'}`,
        `Model marks it at ${a.modelValue.toFixed(2)} against ${a.debit.toFixed(2)} paid.`,
      ],
    },
    {
      label: 'Catalyst',
      bullets: idea.catalysts.slice(0, 2).concat(`${a.daysToExpiry} days to expiry.`),
    },
    {
      label: 'Invalidation',
      bullets: idea.risks
        .slice(0, 2)
        .concat(`Break-even ${a.breakeven.toFixed(2)}; full debit at risk below the strike.`),
    },
  ]
}

/**
 * Mirrors the position tile's notes rail: one pager in a fixed-width column,
 * stepper on top, the recommendation chip riding the same row.
 *
 * The rail is clamped to the height of the charts beside it so a long thesis
 * cannot stretch the tile and leave the charts floating above dead space.
 * Whether that clamp actually bites is measured per page rather than assumed
 * from a line count — bullet lengths vary far too much to guess.
 */
export function ThesisRail({
  idea,
  pages,
  index,
  onStep,
  trailing,
  collapsedHeight,
}: {
  idea: Idea
  pages: ThesisPage[]
  index: number
  onStep: (delta: number) => void
  trailing?: ReactNode
  /** Height of the chart stack this rail sits beside. */
  collapsedHeight: number
}) {
  const page = pages[index] ?? pages[0]
  const bodyRef = useRef<HTMLUListElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)

  const measure = useCallback(() => {
    const el = bodyRef.current
    if (!el) return
    // A pixel of slack: sub-pixel text metrics otherwise report a permanent
    // one-pixel overflow on pages that visibly fit.
    setOverflowing(el.scrollHeight > el.clientHeight + 1)
  }, [])

  useLayoutEffect(measure, [measure, page, expanded, collapsedHeight])

  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [measure])

  // A shorter page may well fit; never strand the reader in an expanded rail.
  useEffect(() => setExpanded(false), [index])

  return (
    <div
      className="flex min-w-0 flex-col"
      style={{ height: expanded ? undefined : collapsedHeight, minHeight: collapsedHeight }}
    >
      <div className="flex shrink-0 items-center gap-1">
        <StepButton label="Previous thesis page" onClick={() => onStep(-1)}>
          <ChevronLeft size={11} strokeWidth={2.8} />
        </StepButton>
        <span className="num text-[8.5px] font-bold text-ink-muted">
          {index + 1}/{pages.length}
        </span>
        <StepButton label="Next thesis page" onClick={() => onStep(1)}>
          <ChevronRight size={11} strokeWidth={2.8} />
        </StepButton>
        {trailing ? <span className="mr-1 ml-auto shrink-0">{trailing}</span> : null}
      </div>

      <div className="mt-1.5 flex shrink-0 items-center gap-1.5">
        <p className="text-[9px] font-extrabold tracking-[0.08em] text-white uppercase">
          {page.label}
        </p>
        <AIConvictionBadge
          score={idea.ai.conviction}
          delta={idea.ai.convictionDelta}
          size="xs"
          showLabel={false}
          className="ml-auto shrink-0"
        />
      </div>

      <div className="relative mt-1 min-h-0 flex-1">
        <ul ref={bodyRef} className="h-full overflow-hidden">
          {page.bullets.map((bullet) => (
            <li
              key={bullet}
              className="flex gap-1.5 border-b border-line/40 py-1 text-[10px] leading-[1.25] text-white last:border-b-0"
            >
              <span className="mt-[4.5px] h-1 w-1 shrink-0 rounded-full bg-brand-500" aria-hidden />
              <span className="min-w-0">{bullet}</span>
            </li>
          ))}
        </ul>
        {overflowing && !expanded ? (
          <span
            className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-[#1b2331] to-transparent"
            aria-hidden
          />
        ) : null}
      </div>

      {overflowing || expanded ? (
        <RailExpandToggle expanded={expanded} onToggle={() => setExpanded((open) => !open)} />
      ) : null}
    </div>
  )
}

/** Wide double chevron — reads as "there is more" at a glance. */
function RailExpandToggle({
  expanded,
  onToggle,
}: {
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-label={expanded ? 'Collapse thesis notes' : 'Expand thesis notes'}
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
      className="mt-1 grid h-4 w-full shrink-0 place-items-center rounded-[6px] bg-white/[0.045] text-ink-muted transition-[background-color,color] hover:bg-white/[0.09] hover:text-ink active:scale-[0.98]"
    >
      <svg
        viewBox="0 0 28 14"
        className={cn(
          'h-[9px] w-[26px] transition-transform duration-200',
          expanded && 'rotate-180',
        )}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M2 3 L14 7.5 L26 3" />
        <path d="M2 7.5 L14 12 L26 7.5" />
      </svg>
    </button>
  )
}

function StepButton({
  children,
  label,
  onClick,
}: {
  children: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className={cn(
        'grid h-[17px] w-[17px] shrink-0 place-items-center text-ink-muted',
        'transition-colors hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}
