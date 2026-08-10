import { useNavigate } from 'react-router-dom'
import { TrendingUp } from 'lucide-react'
import { formatMoney, formatPercent, relativeTime } from '@/lib/format'
import type { Idea } from '@/api/types'
import { usePrice } from '@/store/priceStore'
import { Sparkline } from '@/components/charts/Sparkline'
import { AIConvictionBadge } from '@/components/intelligence/AIConvictionBadge'
import { RecommendationChip } from '@/components/intelligence/TradeRecommendation'
import { EntryRange, TargetRange, CatalystList, RiskFactors, RangeStat } from '@/components/intelligence/Ranges'
import { StaticPill } from '@/components/shared/Pill'
import { OptionContractChips } from '@/components/positions/OptionContractDetails'
import { SymbolIcon } from '@/components/shared/SymbolIcon'

export function IdeaCard({ idea }: { idea: Idea }) {
  const navigate = useNavigate()
  const snap = usePrice(idea.symbol)
  const up = (snap?.dayChangePct ?? 0) >= 0
  const open = () => navigate(`/app/thesis/${idea.id}`)

  return (
    <article
      role="link"
      tabIndex={0}
      aria-label={`Open ${idea.symbol} trade thesis`}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          open()
        }
      }}
      className="glass-flat relative cursor-pointer overflow-hidden rounded-[22px] border-white/[0.09] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-white/[0.14] hover:shadow-[0_18px_46px_-22px_rgba(0,0,0,0.86),0_12px_30px_-24px_rgba(47,123,255,0.5)] focus:outline-none lg:card lg:rounded-[24px] lg:border-brand-400/15 lg:hover:border-brand-400/25"
    >
      <div className="ai-gradient absolute inset-x-0 top-0 hidden h-[3px] lg:block" aria-hidden />
      <span
        className="pointer-events-none absolute top-0 right-7 left-7 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent lg:hidden"
        aria-hidden
      />

      <div className="p-4 sm:p-[18px]">
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <SymbolIcon symbol={idea.symbol} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="text-[17px] leading-none font-extrabold tracking-[-0.02em] text-ink">
                  {idea.symbol}
                </h3>
                {idea.assetType === 'option' ? (
                  <span className="rounded bg-surface-sunken px-1.5 py-0.5 text-[10px] font-bold tracking-[0.05em] text-ink-muted uppercase">
                    Option
                  </span>
                ) : null}
                {idea.tags.slice(0, 2).map((tag) => (
                  <StaticPill key={tag} tone="muted">
                    {tag}
                  </StaticPill>
                ))}
              </div>
              <p className="mt-1 truncate text-[12.5px] text-ink-muted">{idea.company}</p>
              {idea.option && snap ? (
                <OptionContractChips
                  className="mt-1.5"
                  contract={idea.option}
                  underlying={snap.price}
                />
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <Sparkline
              data={snap?.history ?? []}
              tone={up ? 'up' : 'down'}
              width={72}
              height={30}
              className="hidden sm:block"
            />
            <div className="text-right">
              <div className="num text-[16px] leading-none font-extrabold text-ink">
                {formatMoney(snap?.price ?? idea.referencePrice)}
              </div>
              <div className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-bold text-up">
                <TrendingUp size={13} />
                {formatPercent(idea.expectedUpsidePct, 1)} upside
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-line pt-3.5">
          <AIConvictionBadge score={idea.ai.conviction} delta={idea.ai.convictionDelta} />
          <RecommendationChip recommendation={idea.ai.recommendation} />
          <span className="text-[11.5px] text-ink-muted">
            Updated {relativeTime(idea.ai.updatedAt)}
          </span>
        </div>

        <dl className="liquid-inset mt-3.5 grid grid-cols-2 gap-x-4 gap-y-3 rounded-[18px] p-3">
          <EntryRange low={idea.entryLow} high={idea.entryHigh} />
          <TargetRange low={idea.targetLow} high={idea.targetHigh} />
          <RangeStat
            label="Expected upside"
            value={formatPercent(idea.expectedUpsidePct, 1)}
            tone="up"
            hint="to mid-target"
          />
          <RangeStat label="Time horizon" value={idea.ai.horizon} hint="Thesis window" />
        </dl>

        <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
          <CatalystList items={idea.catalysts} />
          <RiskFactors items={idea.risks} />
        </div>
      </div>
    </article>
  )
}
