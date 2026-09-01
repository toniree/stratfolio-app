import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useUiStore } from '@/store/uiStore'
import { useThesisDecisionStore } from '@/store/thesisDecisionStore'
import { usePrices } from '@/store/priceStore'
import {
  useIdeas,
  useActivity,
  usePerformance,
  usePlannerIdeas,
  usePortfolioMeta,
  usePortfolioOutlook,
  usePositions,
} from '@/hooks/queries'
import { computeTotals } from '@/lib/portfolioMath'
import { hasLiveDomain } from '@/api/http/env'
import type { PerformancePeriod } from '@/api/types'
import { PeriodSelector } from '@/components/portfolio/PeriodSelector'
import { PerformanceChart } from '@/components/charts/PerformanceChart'
import { MetricWidgets } from '@/components/portfolio/MetricWidget'
import {
  PortfolioChartPanel,
  PortfolioValueWidget,
} from '@/components/portfolio/PortfolioValueWidget'
import { AIOutlookPanel, MobileAIInsights } from '@/components/portfolio/AIOutlookPanel'
import { BrokerageFilter } from '@/components/portfolio/BrokerageFilter'
import { HoldingsTable } from '@/components/positions/HoldingsTable'
import { Carousel, CarouselItem } from '@/components/shared/Carousel'
import { PositionTile } from '@/components/positions/PositionTile'
import { RecTile } from '@/components/thesis/RecTile'
import { UpcomingTradePlans } from '@/components/plan/UpcomingTradePlans'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatSignedMoney, formatSignedPercent } from '@/lib/format'
import { CompactAITradingToggle } from '@/components/shell/AITradingControl'
import { ThesisSparklesIcon } from '@/components/thesis/ThesisSparklesIcon'
import { TerminalChart } from '@/components/terminal/TerminalChart'

/**
 * Row 1 is a full-width metrics strip led by a compact portfolio-value widget
 * that expands to reveal the full performance chart. Row 2 puts Your Positions
 * beside the AI Outlook panel. Mobile keeps the carousel home.
 */
