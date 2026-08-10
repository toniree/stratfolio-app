import { useEffect, useMemo, useRef } from 'react'
import {
  BaselineSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  LineStyle,
  type AutoscaleInfo,
  type IChartApi,
  type SeriesMarker,
  type UTCTimestamp,
} from 'lightweight-charts'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { formatMoney, formatSignedMoney, formatSignedPercent } from '@/lib/format'
import type { PositionValuation } from '@/lib/portfolioMath'
import { usePrice } from '@/store/priceStore'
import { optionPremiumHistory, underlyingHistory } from '@/lib/optionHistory'
import { breakeven, estimateOptionExit } from '@/lib/optionMath'
import { Button } from '@/components/ui/Button'

export interface MarketChartReferenceLine {
  price: number
  color: string
  title: string
  dashed?: boolean
}

/**
 * The inline quick look revealed when a holdings row is expanded.
 *
 * Two charts: the underlying ticking live off the simulator, and the
 * contract's own premium history derived by running that same underlying path
 * through the option model. Entry and estimated exit levels are drawn as
 * labeled reference lines, with total profit at each edge of the exit zone.
 */
export function PositionQuickView({
  valuation,
  showDetailsLink = true,
  showRecommendation = true,
}: {
  valuation: PositionValuation
  showDetailsLink?: boolean
  showRecommendation?: boolean
}) {
  const { position, price, underlyingPrice } = valuation
  const snap = usePrice(position.symbol)
  const contract = position.option
  const ai = position.ai
  const entryDate = formatEntryDate(position.openedAt)
  const historyDays = useMemo(() => {
    const ageDays = Math.ceil(
      Math.max(0, Date.now() - new Date(position.openedAt).getTime()) / 86_400_000,
    )
    return Math.max(21, Math.min(365, ageDays + 3))
  }, [position.openedAt])

  const underlyingSeries = useMemo(
    () => underlyingHistory(position.symbol, underlyingPrice, historyDays),
    [historyDays, position.symbol, underlyingPrice],
  )
  const premiumSeries = useMemo(
    () =>
      contract
        ? optionPremiumHistory(contract, position.symbol, underlyingPrice, historyDays)
        : [],
    [contract, historyDays, position.symbol, underlyingPrice],
  )
  const exit = useMemo(
    () => estimateOptionExit(position.avgCost, ai.targetLow, ai.targetHigh, position.quantity),
    [ai.targetHigh, ai.targetLow, position.avgCost, position.quantity],
  )

  // Underlying reference levels: the strike, and the breakeven at expiry.
  const underlyingLines = useMemo<MarketChartReferenceLine[]>(
    () =>
      contract
        ? [
            { price: contract.strike, color: '#5ba6ff', title: `Strike $${contract.strike}` },
            {
              price: breakeven(contract, position.avgCost),
              color: '#e0a33c',
              title: `Breakeven ${formatMoney(breakeven(contract, position.avgCost))}`,
              dashed: true,
            },
          ]
        : [],
    [contract, position.avgCost],
  )

  // Premium reference levels define the complete estimated exit zone and show
  // the total position profit at both edges, including the 100x multiplier.
  const premiumLines = useMemo<MarketChartReferenceLine[]>(
    () => [
      {
        price: exit.exitLow,
        color: '#34d399',
        title: `Exit low ${formatMoney(exit.exitLow)} · ${formatSignedMoney(exit.profitLow)}`,
        dashed: true,
      },
      {
        price: exit.exitHigh,
        color: '#34d399',
        title: `Exit high ${formatMoney(exit.exitHigh)} · ${formatSignedMoney(exit.profitHigh)}`,
      },
      {
        price: position.avgCost,
        color: '#c4cfdd',
        title: `Entry ${entryDate} · ${formatMoney(position.avgCost)}`,
        dashed: true,
      },
    ],
    [entryDate, exit, position.avgCost],
  )

  const premiumMarkers = useMemo<SeriesMarker<UTCTimestamp>[]>(() => {
    const entryTime = closestTime(premiumSeries, position.openedAt)
    if (!entryTime) return []
    return [
      {
        id: 'entry',
        time: entryTime,
        position: 'atPriceTop',
        price: position.avgCost,
        shape: 'circle',
        color: '#f4f7fb',
        text: `Opened ${entryDate} @ ${formatMoney(position.avgCost)}`,
        size: 1.2,
      },
    ]
  }, [entryDate, position.avgCost, position.openedAt, premiumSeries])

  return (
    <div className="grid gap-4 px-4 pt-1 pb-4 sm:px-5 lg:grid-cols-2">
      <MarketChartBlock
        title={`${position.symbol} underlying · live`}
        subtitle={`${formatMoney(snap?.price ?? underlyingPrice)} now`}
        data={underlyingSeries.map((p) => ({ time: p.time as UTCTimestamp, value: p.value }))}
        liveValue={snap?.price}
        lines={underlyingLines}
        referenceValue={underlyingSeries[0]?.value}
        tone="brand"
      />

      <MarketChartBlock
        title={`Contract premium · ${historyDays} days`}
        subtitle={`${formatMoney(price)} mark · opened ${entryDate} @ ${formatMoney(position.avgCost)}`}
        data={premiumSeries.map((p) => ({ time: p.time as UTCTimestamp, value: p.value }))}
        lines={premiumLines}
        markers={premiumMarkers}
        referenceValue={position.avgCost}
        tone={price >= position.avgCost ? 'up' : 'down'}
      />

      <dl className="grid gap-2.5 sm:grid-cols-3 lg:col-span-2">
        <PlanStat
          label="Position entry"
          value={`${entryDate} · ${formatMoney(position.avgCost)}`}
          hint={`${position.quantity} contracts · ${formatMoney(position.avgCost * position.quantity * 100)} cost`}
        />
        <PlanStat
          label="Estimated exit zone"
          value={`${formatMoney(exit.exitLow)} – ${formatMoney(exit.exitHigh)}`}
          hint="Per-contract premium"
        />
        <PlanStat
          label="Estimated profit"
          value={`${formatSignedMoney(exit.profitLow)} – ${formatSignedMoney(exit.profitHigh)}`}
          hint={`${formatSignedPercent(exit.returnLowPct, 1)} – ${formatSignedPercent(exit.returnHighPct, 1)} on cost`}
          tone="up"
        />
      </dl>

      {showRecommendation || showDetailsLink ? (
        <div className="lg:col-span-2">
          {showRecommendation ? (
            <p className="text-[12.5px] leading-relaxed text-ink-soft">
              {ai.recommendationNote}
            </p>
          ) : null}
          {showDetailsLink ? (
            <div className={cn('flex flex-wrap gap-2', showRecommendation && 'mt-3')}>
              <Button asChild size="sm" variant="secondary">
                <Link to={`/app/positions/${position.id}`}>Open full details</Link>
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function MarketChartBlock({
  title,
  subtitle,
  data,
  lines,
  tone,
  liveValue,
  markers = [],
  referenceValue,
}: {
  title: string
  subtitle: string
  data: { time: UTCTimestamp; value: number }[]
  lines: MarketChartReferenceLine[]
  tone: 'brand' | 'up' | 'down'
  liveValue?: number
  markers?: SeriesMarker<UTCTimestamp>[]
  referenceValue?: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ReturnType<IChartApi['addSeries']> | null>(null)

  const markerColor = tone === 'down' ? '#f3a6b5' : '#5ba6ff'

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const chart = createChart(container, {
      height: 150,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#8d99a8',
        fontFamily:
          "'Inter var','Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
        fontSize: 10,
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: 'rgba(255,255,255,0.05)' },
      },
      rightPriceScale: {
        visible: true,
        borderVisible: false,
        scaleMargins: { top: 0.18, bottom: 0.12 },
      },
      leftPriceScale: { visible: false },
      timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true },
      crosshair: {
        vertLine: { color: 'rgba(91,166,255,0.4)', style: LineStyle.Dashed, labelVisible: false },
        horzLine: { visible: false, labelVisible: false },
      },
      handleScale: false,
      handleScroll: false,
      autoSize: true,
    })

    const series = chart.addSeries(BaselineSeries, {
      baseValue: { type: 'price', price: referenceValue ?? 0 },
      relativeGradient: true,
      lineWidth: 2,
      topLineColor: '#5ba6ff',
      topFillColor1: 'rgba(64,146,255,0.23)',
      topFillColor2: 'rgba(47,123,255,0.01)',
      bottomLineColor: '#f3a6b5',
      bottomFillColor1: 'rgba(243,166,181,0.01)',
      bottomFillColor2: 'rgba(243,166,181,0.18)',
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerBackgroundColor: markerColor,
      autoscaleInfoProvider: (original: () => AutoscaleInfo | null) => {
        const result = original()
        if (!result?.priceRange) return result
        let minValue = result.priceRange.minValue
        let maxValue = result.priceRange.maxValue
        for (const line of lines) {
          minValue = Math.min(minValue, line.price)
          maxValue = Math.max(maxValue, line.price)
        }
        return { ...result, priceRange: { minValue, maxValue } }
      },
    })

    chartRef.current = chart
    seriesRef.current = series
    return () => {
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
    // Rebuild only when visual references or the baseline treatment changes.
  }, [lines, markerColor, referenceValue])

  // Data + reference lines. Price lines are recreated with the data so they
  // always match the series currently drawn.
  useEffect(() => {
    const series = seriesRef.current
    const chart = chartRef.current
    if (!series || !chart || data.length === 0) return

    series.applyOptions({
      baseValue: { type: 'price', price: referenceValue ?? data[0].value },
    })
    series.setData(data)
    const created = lines.map((line) =>
      series.createPriceLine({
        price: line.price,
        color: line.color,
        lineWidth: 1,
        lineStyle: line.dashed ? LineStyle.Dashed : LineStyle.Solid,
        axisLabelVisible: true,
        title: line.title,
      }),
    )
    const markerPlugin = markers.length > 0 ? createSeriesMarkers(series, markers) : null
    chart.timeScale().fitContent()
    return () => {
      markerPlugin?.detach()
      for (const line of created) series.removePriceLine(line)
    }
  }, [data, lines, markers, referenceValue])

  // Live tick: nudge the final point so the underlying chart breathes.
  useEffect(() => {
    const series = seriesRef.current
    if (!series || liveValue === undefined || data.length === 0) return
    series.update({ time: data[data.length - 1].time, value: liveValue })
  }, [liveValue, data])

  return (
    <div className="liquid-inset rounded-2xl p-3">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-[12px] font-bold text-ink">{title}</h4>
        <span className="num text-[11px] text-ink-muted">{subtitle}</span>
      </div>
      <div ref={containerRef} role="img" aria-label={`${title}. ${subtitle}`} className="h-[150px] w-full" />
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
        {lines.map((line) => (
          <span key={line.title} className="flex items-center gap-1.5 text-[10.5px] text-ink-muted">
            <span
              className={cn('h-0.5 w-3 rounded-full')}
              style={{ backgroundColor: line.color }}
              aria-hidden
            />
            {line.title}
          </span>
        ))}
      </div>
    </div>
  )
}

function PlanStat({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint: string
  tone?: 'up'
}) {
  return (
    <div className="rounded-xl border border-line bg-white/[0.03] px-3 py-2.5">
      <dt className="text-[9.5px] font-bold tracking-[0.07em] text-ink-muted uppercase">
        {label}
      </dt>
      <dd className={cn('num mt-1 text-[12.5px] font-bold', tone === 'up' ? 'text-up' : 'text-ink')}>
        {value}
      </dd>
      <dd className="num mt-0.5 text-[10.5px] text-ink-muted">{hint}</dd>
    </div>
  )
}

function closestTime(
  data: { time: number; value: number }[],
  iso: string,
): UTCTimestamp | undefined {
  if (data.length === 0) return undefined
  const target = new Date(iso).getTime() / 1000
  return data.reduce((closest, point) =>
    Math.abs(point.time - target) < Math.abs(closest.time - target) ? point : closest,
  ).time as UTCTimestamp
}

function formatEntryDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(iso))
}
