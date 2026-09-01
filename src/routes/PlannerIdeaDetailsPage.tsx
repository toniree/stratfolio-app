import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Newspaper, Sparkles, Trash2 } from 'lucide-react'
import { usePlannerIdeas, useDeletePlannerIdea } from '@/hooks/queries'
import { usePrice } from '@/store/priceStore'
import { useAssistantContext } from '@/hooks/useAssistantContext'
import { formatMoney, formatPercent, formatSignedPercent, relativeTime } from '@/lib/format'
import { PageHeader } from '@/components/shared/PageHeader'
import { PlanStopwatchIcon } from '@/components/plan/PlanStopwatchIcon'
import { Sparkline } from '@/components/charts/Sparkline'
import { AIConvictionBadge } from '@/components/intelligence/AIConvictionBadge'
import { RecommendationChip } from '@/components/intelligence/TradeRecommendation'
import { RiskRewardMeter } from '@/components/intelligence/RiskRewardMeter'
import { CatalystList, RiskFactors } from '@/components/intelligence/Ranges'
import { DirectionChip, SourceBadge } from '@/components/plan/PlannerIdeaTile'
import { StaticPill } from '@/components/shared/Pill'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { PlanCriteriaList } from '@/components/plan/PlanCriteriaList'
import { RelatedNews } from '@/components/news/RelatedNews'
import { DetailStat, NotFound } from '@/components/shared/DetailPrimitives'
import { SymbolIcon } from '@/components/shared/SymbolIcon'

