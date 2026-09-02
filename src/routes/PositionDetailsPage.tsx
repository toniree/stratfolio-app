import { useMemo, useState } from 'react'
import { cn } from '@/lib/cn'
import { useNavigate, useParams } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { useUiStore } from '@/store/uiStore'
import { useAssistantContext } from '@/hooks/useAssistantContext'
import { usePrices } from '@/store/priceStore'
import { usePositions } from '@/hooks/queries'
import { computeTotals } from '@/lib/portfolioMath'
import { useOptionMarks } from '@/hooks/marketQueries'
import { dayChangeOf } from '@/lib/dayChange'
import {
  formatMoney,
  formatQty,
  formatRange,
  formatSignedMoney,
  formatSignedPercent,
  relativeTime,
} from '@/lib/format'
import { PageHeader } from '@/components/shared/PageHeader'
import { AIConvictionBadge } from '@/components/intelligence/AIConvictionBadge'
import { RecommendationChip } from '@/components/intelligence/TradeRecommendation'
import { RiskRewardMeter } from '@/components/intelligence/RiskRewardMeter'
import { AIUnavailable } from '@/components/intelligence/AIUnavailable'
import { ScrubbableAreaChart } from '@/components/charts/ScrubbableAreaChart'
import { optionPremiumHistory, underlyingHistory } from '@/lib/optionHistory'
import { PositionActionFooter } from '@/components/positions/PositionActionFooter'
import { usePlannerIdeas } from '@/hooks/queries'
import { RelatedNews } from '@/components/news/RelatedNews'
import { Skeleton } from '@/components/ui/Skeleton'
import { DetailStat, NotFound } from '@/components/shared/DetailPrimitives'
import { OptionContractDetails } from '@/components/positions/OptionContractDetails'
import { PositionQuickView } from '@/components/positions/PositionQuickView'
import { SymbolIcon } from '@/components/shared/SymbolIcon'

const RANGES = ['1D', '1W', '4W', '3M', '1Y'] as const
type RangeId = (typeof RANGES)[number]

/** Trading sessions covered by each range. */
const RANGE_SESSIONS: Record<RangeId, number> = {
  '1D': 8,
  '1W': 5,
  '4W': 20,
  '3M': 63,
  '1Y': 252,
}

