import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatMoney, formatPercent, formatSignedPercent } from '@/lib/format'
import type { Idea } from '@/api/types'
import { usePrice } from '@/store/priceStore'
import { Sparkline } from '@/components/charts/Sparkline'
import { MINI_CHART_HEIGHT } from '@/components/charts/PositionMiniChart'
import { ThesisConeChart } from '@/components/charts/ThesisConeChart'
import {
  PremiumLeverageChart,
  PREMIUM_LEVERAGE_HEIGHT,
} from '@/components/charts/PremiumLeverageChart'
import { ThesisScenarioLadder } from '@/components/thesis/ThesisScenarioLadder'
import { ThesisTileFooter } from '@/components/thesis/ThesisTileFooter'
import { AIConvictionBadge } from '@/components/intelligence/AIConvictionBadge'
import { RecommendationChip } from '@/components/intelligence/TradeRecommendation'
import { TileShell, TileStat } from '@/components/shared/TileShell'
import {
  OptionContractBadges,
  OptionContractChips,
} from '@/components/positions/OptionContractDetails'
import { SymbolIcon } from '@/components/shared/SymbolIcon'
import { ThesisRail, thesisPages } from '@/components/thesis/ThesisRail'
import { ThesisStatsPanel } from '@/components/thesis/ThesisStatsPanel'
import { StudyBadge, ThesisStatSettings } from '@/components/thesis/ThesisStatSettings'
import { StudyTip } from '@/components/shared/StudyTip'
import { thesisAnalytics } from '@/lib/thesisAnalytics'

