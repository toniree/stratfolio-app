import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Sparkles, TrendingUp } from 'lucide-react'
import { useIdeas } from '@/hooks/queries'
import { usePrice } from '@/store/priceStore'
import { useAssistantContext } from '@/hooks/useAssistantContext'
import { formatMoney, formatPercent, formatSignedPercent, relativeTime } from '@/lib/format'
import { AIConvictionBadge } from '@/components/intelligence/AIConvictionBadge'
import { AIUnavailable } from '@/components/intelligence/AIUnavailable'
import { RecommendationChip } from '@/components/intelligence/TradeRecommendation'
import { RiskRewardMeter } from '@/components/intelligence/RiskRewardMeter'
import { CatalystList, RiskFactors } from '@/components/intelligence/Ranges'
import { StaticPill } from '@/components/shared/Pill'
import { ThesisTileFooter } from '@/components/thesis/ThesisTileFooter'
import { RelatedNews } from '@/components/news/RelatedNews'
import { Skeleton } from '@/components/ui/Skeleton'
import { NotFound } from '@/components/shared/DetailPrimitives'
import { OptionContractDetails } from '@/components/positions/OptionContractDetails'
import { optionMark } from '@/lib/optionMath'
import { SymbolIcon } from '@/components/shared/SymbolIcon'
import { ThesisSparklesIcon } from '@/components/thesis/ThesisSparklesIcon'
import { TradeIdeaCharts } from '@/components/thesis/TradeIdeaCharts'

