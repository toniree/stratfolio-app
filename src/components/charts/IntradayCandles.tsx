import { useEffect, useMemo, useRef, useState } from 'react'
import { gaussian, hashString, mulberry32 } from '@/lib/prng'

/** Live mode: one candle per second, sampled twice a second. */
const LIVE_SAMPLE_MS = 500
const LIVE_BUCKET_MS = 1000

const WIDTH = 300
const HEIGHT = 104
const PLOT_TOP = 5
const PLOT_BOTTOM = 86
const AXIS_Y = HEIGHT - 3
/** Right-hand gutter reserved for the price scale. */
const PLOT_RIGHT = WIDTH - 30

/**
 * A regular session is 6.5 hours. Five-minute buckets give 78 candles, which
 * is the finest granularity that still leaves each body wide enough to read
 * at this size — a true per-second series would be 23,400 bars in ~300px.
 */
const BARS = 78
const SESSION_START_MINUTES = 9 * 60 + 30
const SESSION_MINUTES = 390

interface Candle {
  open: number
  high: number
  low: number
  close: number
  minute: number
}

/**
 * ThinkOrSwim-style intraday candles for the current session, walked backwards
 * from the live price so the last close always equals the quote shown beside
 * the chart. Deterministic per symbol per day.
 */
export function IntradayCandles({
  symbol,
  lastPrice,
  previousClose,
  live,
  className,
}: {
  symbol: string
  lastPrice: number
  previousClose: number
  /** Roll one-second candles from the live quote instead of a static session. */
  live?: boolean
  className?: string
}) {
  const session = useMemo(
    () => buildSession(symbol, lastPrice, previousClose),
    // Live mode seeds once and then rolls forward; re-deriving the whole
    // session on every tick would redraw all 78 bars twice a second.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [symbol, live ? null : lastPrice, previousClose],
  )
  const liveCandles = useLiveCandles(symbol, lastPrice, session, Boolean(live))
  const candles = live ? liveCandles : session

  const highs = candles.map((candle) => candle.high)
  const lows = candles.map((candle) => candle.low)
  const rawMax = Math.max(...highs, previousClose)
  const rawMin = Math.min(...lows, previousClose)
  const pad = Math.max((rawMax - rawMin) * 0.08, rawMax * 0.0006)
  const max = rawMax + pad
  const min = rawMin - pad
  const span = Math.max(max - min, 0.01)

  const y = (value: number) =>
    PLOT_TOP + (1 - (value - min) / span) * (PLOT_BOTTOM - PLOT_TOP)
  const slot = PLOT_RIGHT / BARS
  const body = Math.max(slot * 0.62, 1.1)
  const prevY = y(previousClose)

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      width="100%"
      height={HEIGHT}
      role="img"
      aria-label={`${symbol} intraday candles for the current session`}
      className={className}
    >
      <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="#05080d" />

      {priceTicks(min, max).map((value) => (
        <g key={value}>
          <line
            x1={0}
            y1={y(value)}
            x2={PLOT_RIGHT}
            y2={y(value)}
            stroke="rgba(255,255,255,0.055)"
            strokeWidth="0.7"
          />
          <text
            x={PLOT_RIGHT + 3}
            y={y(value) + 2.4}
            className="fill-ink-muted text-[7px]"
          >
            {value.toFixed(priceDigits(max - min))}
          </text>
        </g>
      ))}

      {/* Previous close — the line every intraday move is measured against. */}
      <line
        x1={0}
        y1={prevY}
        x2={PLOT_RIGHT}
        y2={prevY}
        stroke="rgba(190,200,214,0.34)"
        strokeWidth="0.7"
        strokeDasharray="2 2.5"
      />

      {candles.map((candle, index) => {
        const cx = index * slot + slot / 2
        const up = candle.close >= candle.open
        const colour = up ? '#34d399' : '#f87171'
        const top = y(Math.max(candle.open, candle.close))
        const bottom = y(Math.min(candle.open, candle.close))
        return (
          <g key={candle.minute} shapeRendering="crispEdges">
            <line
              x1={cx}
              y1={y(candle.high)}
              x2={cx}
              y2={y(candle.low)}
              stroke={colour}
              strokeWidth="0.75"
              opacity="0.85"
            />
            <rect
              x={cx - body / 2}
              y={top}
              width={body}
              height={Math.max(bottom - top, 0.8)}
              fill={colour}
              opacity={up ? 0.9 : 0.85}
            />
          </g>
        )
      })}

      {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
        const minute = SESSION_START_MINUTES + fraction * SESSION_MINUTES
        const x = fraction * PLOT_RIGHT
        return (
          <text
            key={fraction}
            x={fraction === 0 ? 2 : fraction === 1 ? PLOT_RIGHT - 2 : x}
            y={AXIS_Y}
            textAnchor={fraction === 0 ? 'start' : fraction === 1 ? 'end' : 'middle'}
            className="fill-ink-muted text-[7px]"
          >
            {clockLabel(minute)}
          </text>
        )
      })}
    </svg>
  )
}