export function PositionDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const accountId = useUiStore((s) => s.accountId)
  const prices = usePrices()
  const { data: positions, isLoading } = usePositions(accountId)
  const { data: plannerIdeas } = usePlannerIdeas()

  const { marks } = useOptionMarks(positions)
  const totals = useMemo(
    () => computeTotals(positions ?? [], prices, marks),
    [positions, prices, marks],
  )
  const valuation = totals.valuations.find((v) => v.position.id === id)
  const snap = valuation ? prices[valuation.position.symbol] : undefined
  // Plans already attached to this holding, so the sheet opens populated.
  const positionPlans = useMemo(
    () => (plannerIdeas ?? []).filter((idea) => idea.positionId === id),
    [plannerIdeas, id],
  )

  useAssistantContext(
    valuation
      ? {
          kind: 'position',
          id: valuation.position.id,
          label: valuation.position.contractDetail
            ? `${valuation.position.symbol} ${valuation.position.contractDetail}`
            : `${valuation.position.symbol} · ${valuation.position.company}`,
          detail: `${formatQty(valuation.position.quantity)} @ ${formatMoney(valuation.position.avgCost)} avg`,
          to: `/app/positions/${valuation.position.id}`,
        }
      : null,
  )

  const [series, setSeries] = useState<'option' | 'underlying'>('option')
  const [range, setRange] = useState<RangeId>('4W')

  // Hooks must run on every render, so this sits above the loading and
  // not-found returns rather than beside the values it feeds.
  const chartHistory = useMemo(() => {
    const pos = valuation?.position
    if (!pos) return []
    const ageDays = Math.ceil(
      Math.max(0, Date.now() - new Date(pos.openedAt).getTime()) / 86_400_000,
    )
    const sessions = Math.max(8, Math.min(RANGE_SESSIONS[range], ageDays + 3))
    return pos.option && series === 'option'
      ? optionPremiumHistory(pos.option, pos.symbol, valuation.underlyingPrice, sessions)
      : underlyingHistory(pos.symbol, valuation.underlyingPrice, sessions)
  }, [valuation, series, range])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  if (!valuation) {
    return (
      <NotFound
        title="Position not found"
        detail="It may have been filtered out by the current portfolio selection."
        backTo="/app/positions"
        backLabel="All positions"
      />
    )
  }

  const { position, price, marketValue, totalReturn, totalReturnPct } = valuation
  const ai = position.ai
  // A server-marked contract has no prior mark; today's move is unknown, and
  // the hint says so rather than printing "+$0.00 (+0.00%) today".
  const day = dayChangeOf(valuation)

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        backTo="/app/portfolio"
        backLabel="Portfolio"
        title={
          <span className="inline-flex items-center gap-2.5">
            <SymbolIcon symbol={position.symbol} size="md" />
            {position.symbol}
            {position.contractDetail ? (
              <span className="num uppercase">{position.contractDetail}</span>
            ) : null}
          </span>
        }
        // Contract sits on the ticker's line at the same weight, so the two read
        // as one identifier rather than a title with a caption.
        mobileTitle={
          <span className="inline-flex min-w-0 items-baseline gap-1.5">
            {position.symbol}
            {position.contractDetail ? (
              <span className="num min-w-0 truncate uppercase">{position.contractDetail}</span>
            ) : null}
          </span>
        }
        subtitle={position.company}
      />

      {/* ---- Live price ---- */}
      <section className="card p-4 sm:p-5">
        {/* Chart owns the top half; the live price moves into the stat table
            below so it reads as one figure among the position's numbers. */}
        <div className="mb-1 flex items-center justify-between gap-2">
          {position.option ? (
            <div className="liquid-inset grid w-[132px] shrink-0 grid-cols-2 gap-0.5 rounded-full p-0.5">
              {(['option', 'underlying'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={series === option}
                  onClick={() => setSeries(option)}
                  className={cn(
                    'rounded-full py-1 text-[9px] font-bold tracking-[0.05em] uppercase transition-colors',
                    series === option ? 'bg-white/[0.14] text-ink' : 'text-ink-muted hover:text-ink',
                  )}
                >
                  {option === 'option' ? 'Contract' : position.symbol}
                </button>
              ))}
            </div>
          ) : (
            <span />
          )}
          <div className="flex gap-1">
            {RANGES.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={range === item}
                onClick={() => setRange(item)}
                className={cn(
                  'rounded-full px-2 py-0.5 text-[9.5px] font-bold tracking-[0.04em] uppercase transition-colors',
                  range === item
                    ? 'bg-white/[0.12] text-ink'
                    : 'text-ink-muted hover:bg-white/[0.05] hover:text-ink',
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <ScrubbableAreaChart
          data={chartHistory.map((point) => point.value)}
          times={chartHistory.map((point) => point.time)}
          costBasis={series === 'option' ? position.avgCost : undefined}
        />

        <dl className="mt-4 grid grid-cols-3 gap-x-3 gap-y-3 border-t border-line pt-4 sm:grid-cols-6">
          <DetailStat
            label={position.option ? 'Mark' : 'Price'}
            value={formatMoney(price)}
            hint={day.available ? `${day.combined} today` : 'Today’s change unavailable'}
            tone={day.tone}
          />
          <DetailStat label="Value" value={formatMoney(marketValue)} />
          <DetailStat label="Qty" value={formatQty(position.quantity)} />
          <DetailStat label="Avg" value={formatMoney(position.avgCost)} />
          <DetailStat
            label="Return"
            value={formatSignedMoney(totalReturn)}
            hint={formatSignedPercent(totalReturnPct)}
            tone={totalReturn >= 0 ? 'up' : 'down'}
          />
          <DetailStat label="Underlying" value={formatMoney(valuation.underlyingPrice)} />
        </dl>
      </section>

      {position.option ? (
        <section className="card overflow-hidden pt-4 sm:pt-5">
          <header className="px-4 pb-2 sm:px-5">
            <h2 className="text-[15px] font-bold tracking-[-0.01em] text-ink">
              Entry &amp; estimated exit plan
            </h2>
            <p className="mt-0.5 text-[11.5px] text-ink-muted">
              Premium targets include estimated total profit across all contracts.
            </p>
          </header>
          <PositionQuickView
            valuation={valuation}
            showDetailsLink={false}
            showRecommendation={false}
          />
        </section>
      ) : null}

      {position.option && snap ? (
        <OptionContractDetails
          contract={position.option}
          underlying={snap.price}
          contracts={position.quantity}
          avgPremium={position.avgCost}
          mark={price}
        />
      ) : null}

      {/* ---- Intelligence ---- */}
      {/* The entire model panel is conditional. plt records a
          `decision_episode_id`, not the episode's content, and service-ai
          exposes no episode read API yet (HKP-AI-1) — so a live position
          usually has no assessment, and a neutral placebo panel would be an
          opinion nothing produced. */}
      {ai ? (
        <>
          <section className="card relative overflow-hidden rounded-[24px] border-brand-400/20">
            <div className="ai-gradient absolute inset-x-0 top-0 h-[3px]" aria-hidden />
            <div className="ai-tint absolute inset-0" aria-hidden />
            <div className="relative p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <AIConvictionBadge score={ai.conviction} delta={ai.convictionDelta} size="lg" />
                <RecommendationChip recommendation={ai.recommendation} />
                <span className="num text-[13px] font-semibold text-ink-soft">
                  Target {formatRange(ai.targetLow, ai.targetHigh)}
                </span>
              </div>

              <p className="mt-3 text-[14px] leading-relaxed font-semibold text-ink">
                {ai.recommendationNote}
              </p>

              <h3 className="mt-4 mb-2 flex items-center gap-1.5 text-[11px] font-bold tracking-[0.08em] text-brand-300 uppercase">
                <Sparkles size={13} />
                Why StratFolio holds this view
              </h3>
              <ul className="space-y-2.5">
                {ai.thesis.map((bullet, i) => (
                  <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed text-ink-soft">
                    <span
                      className="ai-gradient mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full"
                      aria-hidden
                    />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11.5px] text-ink-muted">
                Thesis refreshed {relativeTime(ai.updatedAt)}
              </p>
            </div>
          </section>

          <RiskRewardMeter
            currentPrice={price}
            upsideTarget={ai.upsideTarget}
            downsideRisk={ai.downsideRisk}
            riskRewardRatio={ai.riskRewardRatio}
            horizon={ai.horizon}
          />
        </>
      ) : (
        <section className="card rounded-[24px] p-4 sm:p-5">
          <AIUnavailable detail="No model assessment is recorded for this position." />
        </section>
      )}

      <RelatedNews symbol={position.symbol} />

      {/* Same exit / ask / plan bar the home tiles carry, so a position behaves
          identically wherever it is opened from. */}
      <PositionActionFooter
        position={position}
        price={price}
        previousClose={valuation?.previousClose}
        plans={positionPlans}
        onOpenPlanner={(plan) => navigate(`/app/plan/${plan.id}`)}
      />
    </div>
  )
}