/** AI trade recommendation tile for the home carousel. */
export function RecTile({ idea }: { idea: Idea }) {
  const navigate = useNavigate()
  const snap = usePrice(idea.symbol)
  const to = `/app/thesis/${idea.id}`
  const up = (snap?.dayChangePct ?? 0) >= 0
  const spot = snap?.price ?? idea.referencePrice
  const [page, setPage] = useState(0)
  const [studiesOpen, setStudiesOpen] = useState(false)

  const history = useMemo(() => snap?.history ?? [], [snap?.history])
  const analytics = useMemo(
    () => thesisAnalytics(idea, spot, history),
    [idea, spot, history],
  )
  const pages = useMemo(() => thesisPages(idea, analytics), [idea, analytics])
  const stepPage = (delta: number) =>
    setPage((current) => (current + delta + pages.length) % pages.length)

  // The premium target expressed as an underlying level, so the cone, the
  // target band and the break-even line all live on one price axis.
  const strike = idea.option?.strike ?? spot
  const put = idea.option?.right === 'PUT'
  const targetLevel = (premium: number) => (put ? strike - premium : strike + premium)

  // The rail clamps to whatever the chart column actually is: one chart for
  // shares, two plus their gap for a contract.
  const railHeight = idea.option
    ? MINI_CHART_HEIGHT + 4 + PREMIUM_LEVERAGE_HEIGHT
    : MINI_CHART_HEIGHT

  return (
    <>
      <TileShell
        className="trade-thesis-tile"
        accent="ai"
        onActivate={() => navigate(to)}
        ariaLabel={`${idea.symbol} AI recommendation details`}
      >
        {/* ---------- Header: matches the position tile ---------- */}
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            <SymbolIcon symbol={idea.symbol} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-start gap-2">
                <span className="-mt-[1.5mm] min-w-0 self-center truncate text-[17px] leading-none font-extrabold tracking-[-0.02em] text-ink">
                  {idea.symbol}
                </span>
                {idea.option ? (
                  <OptionContractBadges
                    contract={idea.option}
                    className="-mt-px shrink-0 flex-col items-start gap-px lg:hidden"
                  />
                ) : null}
              </div>
              <p className="mt-1 hidden truncate text-[11.5px] text-ink-muted lg:block">
                {idea.company}
              </p>
              {idea.option && snap ? (
                <OptionContractChips
                  className="mt-1.5 hidden flex-nowrap lg:flex"
                  contract={idea.option}
                  underlying={snap.price}
                />
              ) : null}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="num text-[16px] leading-none font-extrabold tracking-[-0.02em] text-ink">
              {formatMoney(spot)}
            </div>
            <div
              className={cn(
                'num mt-0.5 inline-flex items-center gap-1 text-[11.5px] font-bold lg:mt-1',
                up ? 'text-up' : 'text-down',
              )}
            >
              <TrendingUp size={12} />
              {formatPercent(idea.expectedUpsidePct, 1)}
            </div>
          </div>
        </div>

        {/* ---------- Mobile: cone chart beside the thesis pager ---------- */}
        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_114px] items-stretch gap-0 lg:block">
          <div className="min-w-0 lg:hidden">
            <ThesisConeChart
              symbol={idea.symbol}
              watermark={idea.company}
              input={{
                history,
                spot,
                volatility: analytics.iv / 100,
                years: analytics.years,
                breakeven: analytics.breakeven,
                entryLow: idea.entryLow,
                entryHigh: idea.entryHigh,
                targetLow: targetLevel(idea.targetLow),
                targetHigh: targetLevel(idea.targetHigh),
              }}
            />
            {idea.option ? (
              <PremiumLeverageChart
                className="mt-1"
                input={{
                  spot,
                  strike: idea.option.strike,
                  right: idea.option.right,
                  volatility: analytics.iv / 100,
                  years: analytics.years,
                  debit: analytics.debit,
                  targetUnderlying: targetLevel(analytics.targetPremium),
                  breakeven: analytics.breakeven,
                }}
              />
            ) : null}
          </div>

          <aside className="min-w-0 border-l border-line pl-2.5 lg:hidden" aria-label="Trade thesis">
            <ThesisRail
              idea={idea}
              pages={pages}
              index={page}
              onStep={stepPage}
              collapsedHeight={railHeight}
              trailing={
                <RecommendationChip
                  recommendation={idea.ai.recommendation}
                  className="px-1.5 py-px text-[9px]"
                />
              }
            />
          </aside>

          <Sparkline
            data={history}
            tone={up ? 'up' : 'down'}
            width={300}
            height={42}
            className="hidden w-full lg:block"
          />
        </div>

        <div className="mt-2.5 hidden flex-wrap items-center gap-1.5 lg:flex">
          <AIConvictionBadge
            score={idea.ai.conviction}
            delta={idea.ai.convictionDelta}
            size="sm"
          />
          <RecommendationChip recommendation={idea.ai.recommendation} />
        </div>

        {/* ---------- Mobile: trade economics beside the quant rail ---------- */}
        <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_114px] border-t border-line pt-1.5 lg:hidden">
          <div className="min-w-0">
            <dl className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1.18fr)] divide-x divide-line/70">
              <ThesisStat
                label={idea.option ? 'Option' : 'Shares'}
                value={
                  idea.option
                    ? `$${idea.option.strike} ${idea.option.right}`
                    : idea.company.split(' ')[0]
                }
                sub={idea.option?.expiryLabel ?? idea.ai.horizon}
                subEmphasis
                first
              />
              <ThesisStat
                label="Qty"
                // Signed like a position's quantity: long premium opens with a buy.
                value={`+ ${analytics.contracts}`}
                sub={idea.option ? undefined : 'shares'}
                align="right"
              />
            </dl>

            <dl className="mt-1 grid grid-cols-[minmax(0,1fr)_minmax(0,1.18fr)] items-stretch divide-x divide-line/70 border-t border-line/70 pt-1">
              <ThesisStat
                label="Debit"
                value={formatMoney(analytics.netDebit, { whole: true })}
                sub={formatMoney(analytics.debit)}
                subLabel="Avg"
                reserveInline
                first
              />
              <ThesisStat
                label="Target"
                value={formatMoney(analytics.targetValue, { whole: true })}
                lead={formatSignedPercent(analytics.rMultiple * 100, 0)}
                inline={`+${formatMoney(analytics.targetProfit, { whole: true })}`}
                sub={formatMoney(analytics.targetPremium)}
                subLabel="Mid"
                tone="up"
                align="right"
              />
            </dl>
          </div>

          <div className="relative -mt-1.5 flex min-w-0 flex-col border-l border-line/70 pt-1.5 pl-1.5">
            <ThesisStatsPanel analytics={analytics} className="-mt-1.5 w-full min-w-0" />
            <button
              type="button"
              aria-label="Choose studies"
              onClick={(event) => {
                event.stopPropagation()
                setStudiesOpen(true)
              }}
              className="absolute -right-[calc(0.25rem+0.5mm)] -bottom-[calc(0.75rem-1.75mm)] shrink-0 transition-transform active:scale-95"
            >
              <StudyTip />
              <StudyBadge size={22} />
            </button>
          </div>
        </div>

        {idea.option ? (
          <ThesisScenarioLadder
            contract={idea.option}
            analytics={analytics}
            className="mt-2 border-t border-line pt-1.5 lg:hidden"
          />
        ) : null}

        {/* Keeps the banner off the scenario ladder when the tile is full. */}
        <div className="h-[1mm] shrink-0 lg:hidden" aria-hidden />
        <ThesisTileFooter idea={idea} />

        {/* ---------- Desktop keeps the compact three-stat strip ---------- */}
        <dl className="mt-2.5 hidden grid-cols-3 gap-2 border-t border-line pt-2.5 lg:grid">
          <TileStat
            label="Entry"
            value={formatMoney(idea.entryLow, { whole: idea.entryLow > 100 })}
            hint={`to ${formatMoney(idea.entryHigh, { whole: idea.entryHigh > 100 })}`}
          />
          <TileStat
            label="Target"
            value={formatMoney(idea.targetLow, { whole: idea.targetLow > 100 })}
            hint={`to ${formatMoney(idea.targetHigh, { whole: idea.targetHigh > 100 })}`}
            tone="up"
          />
          <TileStat
            label="Horizon"
            value={idea.ai.horizon.split(' ')[0]}
            hint={idea.ai.horizon.split(' ').slice(1).join(' ') || 'window'}
          />
        </dl>
      </TileShell>

      <ThesisStatSettings open={studiesOpen} onOpenChange={setStudiesOpen} />
    </>
  )
}

