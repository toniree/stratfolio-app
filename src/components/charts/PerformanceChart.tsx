import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import {
  BaselineSeries,
  ColorType,
  createChart,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { PerformanceSeries } from '@/api/types'

interface PerformanceChartProps {
  series: PerformanceSeries
  /**
   * Live portfolio value. Used **only** to scale a `relative-multiplier`
   * series. A `settled-equity` series already carries absolute dollars and is
   * never multiplied by this — doing so would blend realised P&L with the
   * live marked book and double-count (plan §3.1, "one equity basis per
   * chart").
   */
  currentValue: number
  positive: boolean
  height?: number
  /** Shows date/value axes and crosshair labels for detailed inspection. */
  showAxes?: boolean
}

const BLUE_LINE = '#5ba6ff'
const PINK_LINE = '#f3a6b5'

/**
 * Wraps TradingView Lightweight Charts.
 *
 * Two bases, never mixed. A `relative-multiplier` series (the demo book) is
 * rescaled against the live portfolio value on every tick, which keeps the
 * chart's right edge and the hero number in permanent agreement. A
 * `settled-equity` series (plt closed trades) is already in dollars and is
 * plotted as-is; the live marked value belongs beside it as a separate stat,
 * not folded into the line.
 */
export function PerformanceChart({
  series: performance,
  currentValue,
  positive,
  height = 208,
  showAxes = false,
}: PerformanceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const interactiveRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Baseline'> | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const chart = createChart(container, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#8d99a8',
        fontFamily:
          "'Inter var','Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
        fontSize: showAxes ? 9 : 11,
        attributionLogo: false,
      },
      localization: {
        priceFormatter: showAxes
          ? compactAxisMoney
          : (price: number) => price.toLocaleString('en-US', { maximumFractionDigits: 2 }),
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: 'rgba(255,255,255,0.06)', style: LineStyle.Solid },
      },
      rightPriceScale: {
        visible: showAxes,
        borderVisible: showAxes,
        borderColor: 'rgba(255,255,255,0.08)',
        minimumWidth: 0,
      },
      leftPriceScale: { visible: false },
      timeScale: {
        visible: showAxes,
        borderVisible: false,
        ticksVisible: showAxes,
        minimumHeight: 0,
        fixLeftEdge: true,
        fixRightEdge: true,
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: {
          color: 'rgba(91,166,255,0.45)',
          width: 1,
          style: LineStyle.Dashed,
          labelVisible: showAxes,
        },
        horzLine: {
          visible: showAxes,
          color: 'rgba(91,166,255,0.3)',
          width: 1,
          style: LineStyle.Dashed,
          labelVisible: showAxes,
        },
      },
      handleScale: showAxes
        ? { axisPressedMouseMove: true, mouseWheel: true, pinch: true }
        : false,
      handleScroll: showAxes
        ? { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false }
        : false,
      autoSize: true,
    })

    const series = chart.addSeries(BaselineSeries, {
      baseValue: { type: 'price', price: 0 },
      relativeGradient: true,
      lineWidth: 2,
      topLineColor: BLUE_LINE,
      topFillColor1: 'rgba(64,146,255,0.25)',
      topFillColor2: 'rgba(47,123,255,0.015)',
      bottomLineColor: PINK_LINE,
      bottomFillColor1: 'rgba(243,166,181,0.015)',
      bottomFillColor2: 'rgba(243,166,181,0.20)',
      priceLineVisible: false,
      lastValueVisible: false,
      priceFormat: showAxes
        ? {
            type: 'custom',
            formatter: compactAxisMoney,
            minMove: 1,
          }
        : { type: 'price', precision: 2, minMove: 0.01 },
      crosshairMarkerRadius: 4,
      crosshairMarkerBorderWidth: 2,
      crosshairMarkerBorderColor: '#0f141c',
    })

    chartRef.current = chart
    seriesRef.current = series

    chart.subscribeCrosshairMove((param) => {
      const tooltip = tooltipRef.current
      if (!showAxes || !tooltip || !param.time || !param.point) {
        if (tooltip) tooltip.style.opacity = '0'
        return
      }
      const datum = param.seriesData.get(series) as { value?: number } | undefined
      if (datum?.value === undefined) {
        tooltip.style.opacity = '0'
        return
      }
      tooltip.textContent = `${formatChartDate(param.time)} · ${compactAxisMoney(datum.value)}`
      tooltip.style.opacity = '1'
    })

    return () => {
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [height, showAxes])

  // Recolour without recreating the chart.
  useEffect(() => {
    const series = seriesRef.current
    if (!series) return
    series.applyOptions({
      crosshairMarkerBackgroundColor: positive ? BLUE_LINE : PINK_LINE,
    })
  }, [positive])

  useEffect(() => {
    const series = seriesRef.current
    const chart = chartRef.current
    const points = performance.points
    const relative = performance.basis === 'relative-multiplier'
    if (!series || !chart || points.length === 0) return
    if (relative && currentValue <= 0) return

    const data = points.map((p) => ({
      time: p.time as UTCTimestamp,
      value: Number((relative ? p.multiplier * currentValue : (p.value ?? 0)).toFixed(2)),
    }))
    series.applyOptions({ baseValue: { type: 'price', price: data[0].value } })
    series.setData(data)
    chart.timeScale().fitContent()
  }, [performance, currentValue])

  const revealPoint = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!showAxes) return
    const chart = chartRef.current
    const series = seriesRef.current
    const container = interactiveRef.current
    if (!chart || !series || !container) return
    const rect = container.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const time = chart.timeScale().coordinateToTime(x)
    const price = series.coordinateToPrice(y)
    if (time === null || price === null) return
    chart.setCrosshairPosition(price, time, series)
  }

  return (
    <div
      ref={interactiveRef}
      className="relative w-full touch-pan-y"
      style={{ height }}
      onPointerDown={revealPoint}
      onPointerMove={(event) => {
        if (event.pointerType === 'touch' || event.buttons > 0) revealPoint(event)
      }}
    >
      <div ref={containerRef} className="h-full w-full" />
      {showAxes ? (
        <div
          ref={tooltipRef}
          className="pointer-events-none absolute top-1.5 left-2 z-10 rounded-md border border-white/10 bg-[#111925]/88 px-2 py-1 text-[9px] font-bold text-white opacity-0 shadow-sm transition-opacity"
        />
      ) : null}
    </div>
  )
}

function formatChartDate(time: UTCTimestamp | string | { year: number; month: number; day: number }) {
  if (typeof time === 'object') {
    return new Date(time.year, time.month - 1, time.day).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }
  const date = new Date(typeof time === 'number' ? time * 1000 : time)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function compactAxisMoney(value: number) {
  const sign = value < 0 ? '−' : ''
  const absolute = Math.abs(value)
  if (absolute >= 1_000_000) {
    const amount = absolute / 1_000_000
    return `${sign}$${amount >= 10 ? amount.toFixed(0) : amount.toFixed(1)}M`
  }
  if (absolute >= 1_000) {
    const amount = absolute / 1_000
    return `${sign}$${amount >= 10 ? amount.toFixed(0) : amount.toFixed(1)}K`
  }
  return `${sign}$${absolute.toFixed(0)}`
}
