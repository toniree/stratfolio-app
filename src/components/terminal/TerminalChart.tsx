import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type LineSeriesPartialOptions,
  type UTCTimestamp,
} from 'lightweight-charts'
import { cn } from '@/lib/cn'
import { formatMoney } from '@/lib/format'
import { SYMBOL_MAP } from '@/api/mock/seededData'
import { usePrice, useTrackedSymbols } from '@/store/priceStore'
import { useTerminalStore } from '@/store/terminalStore'
import { isMarketLive, useLiveBars, useLiveChain } from '@/hooks/marketQueries'
import { TRUNCATED_BARS_NOTE } from '@/api/http/adapters/market'
import type { MndBarInterval } from '@/api/http/wire/mnd'
import { ProvenanceTag, StaleTag } from '@/components/shared/ProvenanceTag'
import { SymbolIcon } from '@/components/shared/SymbolIcon'
import { PercentChange } from '@/components/shared/PercentChange'
import { StudyIcon } from '@/components/shared/StudyIcon'
import { OptionsChain } from '@/components/terminal/OptionsChain'
import { SymbolSearch } from '@/components/terminal/SymbolSearch'
import {
  ChartStudiesModal,
  DEFAULT_STUDY_CONFIG,
  type StudyConfig,
  type StudyKey,
} from '@/components/terminal/ChartStudiesModal'
import {
  bollinger,
  buildCandles,
  contractPrice,
  ema,
  optionCandles,
  rsi,
  sma,
  vwap,
  type TerminalCandle,
  type Timeframe,
} from '@/lib/terminalSeries'

const UP = '#34d399'
const DOWN = '#f87171'
const TIMEFRAMES: Timeframe[] = ['1D', '1W', '1M', '3M', '1Y']

/**
 * Each timeframe as a **bounded** bar request (§15.3).
 *
 * The facade requires `start` and `end` on every bars call — stricter than the
 * gRPC RPC, which allows an unbounded scan — so a timeframe is expressed as a
 * span back from now plus an interval the route accepts (1m/5m/15m/1h/1d), and
 * never as "give me everything for this symbol".
 */
const LIVE_FRAMES: Record<Timeframe, { spanMs: number; interval: MndBarInterval }> = {
  '1D': { spanMs: 2 * 86_400_000, interval: '5m' },
  '1W': { spanMs: 8 * 86_400_000, interval: '1h' },
  '1M': { spanMs: 32 * 86_400_000, interval: '1d' },
  '3M': { spanMs: 95 * 86_400_000, interval: '1d' },
  '1Y': { spanMs: 370 * 86_400_000, interval: '1d' },
}

const STUDY_COLORS: Record<Exclude<StudyKey, 'volume' | 'rsi' | 'bb'>, string> = {
  sma20: '#f5c26b',
  ema50: '#c084fc',
  vwap: '#5ba6ff',
}

interface StudySeries {
  sma20?: ISeriesApi<'Line'>
  ema50?: ISeriesApi<'Line'>
  vwap?: ISeriesApi<'Line'>
  bbUpper?: ISeriesApi<'Line'>
  bbBasis?: ISeriesApi<'Line'>
  bbLower?: ISeriesApi<'Line'>
  rsi?: ISeriesApi<'Line'>
}

/**
 * The desktop terminal's centrepiece: a ThinkOrSwim-style multi-study chart.
 * Candles + volume, optional SMA/EMA/VWAP/Bollinger overlays, and an RSI
 * lower pane. History is deterministic per symbol/timeframe (see
 * terminalSeries), and the last bar rolls live off the simulator quote.
 */
