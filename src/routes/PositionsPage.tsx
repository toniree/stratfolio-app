import { useMemo, useState } from 'react'
import { useUiStore } from '@/store/uiStore'
import { usePrices } from '@/store/priceStore'
import { usePerformance, usePortfolioMeta, usePositions } from '@/hooks/queries'
import { computeTotals } from '@/lib/portfolioMath'
import { useOptionMarks } from '@/hooks/marketQueries'
import { dayPlOver } from '@/lib/dayChange'
import { BrokerageFilter } from '@/components/portfolio/BrokerageFilter'
import { PositionList } from '@/components/positions/PositionList'
import {
  MobileHoldingsTable,
  MobilePositionsSummary,
} from '@/components/positions/MobileHoldingsTable'
import { PageHeader } from '@/components/shared/PageHeader'
import { BROKERAGES } from '@/data/brokerages'
import { BrokerageLogo } from '@/components/shared/BrokerageBadge'
import type { PerformancePeriod } from '@/api/types'

/** "See all" destination: compact table on mobile, full-depth cards on desktop. */
export function PositionsPage() {
  const accountId = useUiStore((s) => s.accountId)
  const brokerageFilter = useUiStore((s) => s.brokerageFilter)
  const [summaryPeriod, setSummaryPeriod] = useState<PerformancePeriod>('ALL')
  const prices = usePrices()
  const { data: positions, isLoading } = usePositions(accountId)
  const { data: meta } = usePortfolioMeta(accountId)
  const { data: performance } = usePerformance(accountId, summaryPeriod)

  const { marks } = useOptionMarks(positions)
  const totals = useMemo(
    () => computeTotals(positions ?? [], prices, marks),
    [positions, prices, marks],
  )

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

  const visibleValue = visible.reduce((s, v) => s + v.marketValue, 0)
  // Availability is a property of the *filtered* set: a brokerage view can be
  // fully measurable while the whole book is not, and vice versa.
  const visibleDay = dayPlOver(visible)
  const visibleDayPl = visible.reduce((s, v) => s + v.dayPl, 0)
  const visibleTotalPl = visible.reduce((s, v) => s + v.totalReturn, 0)
  const visibleCostBasis = visible.reduce((s, v) => s + v.costBasis, 0)
  const visibleTotalPlPct = visibleCostBasis > 0 ? (visibleTotalPl / visibleCostBasis) * 100 : 0
  const visiblePreviousValue = visibleValue - visibleDayPl
  const visibleDayPlPct =
    visiblePreviousValue > 0 ? (visibleDayPl / visiblePreviousValue) * 100 : 0
  const selectedBrokerage =
    brokerageFilter === 'all'
      ? undefined
      : BROKERAGES.find((brokerage) => brokerage.id === brokerageFilter)
  const selectedBrokerageName = selectedBrokerage?.name ?? 'ALL ACCOUNTS'

  return (
    <div className="space-y-4">
      <PageHeader
        backTo="/app/portfolio"
        backLabel=""
        title="Positions"
        mobileTitle={
          <>
            {selectedBrokerage ? <BrokerageLogo id={selectedBrokerage.id} size="xs" /> : null}
            {selectedBrokerageName}
          </>
        }
        mobileSubtitle="Use the header brokerage dropdown to view positions by broker."
        aside={
          <span
            title={visibleDay.title}
            aria-label={visibleDay.accessible}
            className={`num hidden text-[14px] font-bold lg:inline ${
              visibleDay.tone === 'up'
                ? 'text-up'
                : visibleDay.tone === 'down'
                  ? 'text-down'
                  : 'text-ink-muted'
            }`}
          >
            {visibleDay.available ? `${visibleDay.combined} today` : '— today'}
          </span>
        }
      />

      <div className="hidden lg:block">
        <BrokerageFilter counts={counts} />
      </div>

      <div className="space-y-3 lg:hidden">
        <MobilePositionsSummary
          marketValue={visibleValue}
          totalPl={visibleTotalPl}
          totalPlPct={visibleTotalPlPct}
          dayPl={visibleDayPl}
          dayPlPct={visibleDayPlPct}
          dayPlAvailable={visibleDay.available}
          cash={meta?.cash ?? 0}
          performance={performance}
          period={summaryPeriod}
          onPeriodChange={setSummaryPeriod}
        />
        <MobileHoldingsTable valuations={visible} loading={isLoading} />
      </div>

      <div className="hidden lg:block">
        <PositionList valuations={visible} loading={isLoading} />
      </div>
    </div>
  )
}
