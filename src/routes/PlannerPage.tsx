import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bot, Power, Sparkles, UserRound, X } from 'lucide-react'
import { usePlannerIdeas } from '@/hooks/queries'
import { StaticPill } from '@/components/shared/Pill'
import { PlannerIdeaTile, DirectionChip, SourceBadge } from '@/components/plan/PlannerIdeaTile'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { AIConvictionBadge } from '@/components/intelligence/AIConvictionBadge'
import { formatPercent, formatRange } from '@/lib/format'
import { sortPlansByTriggerSoon } from '@/lib/plannerSort'
import { usePlanExecutionStore } from '@/store/planExecutionStore'
import { cn } from '@/lib/cn'
import { PageHeader } from '@/components/shared/PageHeader'

type Filter = 'all' | 'ai' | 'user' | 'disabled'

/**
 * The planning surface — distinct from the AI Trade Recs discovery feed.
 * Holds AI-derived ideas (including any arrived at from a news article) plus
 * the user's own written-up ideas.
 */
export function PlannerPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const focusedId = searchParams.get('idea')
  const sort = searchParams.get('sort')
  const [filter, setFilter] = useState<Filter>('all')
  const focusRef = useRef<HTMLDivElement>(null)
  const disabledIds = usePlanExecutionStore((state) => state.disabledIds)

  const { data: ideas, isLoading } = usePlannerIdeas()
  const focused = ideas?.find((i) => i.id === focusedId)

  useEffect(() => {
    if (focused && focusRef.current) {
      focusRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [focused])

  const visible = useMemo(() => {
    const all = ideas ?? []
    const filtered =
      filter === 'all'
        ? all
        : filter === 'disabled'
          ? all.filter((idea) => disabledIds.includes(idea.id))
          : all.filter((idea) => idea.source === filter)
    return sort === 'trigger-soon' ? sortPlansByTriggerSoon(filtered) : filtered
  }, [ideas, filter, sort, disabledIds])

  const aiCount = (ideas ?? []).filter((i) => i.source === 'ai').length
  const userCount = (ideas ?? []).filter((i) => i.source === 'user').length
  const disabledCount = (ideas ?? []).filter((idea) => disabledIds.includes(idea.id)).length

  return (
    <div className="space-y-4">
      <PageHeader
        backTo="/app/portfolio"
        backLabel="Back to home"
        title="Planner"
        mobileTitle="TRADE PLANS"
        mobileSubtitle="Your saved setups. Entry always needs an explicit action."
      />

      {/* The "Create a trade plan with AI" composer used to live here. It was
          a regex over the prompt that pulled a ticker out of the mock seed
          map, then invented an entry band, a target band, a stop and a horizon
          from arithmetic on a seeded open price — a client-side model
          pretending to be the decision engine (§3.3, §6). The real composer is
          service-ai's (HKP-AI-3a) and lands in Wave C behind a server-side
          gate. Plans are created from a real contract until then. */}

      <div
        role="tablist"
        aria-label="Plan filters"
        className="liquid-inset grid grid-cols-4 divide-x divide-white/[0.075] overflow-hidden rounded-[18px]"
      >
        <PlannerSummary icon={<Sparkles size={12} />} label="All plans" value={(ideas ?? []).length} active={filter === 'all'} onClick={() => setFilter('all')} />
        <PlannerSummary icon={<Bot size={12} />} label="AI plans" value={aiCount} active={filter === 'ai'} onClick={() => setFilter('ai')} />
        <PlannerSummary icon={<UserRound size={12} />} label="Your plans" value={userCount} active={filter === 'user'} onClick={() => setFilter('user')} />
        <PlannerSummary icon={<Power size={12} />} label="Disabled" value={disabledCount} active={filter === 'disabled'} onClick={() => setFilter('disabled')} />
      </div>

      {/* ---- Focused idea, arrived at from a news article ---- */}
      {focused ? (
        <motion.div
          ref={focusRef}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="card relative overflow-hidden rounded-[22px] border-white/[0.1]"
        >
          <div className="relative p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-1.5 text-[9px] font-bold tracking-[0.08em] text-brand-200 uppercase">
                <Sparkles size={11} />
                Loaded from a news story
              </div>
              <button
                type="button"
                aria-label="Dismiss focused idea"
                onClick={() => setSearchParams({}, { replace: true })}
                className="-mt-1 -mr-1 grid h-8 w-8 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <SourceBadge source={focused.source} />
              <DirectionChip direction={focused.direction} />
              <span className="text-[17px] font-extrabold tracking-[-0.02em] text-ink">
                {focused.symbol}
              </span>
              <span className="truncate text-[12.5px] text-ink-muted">
                {focused.contractDetail ?? focused.company}
              </span>
            </div>

            <h2 className="mt-2 text-[16px] leading-snug font-bold text-ink">{focused.title}</h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">{focused.notes}</p>

            {focused.sourceArticleId ? (
              <Link
                to={`/app/news/${focused.sourceArticleId}`}
                className="mt-2.5 inline-block text-[12.5px] font-semibold text-brand-600 hover:underline"
              >
                Source: {focused.sourceArticleHeadline}
              </Link>
            ) : null}

            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              {focused.ai ? (
                <AIConvictionBadge
                  score={focused.ai.conviction}
                  delta={focused.ai.convictionDelta}
                  size="sm"
                />
              ) : null}
              {/* Each pill is dropped rather than rendered as a dash: plt
                  records no expected upside and no horizon on a plan (§3.3). */}
              {focused.expectedUpsidePct === undefined ? null : (
                <StaticPill tone="positive">
                  {formatPercent(focused.expectedUpsidePct, 1)} upside
                </StaticPill>
              )}
              {focused.entryLow === undefined && focused.entryHigh === undefined ? null : (
                <StaticPill tone="neutral">
                  Entry {formatRange(focused.entryLow, focused.entryHigh)}
                </StaticPill>
              )}
              {focused.horizon ? <StaticPill tone="ai">{focused.horizon}</StaticPill> : null}
            </div>

            <Button asChild variant="secondary" size="sm" className="mt-3.5 border-white/[0.09] bg-white/[0.035] text-ink-soft">
              <Link to={`/app/plan/${focused.id}`}>Open full plan</Link>
            </Button>
          </div>
        </motion.div>
      ) : null}

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[280px] rounded-[18px]" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="card px-6 py-14 text-center">
          <p className="text-[15px] font-bold text-ink">No plans here yet</p>
          <p className="mx-auto mt-1 max-w-[340px] text-[13px] leading-relaxed text-ink-soft">
            Add a plan with explicit execution criteria, risk, and sizing.
          </p>
          <p className="mt-3 text-[11px] font-semibold text-brand-200/75">
            Use the AI plan composer above to create one.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((idea, index) => (
            <motion.div
              key={idea.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, delay: Math.min(index * 0.03, 0.2) }}
            >
              <PlannerIdeaTile idea={idea} disabled={disabledIds.includes(idea.id)} />
            </motion.div>
          ))}
        </div>
      )}

    </div>
  )
}

function PlannerSummary({
  icon,
  label,
  value,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  value: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'flex min-w-0 items-center justify-center gap-1.5 px-1.5 py-2.5 text-left transition-[background-color,color,box-shadow] active:bg-white/[0.08]',
        active
          ? 'bg-brand-400/[0.13] shadow-[inset_0_1px_rgba(255,255,255,0.08)]'
          : 'hover:bg-white/[0.035]',
      )}
    >
      <span className={active ? 'text-brand-100' : 'text-brand-300/82'}>{icon}</span>
      <span>
        <span className={cn('num block text-[12px] leading-none font-extrabold', active ? 'text-white' : 'text-white/88')}>{value}</span>
        <span className={cn('mt-0.5 block truncate text-[7px] font-bold tracking-[0.045em] uppercase', active ? 'text-white/86' : 'text-white/68')}>{label}</span>
      </span>
    </button>
  )
}