export function TerminalChart({ className }: { className?: string }) {
  const symbol = useTerminalStore((s) => s.symbol)
  const contract = useTerminalStore((s) => s.contract)
  const setContract = useTerminalStore((s) => s.setContract)
  const quote = usePrice(symbol)
  const spec = SYMBOL_MAP.get(symbol)
  const live = isMarketLive()
  useTrackedSymbols(useMemo(() => [symbol], [symbol]))

  const contractLabel = contract
    ? `${symbol} $${contract.strike % 1 === 0 ? contract.strike : contract.strike.toFixed(1)}${contract.right === 'CALL' ? 'C' : 'P'}`
    : null

  const contractExpiration = contract
    ? new Date(contract.expiryTime * 1000).toISOString().slice(0, 10)
    : undefined
  const contractChain = useLiveChain(symbol, {
    expiration: contractExpiration,
    enabled: live && contract !== null,
  })

  /**
   * The focused contract's mark.
   *
   * Live: the server's own chain mid for exactly this contract. There is **no
   * change figure** — the facade exposes no historical chain
   * (`GetChainSnapshotHistory` is deferred with no route), so a prior mark
   * simply does not exist and the header renders "—" rather than a 0.00% that
   * would read as "unchanged".
   *
   * Mock: the deterministic pricer, off the same smile as the chain, so the
   * header and the ladder can never contradict each other.
   */
  const optionQuote = useMemo(() => {
    if (!contract) return null
    if (live) {
      const match = contractChain.data?.contracts.find(
        (candidate) =>
          candidate.right === contract.right &&
          Math.abs(candidate.strike - contract.strike) < 1e-6,
      )
      const mark = match?.mid ?? (match?.bid !== undefined && match.ask !== undefined ? (match.bid + match.ask) / 2 : undefined)
      return mark === undefined ? null : { mark, change: undefined, changePct: undefined }
    }
    if (!quote) return null
    const years = (contract.expiryTime - Date.now() / 1000) / (365 * 86_400)
    const mark = contractPrice(symbol, quote.price, contract.strike, contract.right, years)
    const prevMark = contractPrice(symbol, quote.previousClose, contract.strike, contract.right, years)
    return {
      mark,
      change: mark - prevMark,
      changePct: prevMark > 0 ? ((mark - prevMark) / prevMark) * 100 : 0,
    }
  }, [contract, contractChain.data, live, quote, symbol])

  const [timeframe, setTimeframe] = useState<Timeframe>('1D')
  const liveBars = useLiveBars(symbol, { ...LIVE_FRAMES[timeframe], enabled: live })
  const [studiesOpen, setStudiesOpen] = useState(false)
  const [studies, setStudies] = useState<Record<StudyKey, boolean>>({
    volume: true,
    sma20: true,
    ema50: false,
    vwap: true,
    bb: false,
    rsi: true,
  })
  const [studyConfig, setStudyConfig] = useState<StudyConfig>(DEFAULT_STUDY_CONFIG)

  const containerRef = useRef<HTMLDivElement>(null)
  const legendRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const studySeriesRef = useRef<StudySeries>({})
  const candlesRef = useRef<TerminalCandle[]>([])
  const lastPriceRef = useRef(quote?.price ?? spec?.open ?? 100)
  lastPriceRef.current = quote?.price ?? lastPriceRef.current

  /* ---------- chart + permanent series, created once ---------- */
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#7d8ca4',
        fontFamily:
          "'Inter var','Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
        fontSize: 10,
        attributionLogo: false,
        panes: { separatorColor: 'rgba(255,255,255,0.09)', separatorHoverColor: 'rgba(91,166,255,0.25)' },
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.035)' },
        horzLines: { color: 'rgba(255,255,255,0.05)' },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.08, bottom: 0.22 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 2,
      },
      crosshair: {
        vertLine: { color: 'rgba(91,166,255,0.4)', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#1d2836' },
        horzLine: { color: 'rgba(91,166,255,0.3)', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#1d2836' },
      },
    })

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
      borderVisible: false,
      priceLineColor: 'rgba(91,166,255,0.55)',
      priceLineStyle: LineStyle.Dashed,
    })

    chartRef.current = chart
    candleSeriesRef.current = candles

    chart.subscribeCrosshairMove((param) => {
      const legend = legendRef.current
      if (!legend) return
      const bar = param.seriesData.get(candles) as
        | { open: number; high: number; low: number; close: number }
        | undefined
      if (!bar) {
        legend.textContent = ''
        return
      }
      const digits = bar.close >= 1000 ? 2 : bar.close >= 100 ? 2 : 2
      const pct = bar.open !== 0 ? ((bar.close - bar.open) / bar.open) * 100 : 0
      legend.innerHTML = `O <b>${bar.open.toFixed(digits)}</b>  H <b>${bar.high.toFixed(digits)}</b>  L <b>${bar.low.toFixed(digits)}</b>  C <b>${bar.close.toFixed(digits)}</b>  <span style="color:${bar.close >= bar.open ? UP : DOWN}">${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%</span>`
    })

    return () => {
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      volumeSeriesRef.current = null
      studySeriesRef.current = {}
    }
  }, [])

  /* ---------- study series lifecycle (toggles) ---------- */
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const held = studySeriesRef.current

    const ensureLine = (
      key: keyof StudySeries,
      active: boolean,
      options: LineSeriesPartialOptions,
      paneIndex = 0,
    ) => {
      if (active && !held[key]) {
        held[key] = chart.addSeries(
          LineSeries,
          {
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
            ...options,
          },
          paneIndex,
        ) as ISeriesApi<'Line'>
      } else if (!active && held[key]) {
        chart.removeSeries(held[key]!)
        delete held[key]
      }
    }

    // Volume histogram lives on its own overlay scale pinned to the bottom.
    if (studies.volume && !volumeSeriesRef.current) {
      volumeSeriesRef.current = chart.addSeries(HistogramSeries, {
        priceScaleId: 'volume',
        priceFormat: { type: 'volume' },
        priceLineVisible: false,
        lastValueVisible: false,
      })
      chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.86, bottom: 0 } })
    } else if (!studies.volume && volumeSeriesRef.current) {
      chart.removeSeries(volumeSeriesRef.current)
      volumeSeriesRef.current = null
    }

    ensureLine('sma20', studies.sma20, { color: STUDY_COLORS.sma20 })
    ensureLine('ema50', studies.ema50, { color: STUDY_COLORS.ema50 })
    ensureLine('vwap', studies.vwap, { color: STUDY_COLORS.vwap, lineStyle: LineStyle.Dashed })
    ensureLine('bbUpper', studies.bb, { color: 'rgba(125,171,255,0.65)' })
    ensureLine('bbBasis', studies.bb, { color: 'rgba(125,171,255,0.35)', lineStyle: LineStyle.Dotted })
    ensureLine('bbLower', studies.bb, { color: 'rgba(125,171,255,0.65)' })

    // RSI gets a real second pane, like a platform study slot.
    const hadRsi = Boolean(held.rsi)
    ensureLine('rsi', studies.rsi, { color: '#e8a9ff', lineWidth: 1 }, 1)
    if (studies.rsi && !hadRsi && held.rsi) {
      held.rsi.createPriceLine({ price: 70, color: 'rgba(248,113,113,0.45)', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: '' })
      held.rsi.createPriceLine({ price: 30, color: 'rgba(52,211,153,0.45)', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: '' })
      const pane = chart.panes()[1]
      pane?.setHeight(86)
    }

    feedStudies(studySeriesRef.current, volumeSeriesRef.current, candlesRef.current, studyConfig)
  }, [studies, studyConfig])

  /* ---------- (re)load data on symbol / timeframe change ---------- */
  useEffect(() => {
    const candleSeries = candleSeriesRef.current
    const chart = chartRef.current
    if (!candleSeries || !chart) return

    // Live: real bars over a bounded window. Mock: the deterministic tape.
    const underlying = live ? (liveBars.data?.bars ?? []) : buildCandles(symbol, timeframe, lastPriceRef.current)
    // Repricing a tape into a contract's own history uses the seeded IV smile,
    // which is a demo model, and the facade has no historical chain to replace
    // it with (`GetHistoricalChain` is deferred with no route). In live mode
    // the chart therefore stays on the underlying and says so, rather than
    // drawing an invented option tape (§6).
    const candles =
      contract && !live
        ? optionCandles(symbol, underlying, contract.strike, contract.right, contract.expiryTime)
        : underlying
    // Copied, not aliased: the last bar is mutated below as the quote ticks,
    // and in live mode `candles` is TanStack's cached response.
    candlesRef.current = candles.map((c) => ({ ...c }))
    candleSeries.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: round2(c.open),
        high: round2(c.high),
        low: round2(c.low),
        close: round2(c.close),
      })),
    )
    feedStudies(studySeriesRef.current, volumeSeriesRef.current, candles, studyConfig)
    chart.timeScale().fitContent()
  }, [symbol, timeframe, studyConfig, contract, live, liveBars.data])

  /* ---------- roll the last candle off the live quote ---------- */
  const price = quote?.price
  useEffect(() => {
    const candleSeries = candleSeriesRef.current
    const candles = candlesRef.current
    if (!candleSeries || price === undefined || candles.length === 0) return
    const last = candles[candles.length - 1]
    // In live mode the chart is always the underlying (see above), so the
    // quote rolls the bar directly; no in-browser option repricing.
    const value =
      contract && !live
        ? contractPrice(
            symbol,
            price,
            contract.strike,
            contract.right,
            (contract.expiryTime - Date.now() / 1000) / (365 * 86_400),
          )
        : price
    last.close = value
    last.high = Math.max(last.high, value)
    last.low = Math.min(last.low, value)
    candleSeries.update({
      time: last.time as UTCTimestamp,
      open: round2(last.open),
      high: round2(last.high),
      low: round2(last.low),
      close: round2(last.close),
    })
  }, [price, contract, symbol, live])

  const dayUp = (quote?.dayChange ?? 0) >= 0
  const activeStudyCount = useMemo(
    () => Object.values(studies).filter(Boolean).length,
    [studies],
  )

  return (
    <section
      className={cn('card overflow-hidden', className)}
      aria-label={contract ? `${contractLabel} option chart` : `${symbol} chart`}
    >
      {/* ---------- header: identity + quote + controls ---------- */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3">
        {contract ? (
          <button
            type="button"
            onClick={() => setContract(null)}
            aria-label={`Back to ${symbol} chart`}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-brand-300/35 bg-brand-400/[0.12] px-2.5 py-1.5 text-[11px] font-bold text-brand-200 transition-colors hover:bg-brand-400/[0.2]"
          >
            <ArrowLeft size={13} strokeWidth={2.5} />
            Back to {symbol}
          </button>
        ) : null}

        {contract ? (
          <div className="flex min-w-0 items-center gap-2.5">
            <SymbolIcon symbol={symbol} size="sm" />
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-[15px] font-extrabold tracking-[-0.01em] text-ink">
                  {contractLabel}
                </span>
                <span className="truncate text-[11px] font-medium text-ink-muted">
                  {contract.expiryLabel} · {contract.dte} DTE
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* The identity doubles as the ticker search. */
          <SymbolSearch />
        )}

        {contract && optionQuote ? (
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                'num text-[17px] font-extrabold',
                optionQuote.change === undefined
                  ? 'text-ink'
                  : optionQuote.change >= 0
                    ? 'text-up'
                    : 'text-down',
              )}
            >
              {formatMoney(optionQuote.mark)}
            </span>
            {optionQuote.change === undefined || optionQuote.changePct === undefined ? (
              // A real chain quotes *now*; the facade exposes no historical
              // chain, so there is no prior mark to change against. "—" is the
              // honest answer where a 0.00% would read as "unchanged".
              <span className="num text-[11px] font-semibold text-ink-muted" title="No prior contract mark: the market service exposes no historical chain in V1.">
                —
              </span>
            ) : (
              <PercentChange
                pct={optionQuote.changePct}
                amount={optionQuote.change}
                size="sm"
                glyph
              />
            )}
            <span className="num text-[10px] text-ink-muted">
              {symbol} {quote ? formatMoney(quote.price) : '—'}
            </span>
            <ProvenanceTag provenance={live ? contractChain.data?.provenance : 'mock'} />
          </div>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className={cn('num text-[17px] font-extrabold', dayUp ? 'text-up' : 'text-down')}>
              {quote ? formatMoney(quote.price) : '—'}
            </span>
            {quote ? (
              <PercentChange pct={quote.dayChangePct} amount={quote.dayChange} size="sm" glyph />
            ) : null}
            <ProvenanceTag provenance={quote?.provenance} />
            <StaleTag stale={quote?.stale} />
          </div>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <div className="flex rounded-lg border border-line bg-white/[0.03] p-0.5">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={cn(
                  'rounded-md px-2 py-1 text-[10.5px] font-bold transition-colors',
                  timeframe === tf
                    ? 'bg-brand-500/25 text-brand-200'
                    : 'text-ink-muted hover:text-ink',
                )}
              >
                {tf}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-label="Toggle chart studies"
            title="Toggle chart studies"
            onClick={() => setStudiesOpen(true)}
            className="liquid-control group relative grid h-8 w-9 place-items-center rounded-lg border border-line text-ink-muted transition-colors hover:border-brand-300/40 hover:text-brand-200"
          >
            <StudyIcon size={21} />
            <span className="absolute -top-1.5 -right-1.5 grid h-4 min-w-4 place-items-center rounded-full border border-[#101824] bg-brand-500 px-1 text-[8px] font-extrabold text-white">
              {activeStudyCount}
            </span>
          </button>
        </div>
      </div>

      {/* ---------- plot + options chain gutter ---------- */}
      <div className="flex items-stretch">
        <div className="relative min-w-0 flex-1">
          <div
            ref={legendRef}
            className="num pointer-events-none absolute top-2 left-3 z-10 text-[10px] font-medium whitespace-pre text-ink-muted [&_b]:font-bold [&_b]:text-ink"
          />
          <div ref={containerRef} className="h-[440px] w-full xl:h-[500px]" />
          {live && liveBars.data?.truncated ? (
            // A truncated page holds the OLDEST bars of the window: the newest
            // candles are the missing ones, so the chart must not be read as
            // current (§15.3).
            <p className="border-t border-line px-3 py-1 text-[9.5px] text-[#f5c26b]">
              {TRUNCATED_BARS_NOTE}
            </p>
          ) : null}
          {live && contract ? (
            <p className="border-t border-line px-3 py-1 text-[9.5px] text-ink-muted">
              Showing {symbol}. Per-contract price history is not available: the market service
              exposes no historical chain in V1.
            </p>
          ) : null}
        </div>
        <OptionsChain
          symbol={symbol}
          spot={quote?.price}
          className="w-1/4 min-w-[228px] shrink-0 border-l border-line"
        />
      </div>
      <ChartStudiesModal
        open={studiesOpen}
        onOpenChange={setStudiesOpen}
        studies={studies}
        onStudiesChange={setStudies}
        config={studyConfig}
        onConfigChange={setStudyConfig}
      />
    </section>
  )
}