/**
 * Walks the session backwards from the live price so the final close is exact,
 * then reverses. Intraday vol is scaled off the gap to the previous close.
 */
/**
 * Rolls one-second candles off the live quote. The price prop is read through a
 * ref so the sampler keeps a single interval for the component's whole life
 * rather than tearing down and rebuilding on every tick.
 */
function useLiveCandles(
  symbol: string,
  lastPrice: number,
  seed: Candle[],
  enabled: boolean,
): Candle[] {
  const priceRef = useRef(lastPrice)
  priceRef.current = lastPrice
  const [candles, setCandles] = useState<Candle[]>(seed)

  // A new symbol is a different series; start it from that symbol's session.
  useEffect(() => {
    setCandles(seed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol])

  useEffect(() => {
    if (!enabled) return
    let bucket = Math.floor(Date.now() / LIVE_BUCKET_MS)

    const id = setInterval(() => {
      const price = priceRef.current
      const now = Math.floor(Date.now() / LIVE_BUCKET_MS)
      setCandles((prev) => {
        const next = prev.slice()
        const open = next[next.length - 1]

        if (now !== bucket || !open) {
          bucket = now
          // A new second opens where the last one closed, so the line is continuous.
          const from = open?.close ?? price
          next.push({ open: from, close: price, high: Math.max(from, price), low: Math.min(from, price), minute: 0 })
          return next.slice(-BARS)
        }

        next[next.length - 1] = {
          ...open,
          close: price,
          high: Math.max(open.high, price),
          low: Math.min(open.low, price),
        }
        return next
      })
    }, LIVE_SAMPLE_MS)

    return () => clearInterval(id)
  }, [enabled])

  return candles
}

function buildSession(symbol: string, lastPrice: number, previousClose: number): Candle[] {
  const day = Math.floor(Date.now() / 86_400_000)
  const rand = mulberry32(hashString(`${symbol}:${day}:intraday`))
  const drift = (lastPrice - previousClose) / BARS
  const vol = Math.max(Math.abs(lastPrice - previousClose) * 0.35, lastPrice * 0.0012)

  const reversed: Candle[] = []
  let close = lastPrice
  for (let i = BARS - 1; i >= 0; i--) {
    const open = Math.max(0.01, close - drift - gaussian(rand) * vol)
    const wick = Math.abs(gaussian(rand)) * vol * 0.7
    reversed.push({
      open,
      close,
      high: Math.max(open, close) + wick,
      low: Math.max(0.01, Math.min(open, close) - wick),
      minute: SESSION_START_MINUTES + (i * SESSION_MINUTES) / BARS,
    })
    close = open
  }
  return reversed.reverse()
}

/** Five horizontal gridlines, evenly spread across the visible range. */
function priceTicks(min: number, max: number): number[] {
  return [0, 0.25, 0.5, 0.75, 1].map((fraction) => min + (max - min) * fraction)
}

function priceDigits(range: number): number {
  if (range < 1) return 2
  if (range < 20) return 1
  return 0
}

function clockLabel(minuteOfDay: number): string {
  const hour24 = Math.floor(minuteOfDay / 60)
  const minute = Math.round(minuteOfDay % 60)
  const hour = hour24 % 12 === 0 ? 12 : hour24 % 12
  return `${hour}:${String(minute).padStart(2, '0')}`
}