export function RecDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: ideas, isLoading } = useIdeas()
  const idea = ideas?.find((i) => i.id === id)
  const snap = usePrice(idea?.symbol ?? '')

  useAssistantContext(
    idea
      ? {
          kind: 'thesis',
          id: idea.id,
          label: idea.contractDetail
            ? `${idea.symbol} ${idea.contractDetail}`
            : [idea.symbol, idea.company].filter(Boolean).join(' · '),
          detail: idea.ai
            ? `${idea.ai.recommendation} · ${idea.ai.conviction}/100 conviction`
            : undefined,
          to: `/app/thesis/${idea.id}`,
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
        title="Recommendation not found"
        detail="This idea may have rolled off the feed."
        backTo="/app/thesis"
        backLabel="All recommendations"
      />
    )
  }

  const price = snap?.price ?? idea.referencePrice
  const up = (snap?.dayChangePct ?? 0) >= 0
  const premium = idea.option ? optionMark(idea.option, price) : price
  const inEntryBand = premium >= idea.entryLow && premium <= idea.entryHigh
  // Expiry uppercased so the contract reads as one typographic unit alongside
  // the ticker, rather than trailing off into sentence case.
  const contractLine = idea.option
    ? `${idea.symbol} $${idea.option.strike}${idea.option.right === 'CALL' ? 'C' : 'P'} ${idea.option.expiryLabel.toUpperCase()}`
    : `${idea.symbol} · ${idea.company}`

  return (
    <div className="space-y-4 pb-4">
      <div className="relative flex items-center">
        <Link
          to="/app/thesis"
          aria-label="Back to Trade Theses"
          className="nav-gloss-button h-9 w-9 shrink-0"
        >
          <ChevronLeft size={17} strokeWidth={2.4} />
        </Link>
        {/* Sits a touch above the row's centre line so it reads as a crest over
            the card rather than a control beside the back button. */}
        <span className="pointer-events-none absolute inset-x-0 -top-1 flex justify-center">
          <ThesisSparklesIcon className="h-6 w-6 text-brand-300/85" />
        </span>
      </div>

      {/* ---------- The eye-catcher: what this trade actually claims ---------- */}
      <section className="card relative -mt-1 overflow-hidden rounded-[24px] border-brand-400/22 p-4 sm:p-5">
        {/* Two points run inward from the corners and meet in the middle. */}
        <span className="thesis-edge-seam absolute inset-x-0 top-0 h-[3px]" aria-hidden>
          <span className="thesis-edge-spark thesis-edge-spark-left" />
          <span className="thesis-edge-spark thesis-edge-spark-right" />
        </span>
        {/* Names the page and the contract in one line, with the only way back
            sitting on the same row rather than costing a header of its own. */}
        <div className="flex min-w-0 items-center justify-center gap-2">
          <span className="text-[14px] font-extrabold tracking-[-0.01em] text-ink-muted">
            Thesis:
          </span>
          <SymbolIcon symbol={idea.symbol} size="sm" />
          <h2 className="num truncate text-[14px] font-extrabold tracking-[0.01em] text-ink">
            {contractLine}
          </h2>
        </div>

        {/* Verdict first, then the reasoning that supports it. */}
        <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
          {idea.ai ? (
            <>
              <AIConvictionBadge
                score={idea.ai.conviction}
                delta={idea.ai.convictionDelta}
                size="sm"
              />
              <RecommendationChip recommendation={idea.ai.recommendation} />
            </>
          ) : null}
          <span className="inline-flex items-center gap-1 text-[12.5px] font-bold text-up">
            <TrendingUp size={13} />
            {formatPercent(idea.expectedUpsidePct, 1)} upside
          </span>
        </div>

        {/* Lighter and smaller than the contract heading — this is the
            supporting argument, not the headline. No `text-balance`: it evens
            out line lengths, which left the paragraph short of the right edge. */}
        {idea.ai ? (
          <p className="mt-2.5 text-[12.5px] leading-relaxed font-normal text-ink-soft">
            {idea.ai.thesis[0] ?? idea.ai.recommendationNote}
          </p>
        ) : (
          <AIUnavailable className="mt-2.5" detail="No model rationale was recorded for this thesis." />
        )}
      </section>

      <section className="card space-y-3.5 p-4 sm:p-5">
        {idea.ai ? (
          <RiskRewardMeter
            bare
            // For option theses the targets are premium targets, so the meter
            // must be anchored to the contract mark — measuring a $52 premium
            // target against a $495 underlying printed nonsense percentages.
            currentPrice={idea.option ? premium : price}
            upsideTarget={idea.ai.upsideTarget}
            downsideRisk={idea.ai.downsideRisk}
            riskRewardRatio={idea.ai.riskRewardRatio}
            horizon={idea.ai.horizon}
          />
        ) : null}

        <div className="border-t border-line pt-3.5">
        <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
            <div>
              <div className="mb-1.5 text-[9.5px] font-bold tracking-[0.07em] text-ink-muted uppercase">
                Underlying
              </div>
              <div className="num text-[22px] leading-none font-extrabold tracking-[-0.025em] text-ink">
                {formatMoney(price)}
              </div>
              <div className={`num mt-1.5 text-[12.5px] font-bold ${up ? 'text-up' : 'text-down'}`}>
                {formatSignedPercent(snap?.dayChangePct ?? 0)}{' '}
                <span className="font-medium text-ink-muted">today</span>
              </div>
            </div>
            {idea.option ? (
              <div>
                <div className="mb-1.5 text-[9.5px] font-bold tracking-[0.07em] text-ink-muted uppercase">
                  Mark
                </div>
                <div className="num text-[22px] leading-none font-extrabold tracking-[-0.025em] text-ink">
                  {formatMoney(premium)}
                </div>
                <div className="num mt-1.5 text-[12.5px] font-medium text-ink-muted">
                  per contract
                </div>
              </div>
            ) : null}
            <div>
              <div className="mb-1.5 text-[9.5px] font-bold tracking-[0.07em] text-ink-muted uppercase">
                Target range
              </div>
              <div className="num text-[22px] leading-none font-extrabold tracking-[-0.025em] text-up">
                {formatMoney(idea.targetLow)}–{formatMoney(idea.targetHigh)}
              </div>
              <div className="num mt-1.5 text-[12.5px] font-medium text-ink-muted">
                on the flip
              </div>
            </div>
          </div>

          {/* Conviction and the call sit in the hero above; repeating them here
              only pushed the numbers that matter further down the page. */}
          <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-line pt-3.5">
            {inEntryBand ? (
              <StaticPill tone="positive">Trading inside the entry band</StaticPill>
            ) : (
              <StaticPill tone="neutral">
                {price < idea.entryLow ? 'Below entry band' : 'Above entry band'}
              </StaticPill>
            )}
            {idea.tags.map((tag) => (
              <StaticPill key={tag} tone="muted">
                {tag}
              </StaticPill>
            ))}
          </div>
        </div>
      </section>

      <TradeIdeaCharts idea={idea} underlyingPrice={price} />

      {idea.option ? (
        <OptionContractDetails
          contract={idea.option}
          underlying={price}
          contracts={1}
          avgPremium={idea.entryHigh}
          mark={optionMark(idea.option, price)}
        />
      ) : null}

      {idea.ai ? (
        <section className="card relative overflow-hidden rounded-[24px] border-brand-400/20">
          <div className="ai-gradient absolute inset-x-0 top-0 h-[3px]" aria-hidden />
          <div className="ai-tint absolute inset-0" aria-hidden />
          <div className="relative p-4 sm:p-5">
            <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold tracking-[0.08em] text-brand-300 uppercase">
              <Sparkles size={13} />
              The thesis
            </h3>
            <p className="text-[14px] leading-relaxed font-semibold text-ink">
              {idea.ai.recommendationNote}
            </p>
            <ul className="mt-3 space-y-2.5">
              {idea.ai.thesis.map((bullet, i) => (
                <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed text-white/80">
                  <span
                    className="ai-gradient mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full"
                    aria-hidden
                  />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11.5px] text-ink-muted">
              Generated {relativeTime(idea.ai.updatedAt)}
            </p>
          </div>
        </section>
      ) : null}

      <div className="grid gap-3.5 sm:grid-cols-2">
        <section className="card p-4">
          <CatalystList items={idea.catalysts} />
        </section>
        <section className="card p-4">
          <RiskFactors items={idea.risks} />
        </section>
      </div>


      <RelatedNews symbol={idea.symbol} />

      {/* Same footer, buttons and chat mechanic as the home thesis tiles —
          one component so the two surfaces cannot drift apart. */}
      <ThesisTileFooter idea={idea} variant="page" onDecided={() => navigate('/app/thesis')} />
    </div>
  )
}
