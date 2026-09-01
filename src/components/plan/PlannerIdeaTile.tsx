import { useNavigate } from 'react-router-dom'
import { Bot, ChevronRight, UserRound } from 'lucide-react'
import { CriterionIcon } from '@/components/plan/CriterionIcon'
import { cn } from '@/lib/cn'
import { formatMoney, relativeTime } from '@/lib/format'
import type { PlannerIdea } from '@/api/newsTypes'
import { TileShell } from '@/components/shared/TileShell'
import { SymbolIcon } from '@/components/shared/SymbolIcon'
import { planCriteria, planIntent, watchedPlanOptions } from '@/lib/planIntent'
import { triggerSoonPercent } from '@/lib/plannerSort'

export function SourceBadge({ source }: { source: PlannerIdea['source'] }) {
  const ai = source === 'ai'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[8.5px] font-bold tracking-[0.055em] uppercase',
        // Same dim rainbow the home tiles and news badges use for AI authorship.
        ai
          ? 'ai-criterion-rainbow border-white/20 text-white'
          : 'border-white/[0.08] bg-white/[0.035] text-ink-soft',
      )}
    >
      {ai ? <Bot size={9} /> : <UserRound size={9} />}
      {ai ? 'AI' : 'You'}
    </span>
  )
}

export function DirectionChip({ direction }: { direction: PlannerIdea['direction'] }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-1.5 py-0.5 text-[8.5px] font-bold tracking-[0.05em]',
        direction === 'LONG' ? 'bg-up-soft text-up' : 'bg-down-soft text-down',
      )}
    >
      {direction}
    </span>
  )
}

export function PlannerIdeaTile({ idea, disabled = false }: { idea: PlannerIdea; disabled?: boolean }) {
  const navigate = useNavigate()
  const to = `/app/plan/${idea.id}`
  const intent = planIntent(idea)
  const watchedOptions = watchedPlanOptions(idea)
  const prompt = idea.originalPrompt?.trim() || idea.title

  return (
    <TileShell
      onActivate={() => navigate(to)}
      ariaLabel={`${idea.symbol} trade plan details`}
      className={cn('min-h-[286px] p-3.5', disabled && 'bg-down/[0.025] opacity-70')}
    >
      <div className="flex items-start gap-2.5">
        <SymbolIcon symbol={idea.symbol} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="text-[16px] leading-none font-extrabold tracking-[-0.02em] text-ink">
              {idea.symbol}
            </span>
            {idea.contractDetail ? (
              <span className="num min-w-0 truncate rounded-md bg-surface-sunken px-1.5 py-px text-[10px] font-bold whitespace-nowrap text-ink uppercase">
                {idea.contractDetail}
              </span>
            ) : null}
          </div>
          {idea.contractDetail ? null : (
            <p className="mt-1 truncate text-[10.5px] text-ink-muted">{idea.company}</p>
          )}
        </div>
        <span className="shrink-0 text-[9px] text-ink-muted">{relativeTime(idea.createdAt)}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <SourceBadge source={idea.source} />
        <span
          className={cn(
            'rounded-full px-1.5 py-px text-[7.5px] font-extrabold tracking-[0.06em] uppercase',
            intent === 'close' ? 'bg-down-soft text-down' : 'bg-up-soft text-up',
          )}
        >
          {intent}
        </span>
        <DirectionChip direction={idea.direction} />
        <span className={cn('rounded-full border px-2 py-0.5 text-[8.5px] font-bold uppercase', disabled ? 'border-down/20 bg-down/[0.08] text-down/80' : 'border-white/[0.07] bg-white/[0.025] text-ink-muted')}>
          {disabled ? 'Disabled' : idea.status}
        </span>
        <span className={cn('num ml-auto text-[9px] font-extrabold', disabled ? 'text-down/70' : 'text-up')}>
          {disabled ? 'Auto off' : `${triggerSoonPercent(idea)} trigger`}
        </span>
      </div>

      <p className={cn('mt-2.5 line-clamp-2 text-[12.5px] leading-snug font-semibold text-ink', disabled && 'line-through decoration-down/75')}>
        {prompt}
      </p>

      <dl className="liquid-inset mt-3 grid grid-cols-3 divide-x divide-white/[0.075] overflow-hidden rounded-[16px]">
        <PlanFact label="Entry" value={formatRange(idea.entryLow, idea.entryHigh)} />
        <PlanFact label="Target" value={formatRange(idea.targetLow, idea.targetHigh)} tone="up" />
        <PlanFact
          label={intent === 'close' ? 'Qty action' : 'Max'}
          value={intent === 'close' ? 'Position' : formatMoney(idea.maxAmount ?? 1000, { whole: true })}
        />
      </dl>

      <div className="mt-2.5 min-h-0 flex-1">
        <p className="text-[7.5px] font-bold tracking-[0.07em] text-ink-muted uppercase">
          Execution criteria
        </p>
        <ul className="mt-1 space-y-1">
          {planCriteria(idea).slice(0, 2).map((criterion) => (
            <li key={criterion.text} className="flex items-start gap-1.5">
              <CriterionIcon state={criterion.state} size={11} />
              <span className="min-w-0 truncate text-[10px] leading-snug text-white/78">
                {criterion.text}
              </span>
            </li>
          ))}
        </ul>
        {watchedOptions.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {watchedOptions.map((option) => (
              <span
                key={option}
                className="max-w-full truncate rounded-full border border-brand-300/30 bg-brand-400/[0.16] px-2 py-0.5 text-[8px] font-semibold text-[#c7e3ff] shadow-[inset_0_1px_rgba(255,255,255,0.08)]"
              >
                {option}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-2.5 flex items-center border-t border-white/[0.07] pt-2 text-[9px] font-semibold text-ink-muted">
        {idea.source === 'user' ? <UserRound size={11} className="mr-1.5" /> : <Bot size={11} className="mr-1.5" />}
        {idea.source === 'user' ? 'Created by you' : 'Created by StratFolio AI'}
        <ChevronRight size={13} className="ml-auto text-white/55" />
      </div>
    </TileShell>
  )
}

function PlanFact({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'up'
}) {
  return (
    <div className="min-w-0 px-2 py-2 text-center">
      <dt className="text-[7.5px] font-bold tracking-[0.06em] text-ink-muted uppercase">{label}</dt>
      <dd className={cn('num mt-0.5 truncate text-[9.5px] font-extrabold text-ink', tone === 'up' && 'text-up')}>
        {value}
      </dd>
    </div>
  )
}

function formatRange(low: number, high: number): string {
  const whole = Math.max(low, high) >= 100
  return low === high
    ? formatMoney(low, { whole })
    : `${formatMoney(low, { whole })}–${formatMoney(high, { whole })}`
}