export function PortfolioPage() {
  const accountId = useUiStore((s) => s.accountId)
  const brokerageFilter = useUiStore((s) => s.brokerageFilter)
  const [period, setPeriod] = useState<PerformancePeriod>('1D')
  const [chartOpen, setChartOpen] = useState(false)

  const prices = usePrices()
  const { data: positions, isLoading } = usePositions(accountId)
  const { data: meta } = usePortfolioMeta(accountId)
  const { data: outlook, isLoading: outlookLoading, refetch: refetchOutlook } =
    usePortfolioOutlook(accountId)
  const { data: performance } = usePerformance(accountId, period)
  const { data: ideas, isLoading: ideasLoading } = useIdeas()
  const { data: plannerIdeas, isLoading: plannerLoading } = usePlannerIdeas()
  const { data: activity } = useActivity()
  const thesisDecisions = useThesisDecisionStore((s) => s.decisions)

  const totals = useMemo(() => computeTotals(positions ?? [], prices), [positions, prices])
  const allSimulated = !hasLiveDomain()

  const counts = useMemo(() => {
    const result: Record<string, number> = {}
    for (const p of positions ?? []) {
      // Live positions carry no brokerage (one paper portfolio, HKP-PLT-6).
      if (!p.brokerageId) continue
      result[p.brokerageId] = (result[p.brokerageId] ?? 0) + 1
    }
    return result
  }, [positions])

  const visible = useMemo(() => {
    const filtered =
      brokerageFilter === 'all'
        ? totals.valuations
        : totals.valuations.filter((v) => v.position.brokerageId === brokerageFilter)
    return filtered.slice().sort((a, b) => b.marketValue - a.marketValue)
  }, [totals.valuations, brokerageFilter])

  // The mobile demo leads with the largest holding, then the time-sensitive
  // Walmart earnings position. Desktop remains strictly market-value ranked.
  const mobileVisible = useMemo(() => {
    const ordered = [...visible]
    const walmartIndex = ordered.findIndex((valuation) => valuation.position.id === 'pos-wmt-sep')
    if (walmartIndex > 1) {
      const [walmart] = ordered.splice(walmartIndex, 1)
      ordered.splice(1, 0, walmart)
    }
    return ordered
  }, [visible])

  const periodStartMultiplier = performance?.points[0]?.multiplier ?? 1
  const periodStartValue = totals.marketValue * periodStartMultiplier
  const periodReturn = period === '1D' ? totals.dayPl : totals.marketValue - periodStartValue
  const periodReturnPct =
    period === '1D'
      ? totals.dayPlPct
      : periodStartValue > 0
        ? ((totals.marketValue - periodStartValue) / periodStartValue) * 100
        : 0
  const positive = periodReturn >= 0

  const heroSpark =
    totals.valuations.slice().sort((a, b) => b.marketValue - a.marketValue)[0]?.history ?? []

  const topRecs = useMemo(
    () => (ideas ?? []).filter((idea) => !thesisDecisions[idea.id]).slice(0, 10),
    [ideas, thesisDecisions],
  )

  const metricsStrip = (
    <MetricWidgets
      totals={totals}
      meta={meta}
      loading={isLoading}
      portfolioSlot={
        <PortfolioValueWidget
          marketValue={totals.marketValue}
          dayPl={totals.dayPl}
          dayPlPct={totals.dayPlPct}
          spark={heroSpark}
          expanded={chartOpen}
          onToggle={() => setChartOpen((v) => !v)}
        />
      }
    />
  )

  const chartPanel = (
    <PortfolioChartPanel expanded={chartOpen}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold tracking-[0.08em] text-ink-muted uppercase">
            Performance
          </div>
          <div
            className={`num mt-1 text-[15px] font-bold ${positive ? 'text-up' : 'text-down'}`}
          >
            {formatSignedMoney(periodReturn)} ({formatSignedPercent(periodReturnPct)}){' '}
            <span className="font-medium text-ink-muted">
              {period === '1D' ? 'today' : `over ${period}`}
            </span>
          </div>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} positive={positive} />
      </div>
      <div className="mt-3">
        {performance && totals.marketValue > 0 ? (
          <>
            <PerformanceChart
              series={performance}
              currentValue={totals.marketValue}
              positive={positive}
              height={260}
            />
            {/* The chart says what it is drawing. A settled-equity curve is
                realised P&L from closed trades, not the marked book. */}
            <p className="mt-1.5 text-center text-[10.5px] text-ink-muted">
              {performance.label}
              {performance.truncated
                ? ' · older history is missing (plt caps lists at 500 rows)'
                : ''}
            </p>
          </>
        ) : (
          <Skeleton className="h-[260px] rounded-2xl" />
        )}
      </div>
    </PortfolioChartPanel>
  )

  return (
    <div className="space-y-4 lg:space-y-5">
      {/* ---------- Row 1: metrics strip (+ expandable chart) ---------- */}
      {metricsStrip}
      {chartPanel}

      {/* ---------- Row 2: the trading terminal ----------
          Left: the big multi-study chart over the holdings blotter — the two
          surfaces a trader lives in. Right: everything the AI is watching for
          you — plans about to execute, the portfolio outlook, fresh theses. */}
      <div className="hidden lg:grid lg:grid-cols-12 lg:items-start lg:gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="col-span-12 min-w-0 space-y-4 xl:col-auto">
          <TerminalChart />

          <div className="space-y-3">
            <BrokerageFilter counts={counts} />
            <HoldingsTable
              valuations={visible}
              loading={isLoading}
              totalMarketValue={totals.marketValue}
            />
          </div>
        </div>

        <div className="col-span-12 min-w-0 space-y-4 xl:col-auto">
          <UpcomingTradePlans
            plans={plannerIdeas ?? []}
            valuations={totals.valuations}
            portfolioValue={totals.marketValue}
            loading={plannerLoading || isLoading}
          />

          <AIOutlookPanel
            outlook={outlook}
            valuations={totals.valuations}
            activity={activity}
            plans={plannerIdeas}
            loading={outlookLoading || isLoading}
            className="h-[440px]"
            onRefresh={() => refetchOutlook()}
          />

          <section aria-label="Trade theses" className="space-y-2.5">
            <div className="flex items-baseline justify-between px-0.5">
              <span className="flex items-center gap-1.5 text-[11px] font-extrabold tracking-[0.075em] text-ink-soft uppercase">
                <ThesisSparklesIcon />
                Trade Theses
              </span>
              <Link
                to="/app/thesis"
                className="text-[11px] font-bold text-brand-300 transition-colors hover:text-brand-200"
              >
                See all
              </Link>
            </div>
            {ideasLoading ? (
              <Skeleton className="h-[268px] rounded-[18px]" />
            ) : (
              <div className="space-y-3">
                {topRecs.slice(0, 3).map((idea) => (
                  <RecTile key={idea.id} idea={idea} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* ---------- Mobile: carousel home ---------- */}
      <div className="relative -mt-[calc(0.5rem+2mm)] space-y-3 lg:hidden">
        <CompactAITradingToggle />

        <UpcomingTradePlans
          plans={plannerIdeas ?? []}
          valuations={totals.valuations}
          portfolioValue={totals.marketValue}
          loading={plannerLoading || isLoading}
        />

        <div className="space-y-2.5">
          <Carousel
            title="Positions"
            titleIcon={<PositionsTrendIcon />}
            titleClassName="text-[10px] font-extrabold tracking-[0.075em] text-ink-soft uppercase sm:text-[10px]"
            showPosition
            seeAllTo="/app/positions"
            itemCount={isLoading ? 3 : mobileVisible.length}
            empty={<EmptyRow title="No contracts match this brokerage" />}
          >
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <CarouselItem key={i}>
                    <Skeleton className="h-[268px] rounded-[18px]" />
                  </CarouselItem>
                ))
              : mobileVisible.map((valuation) => (
                  <CarouselItem key={valuation.position.id}>
                    <PositionTile valuation={valuation} />
                  </CarouselItem>
                ))}
          </Carousel>
        </div>

        <Carousel
          title="Trade Theses"
          titleIcon={<ThesisSparklesIcon />}
          titleClassName="text-[10px] font-extrabold tracking-[0.075em] text-ink-soft uppercase sm:text-[10px]"
          subtitle={<ThesisResearchTicker />}
          seeAllTo="/app/thesis"
          itemCount={ideasLoading ? 3 : topRecs.length}
          empty={<EmptyRow title="No new theses right now" />}
        >
          {ideasLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <CarouselItem key={i}>
                  <Skeleton className="h-[268px] rounded-[18px]" />
                </CarouselItem>
              ))
            : topRecs.map((idea) => (
                <CarouselItem key={idea.id}>
                  <RecTile idea={idea} />
                </CarouselItem>
              ))}
        </Carousel>

        <MobileAIInsights
          outlook={outlook}
          valuations={totals.valuations}
          activity={activity}
          plans={plannerIdeas}
          loading={outlookLoading || isLoading}
          onRefresh={() => refetchOutlook()}
        />
      </div>

      {/* D10: the blanket "everything is simulated" claim is false the moment
          any domain goes live — it would mislabel a real plt portfolio as
          simulated and let the still-mocked panels hide behind it. Provenance
          now lives on the panels (`ProvenanceTag`); this line survives only
          for a fully mocked build. */}
      {allSimulated ? (
        <p className="pt-1 pb-2 text-center text-[10.9px] text-[#5b6673]">
          Every price, position and AI output in this build is simulated.{' '}
          <Link to="/app/profile" className="font-semibold text-brand-300/70">
            About this demo
          </Link>
        </p>
      ) : (
        <p className="pt-1 pb-2 text-center text-[10.9px] text-[#5b6673]">
          Some panels are live and some are simulated — each says which.{' '}
          <Link to="/app/profile" className="font-semibold text-brand-300/70">
            About this build
          </Link>
        </p>
      )}
    </div>
  )
}