export function PlannerIdeaDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: ideas, isLoading } = usePlannerIdeas()
  const deleteIdea = useDeletePlannerIdea()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const idea = ideas?.find((i) => i.id === id)
  const snap = usePrice(idea?.symbol ?? '')

  useAssistantContext(
    idea
      ? {
          kind: 'plan',
          id: idea.id,
          label: idea.contractDetail
            ? `${idea.symbol} ${idea.contractDetail}`
            : `${idea.symbol} · ${idea.company}`,
          detail: `${idea.source === 'ai' ? 'AI plan' : 'Your plan'} · ${idea.status}`,
          to: `/app/plan/${idea.id}`,
        }
      : null,
  )

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    )
  }

  if (!idea) {
    return (
      <NotFound
        title="Trade idea not found"
        detail="It may have been deleted from your planner."
        backTo="/app/plan"
        backLabel="Back to Planner"
      />
    )
  }

  const price = snap?.price ?? idea.entryHigh
  const up = (snap?.dayChangePct ?? 0) >= 0
  const inEntryBand = price >= idea.entryLow && price <= idea.entryHigh
  const riskPerUnit = Math.abs(idea.entryHigh - idea.stop)
  const rewardPerUnit = Math.abs((idea.targetLow + idea.targetHigh) / 2 - idea.entryHigh)
  const ratio = riskPerUnit > 0 ? rewardPerUnit / riskPerUnit : 0

  const handleDelete = async () => {
    await deleteIdea.mutateAsync(idea.id)
    navigate('/app/plan')
  }

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        backTo="/app/plan"
        backLabel="Planner"
        title={
          <span className="inline-flex items-center gap-2.5">
            <PlanStopwatchIcon className="h-6 w-6 text-brand-300" />
            Trade plan
          </span>
        }
        mobileTitle={<PlanStopwatchIcon className="h-5 w-5 text-brand-300" />}
        mobileSubtitle={idea.contractDetail ?? idea.company}
        subtitle={idea.contractDetail ?? idea.company}
        aside={
          <div className="flex items-center gap-2">
            <SourceBadge source={idea.source} />
            <DirectionChip direction={idea.direction} />
          </div>
        }
      />

      <section className="card relative overflow-hidden rounded-[24px] border-brand-400/22 p-4 sm:p-5">
        <span className="thesis-edge-seam absolute inset-x-0 top-0 h-[3px]" aria-hidden>
          <span className="thesis-edge-spark thesis-edge-spark-left" />
          <span className="thesis-edge-spark thesis-edge-spark-right" />
        </span>
        <div className="flex min-w-0 items-center gap-2">
          <SymbolIcon symbol={idea.symbol} size="sm" />
          <h2 className="num min-w-0 truncate text-[14px] font-extrabold tracking-[0.01em] text-ink uppercase">
            {idea.symbol} {idea.contractDetail ?? idea.company}
          </h2>
        </div>
        <h3 className="mt-2.5 text-[15px] leading-snug font-bold tracking-[-0.015em] text-ink">
          {idea.title}
        </h3>

        {/* The criteria are the plan — they belong with it, not three tiles down. */}
        <div className="mt-3 rounded-[16px] border border-line bg-white/[0.03] px-3 py-2.5">
          <PlanCriteriaList plan={idea} />
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <StaticPill tone={idea.status === 'ready' ? 'positive' : 'neutral'}>
            {idea.status.toUpperCase()}
          </StaticPill>
          <StaticPill tone="muted">By {idea.author}</StaticPill>
          <StaticPill tone="muted">Created {relativeTime(idea.createdAt)}</StaticPill>
          {inEntryBand ? (
            <StaticPill tone="positive">Trading inside the entry band</StaticPill>
          ) : null}
        </div>

        {idea.sourceArticleId ? (
          <Link
            to={`/app/news/${idea.sourceArticleId}`}
            className="mt-3.5 flex items-start gap-2 rounded-xl border border-line bg-surface-sunken/60 px-3 py-2.5 transition-colors hover:bg-surface-sunken"
          >
            <Newspaper size={15} className="mt-0.5 shrink-0 text-ink-muted" />
            <span className="min-w-0">
              <span className="block text-[10.5px] font-bold tracking-[0.07em] text-ink-muted uppercase">
                Catalyst source
              </span>
              <span className="mt-0.5 block text-[13px] leading-snug font-semibold text-ink">
                {idea.sourceArticleHeadline}
              </span>
            </span>
          </Link>
        ) : null}
      </section>

      <section className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[10.5px] font-bold tracking-[0.07em] text-ink-muted uppercase">
              Live price
            </div>
            <div className="num mt-1 text-[28px] leading-none font-extrabold tracking-[-0.03em] text-ink">
              {formatMoney(price)}
            </div>
            <div
              className={`num mt-1.5 text-[13px] font-bold ${
                snap === undefined ? 'text-ink-muted' : up ? 'text-up' : 'text-down'
              }`}
            >
              {/* No quote for this symbol means no day change — not a flat one. */}
              {snap === undefined ? '—' : formatSignedPercent(snap.dayChangePct)}{' '}
              <span className="font-medium text-ink-muted">today</span>
            </div>
          </div>
          <Sparkline
            data={snap?.history ?? []}
            tone={up ? 'up' : 'down'}
            width={300}
            height={58}
            className="w-full sm:w-[300px]"
          />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 sm:grid-cols-4">
          <DetailStat
            label="Entry range"
            value={`${formatMoney(idea.entryLow)} – ${formatMoney(idea.entryHigh)}`}
          />
          <DetailStat
            label="Target range"
            value={`${formatMoney(idea.targetLow)} – ${formatMoney(idea.targetHigh)}`}
            tone="up"
          />
          <DetailStat label="Stop" value={formatMoney(idea.stop)} tone="down" />
          <DetailStat
            label="Expected upside"
            value={formatPercent(idea.expectedUpsidePct, 1)}
            hint={idea.horizon}
            tone="up"
          />
        </dl>
      </section>

      <RiskRewardMeter
        currentPrice={price}
        upsideTarget={(idea.targetLow + idea.targetHigh) / 2}
        downsideRisk={idea.stop}
        riskRewardRatio={idea.ai?.riskRewardRatio ?? ratio}
        horizon={idea.horizon}
      />

      {idea.ai ? (
        <section className="card relative overflow-hidden rounded-[24px] border-brand-400/20">
          <div className="ai-gradient absolute inset-x-0 top-0 h-[3px]" aria-hidden />
          <div className="ai-tint absolute inset-0" aria-hidden />
          <div className="relative p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <AIConvictionBadge
                score={idea.ai.conviction}
                delta={idea.ai.convictionDelta}
                size="lg"
              />
              <RecommendationChip recommendation={idea.ai.recommendation} />
            </div>
            <h3 className="mt-3 mb-2 flex items-center gap-1.5 text-[11px] font-bold tracking-[0.08em] text-brand-300 uppercase">
              <Sparkles size={13} />
              AI reasoning
            </h3>
            <p className="text-[14px] leading-relaxed font-semibold text-ink">
              {idea.ai.recommendationNote}
            </p>
            <ul className="mt-3 space-y-2.5">
              {idea.ai.thesis.map((bullet, i) => (
                <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed text-ink-soft">
                  <span className="ai-gradient mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" aria-hidden />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {idea.catalysts.length > 0 || idea.risks.length > 0 ? (
        <div className="grid gap-3.5 sm:grid-cols-2">
          {idea.catalysts.length > 0 ? (
            <section className="card p-4">
              <CatalystList items={idea.catalysts} />
            </section>
          ) : null}
          {idea.risks.length > 0 ? (
            <section className="card p-4">
              <RiskFactors items={idea.risks} />
            </section>
          ) : null}
        </div>
      ) : null}

      <RelatedNews symbol={idea.symbol} />

      {idea.source === 'user' ? (
        <div className="flex justify-end">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-[12.5px] text-ink-soft">Delete this idea?</span>
              <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleDelete}
                disabled={deleteIdea.isPending}
              >
                {deleteIdea.isPending ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          ) : (
            <Button variant="outlineDanger" size="sm" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={15} />
              Delete idea
            </Button>
          )}
        </div>
      ) : null}
    </div>
  )
}
