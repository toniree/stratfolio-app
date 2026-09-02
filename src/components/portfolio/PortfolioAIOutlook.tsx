import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Sparkles } from 'lucide-react'
import { cn } from '@/lib/cn'
import { relativeTime } from '@/lib/format'
import type { PortfolioOutlook } from '@/api/types'
import { Skeleton } from '@/components/ui/Skeleton'

const TONE_DOT: Record<string, string> = {
  positive: 'bg-up',
  neutral: 'bg-ink-muted',
  caution: 'bg-[#E8A33D]',
}

export function PortfolioAIOutlook({
  outlook,
  weightedConviction,
  loading,
}: {
  outlook?: PortfolioOutlook
  weightedConviction?: number
  loading?: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  if (loading || !outlook) {
    return <Skeleton className="h-[168px] rounded-[18px]" />
  }

  return (
    <section className="card relative overflow-hidden rounded-[24px] border-brand-400/20">
      {/* The AI treatment: luminous, but restrained to a tint plus a top rule. */}
      <div className="ai-gradient absolute inset-x-0 top-0 h-[3px]" aria-hidden />
      <div className="ai-tint absolute inset-0" aria-hidden />

      <div className="relative p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="ai-gradient inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-[0.05em] text-white uppercase">
            <Sparkles size={12} />
            AI Outlook
          </span>
          <span className="text-[12.5px] font-semibold text-ink-soft">{outlook.stance}</span>
          <span className="ml-auto text-[11.5px] text-ink-muted">
            Updated {relativeTime(outlook.updatedAt)}
          </span>
        </div>

        <h2 className="mt-3 text-[17px] leading-snug font-bold tracking-[-0.015em] text-ink sm:text-[19px]">
          {outlook.headline}
        </h2>

        <div className="mt-3.5 flex flex-wrap items-center gap-4">
          <ScoreDial label={outlook.scoreLabel} score={outlook.score} />
          {/* Nothing assessed means no weighted conviction to draw. */}
          {weightedConviction === undefined ? null : (
            <ScoreDial label="Weighted conviction" score={Math.round(weightedConviction)} />
          )}
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-bold text-brand-300 transition-opacity hover:opacity-80"
        >
          {expanded ? 'Hide detail' : 'Read the full outlook'}
          <ChevronDown
            size={15}
            className={cn('transition-transform duration-200', expanded && 'rotate-180')}
          />
        </button>

        <AnimatePresence initial={false}>
          {expanded ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 0.61, 0.36, 1] }}
              className="overflow-hidden"
            >
              <p className="mt-3.5 border-t border-[#e2e0fb] pt-3.5 text-[13.5px] leading-relaxed text-ink-soft">
                {outlook.summary}
              </p>
              <ul className="mt-3.5 grid gap-2.5 sm:grid-cols-2">
                {outlook.signals.map((signal) => (
                  <li
                    key={signal.label}
                    className="rounded-xl border border-[#e6e4fb] bg-surface/70 px-3 py-2.5"
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.06em] text-ink-muted uppercase">
                      <span
                        className={cn('h-1.5 w-1.5 rounded-full', TONE_DOT[signal.tone])}
                        aria-hidden
                      />
                      {signal.label}
                    </div>
                    <p className="mt-1 text-[12.5px] leading-snug text-ink-soft">{signal.detail}</p>
                  </li>
                ))}
              </ul>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </section>
  )
}

function ScoreDial({ label, score }: { label: string; score: number }) {
  const radius = 21
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - Math.max(0, Math.min(100, score)) / 100)

  return (
    <div className="flex items-center gap-2.5">
      <div className="relative h-[52px] w-[52px] shrink-0">
        <svg viewBox="0 0 52 52" className="h-full w-full -rotate-90">
          <defs>
            <linearGradient id={`dial-${label.replace(/\s/g, '')}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
          <circle cx="26" cy="26" r={radius} fill="none" stroke="#e7e5fb" strokeWidth="4" />
          <circle
            cx="26"
            cy="26"
            r={radius}
            fill="none"
            stroke={`url(#dial-${label.replace(/\s/g, '')})`}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.22,0.61,0.36,1)' }}
          />
        </svg>
        <span className="num absolute inset-0 grid place-items-center text-[14px] font-extrabold text-ink">
          {score}
        </span>
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-bold tracking-[0.06em] text-ink-muted uppercase">
          {label}
        </div>
        <div className="text-[12.5px] font-semibold text-ink-soft">out of 100</div>
      </div>
    </div>
  )
}