/* Push current candle data into whichever study series are alive. */
function feedStudies(
  held: StudySeries,
  volumeSeries: ISeriesApi<'Histogram'> | null,
  candles: TerminalCandle[],
  config: StudyConfig,
) {
  if (candles.length === 0) return
  const t = (v: { time: number }) => v.time as UTCTimestamp

  volumeSeries?.setData(
    candles.map((c) => ({
      time: c.time as UTCTimestamp,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(52,211,153,0.32)' : 'rgba(248,113,113,0.3)',
    })),
  )
  held.sma20?.setData(sma(candles, config.smaLength).map((p) => ({ time: t(p), value: round2(p.value) })))
  held.ema50?.setData(ema(candles, config.emaLength).map((p) => ({ time: t(p), value: round2(p.value) })))
  held.vwap?.setData(vwap(candles).map((p) => ({ time: t(p), value: round2(p.value) })))
  if (held.bbUpper || held.bbLower || held.bbBasis) {
    const bands = bollinger(candles, config.bollingerLength, config.bollingerDeviation)
    held.bbUpper?.setData(bands.map((p) => ({ time: t(p), value: round2(p.upper) })))
    held.bbBasis?.setData(bands.map((p) => ({ time: t(p), value: round2(p.basis) })))
    held.bbLower?.setData(bands.map((p) => ({ time: t(p), value: round2(p.lower) })))
  }
  held.rsi?.setData(rsi(candles, config.rsiLength).map((p) => ({ time: t(p), value: Math.round(p.value * 10) / 10 })))
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}