/** Same cell treatment as the position tile's stat rows. */
function ThesisStat({
  label,
  value,
  lead,
  inline,
  sub,
  subLabel,
  subEmphasis,
  reserveInline,
  tone,
  align = 'left',
  first,
}: {
  label: string
  value: string
  /** Small figure pinned to the cell's left on the inline row. */
  lead?: string
  /** Secondary figure beneath the value. */
  inline?: string
  sub?: string
  subLabel?: string
  /** Renders the sub-line at the value's size, for a two-part identity. */
  subEmphasis?: boolean
  /** Holds an empty inline row so this cell's sub-line matches a sibling's. */
  reserveInline?: boolean
  tone?: 'up' | 'down'
  align?: 'left' | 'right'
  first?: boolean
}) {
  return (
    <div className="flex min-w-0 flex-col pr-1.5 text-right not-first:pl-1.5">
      <dt
        className={cn(
          '-mt-1.5 bg-white/[0.045] px-1 pt-1.5 pb-px text-right text-[7.5px] font-bold tracking-[0.07em] text-ink-muted uppercase',
          first ? '-mr-1.5' : '-mr-1.5 -ml-1.5',
          align === 'right' && !first && '-mr-1.5 -ml-1.5',
        )}
      >
        {label}
      </dt>
      <dd className="num mt-px flex items-baseline justify-end gap-0.5 truncate text-[10.5px] font-medium tracking-[0.005em] text-ink">
        {value}
      </dd>
      {inline || reserveInline ? (
        <dd
          aria-hidden={inline ? undefined : true}
          className={cn(
            'num flex items-baseline justify-end gap-1 text-[10.2px] leading-tight font-medium',
            tone === 'up' && 'text-[#5df2b6]',
            tone === 'down' && 'text-[#ff9aad]',
          )}
        >
          {lead ? (
            <span className="mr-auto ml-[2mm] shrink-0 text-[9.1px] font-semibold tracking-[0.01em]">
              {lead}
            </span>
        ) : null}
        {inline ?? '\u00A0'}
      </dd>
      ) : null}
      {sub ? (
        <dd className="mt-px flex min-w-0 items-center justify-end gap-1">
          {subLabel ? (
            <span className="shrink-0 text-[7px] leading-none font-bold tracking-[0.06em] text-ink-muted uppercase">
              {subLabel}:
            </span>
          ) : null}
          <span
            className={cn(
              'num truncate font-medium tracking-[0.005em]',
              subEmphasis ? 'text-[10.5px] text-ink' : 'text-[9px]',
              !subEmphasis &&
                (tone === 'up' ? 'text-[#5df2b6]' : tone === 'down' ? 'text-[#ff9aad]' : 'text-ink-muted'),
            )}
          >
            {sub}
          </span>
        </dd>
      ) : null}
    </div>
  )
}