function EmptyRow({ title }: { title: string }) {
  return (
    <div className="card px-5 py-9 text-center">
      <p className="text-[14.5px] font-bold text-ink">{title}</p>
    </div>
  )
}

function PositionsTrendIcon() {
  const arrowPath = 'M2.2 12.8 6.1 8.9l2.7 2.7 4.9-5'
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-[15px] w-[15px] text-brand-300/80"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={arrowPath} opacity="0.58" />
      <path d="M10.4 6.6h3.3v3.3" opacity="0.58" />
      <path className="positions-trend-highlight" d={arrowPath} />
      <path className="positions-trend-tip" d="M10.4 6.6h3.3v3.3" />
    </svg>
  )
}

function ThesisResearchTicker() {
  const copy = 'AI news research and reasoning, ready for your judgment before defining it into a trade plan.'
  return (
    <div className="max-w-[270px] overflow-hidden sm:max-w-[420px]">
      <div className="min-w-0 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_5%,black_92%,transparent)]">
        <div className="thesis-research-track flex w-max whitespace-nowrap text-[9.5px] font-medium">
          <span className="section-gloss-text pr-10">{copy}</span>
          <span className="section-gloss-text pr-10" aria-hidden>{copy}</span>
        </div>
      </div>
    </div>
  )
}
