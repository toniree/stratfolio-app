import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { formatMoney, formatSignedMoney, formatSignedPercent } from '@/lib/format'

const VIEW_W = 340
const VIEW_H = 132
const PAD_Y = 8

/**
 * Robinhood-style price chart: a single filled line you can drag along to read
 * the value at any point, with the header figure following the scrub.
 *
 * Drawn as inline SVG with a viewBox rather than a charting library — the shape
 * is one path and one baseline, and the library's axes and tooltips would all
 * have to be turned off again.
 */
export function ScrubbableAreaChart({
  data,
  times,
  costBasis,
  className,
}: {
  data: number[]
  /** Unix seconds per sample, used for the x-axis labels. */
  times?: number[]
  /** Drawn as a dashed reference so gain and loss are readable at a glance. */
  costBasis?: number
  className?: string
}) {
  const [scrub, setScrub] = useState<number | null>(null)
  const [flash, setFlash] = useState<'up' | 'down' | null>(null)
  const [tick, setTick] = useState(0)
  const svgRef = useRef<SVGSVGElement>(null)

  const series = data.length > 1 ? data : [data[0] ?? 0, data[0] ?? 0]
  const { min, span, points, lo, hi } = useMemo(() => {
    const lo = Math.min(...series, ...(costBasis ? [costBasis] : []))
    const hi = Math.max(...series, ...(costBasis ? [costBasis] : []))
    const range = Math.max(hi - lo, hi * 0.004, 0.01)
    const pad = range * 0.12
    const min = lo - pad
    const span = hi + pad - min
    const points = series.map((value, i) => ({
      x: (i / (series.length - 1)) * VIEW_W,
      y: PAD_Y + (1 - (value - min) / span) * (VIEW_H - PAD_Y * 2),
      value,
    }))
    return { min, span, points, lo: min, hi: min + span }
  }, [series, costBasis])

  const first = series[0]
  const active = scrub === null ? series[series.length - 1] : series[scrub]
  const up = active >= first
  const stroke = up ? '#34d399' : '#f87171'

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
  const area = `${line} L${VIEW_W} ${VIEW_H} L0 ${VIEW_H} Z`
  const costY =
    costBasis !== undefined
      ? PAD_Y + (1 - (costBasis - min) / span) * (VIEW_H - PAD_Y * 2)
      : null

  /** Map a pointer position to the nearest sample. */
  const scrubTo = (clientX: number) => {
    const box = svgRef.current?.getBoundingClientRect()
    if (!box) return
    const ratio = Math.min(1, Math.max(0, (clientX - box.left) / box.width))
    setScrub(Math.round(ratio * (series.length - 1)))
  }

  // Flash only follows the live quote, never the scrub — dragging back through
  // history is reading, not a price change.
  const live = series[series.length - 1]
  const previousLive = useRef(live)
  useEffect(() => {
    const prior = previousLive.current
    previousLive.current = live
    if (live === prior) return
    setFlash(live > prior ? 'up' : 'down')
    setTick((n) => n + 1)
  }, [live])

  const cursor = scrub === null ? null : points[scrub]
  const delta = active - first
  const deltaPct = first > 0 ? (delta / first) * 100 : 0

  return (
    <div className={cn('select-none', className)}>
      <div className="flex items-baseline justify-end gap-2">
        <span className={cn('num text-[13px] font-bold', up ? 'text-up' : 'text-down')}>
          {formatSignedMoney(delta)} ({formatSignedPercent(deltaPct)})
        </span>
        <span
          key={tick}
          className={cn(
            'num text-[30px] leading-none font-extrabold tracking-[-0.03em] text-ink',
            scrub === null && flash === 'up' && 'price-tick-up',
            scrub === null && flash === 'down' && 'price-tick-down',
          )}
        >
          {formatMoney(active)}
        </span>
      </div>

      <div className="mt-2 flex gap-2">
        <div className="flex w-[46px] shrink-0 flex-col justify-between py-[6px] text-right">
          {[hi, (hi + lo) / 2, lo].map((value, i) => (
            <span key={i} className="num text-[9px] leading-none text-ink-muted">
              {formatMoney(value)}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        className="h-[132px] w-full touch-none"
        role="img"
        aria-label={`Contract premium history, currently ${formatMoney(active)}`}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          scrubTo(event.clientX)
        }}
        onPointerMove={(event) => {
          if (event.buttons === 0 && scrub === null) return
          scrubTo(event.clientX)
        }}
        onPointerUp={() => setScrub(null)}
        onPointerLeave={() => setScrub(null)}
      >
        <defs>
          <linearGradient id="scrub-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={area} fill="url(#scrub-fill)" />
        {costY !== null ? (
          <line
            x1="0"
            y1={costY}
            x2={VIEW_W}
            y2={costY}
            stroke="rgba(255,255,255,0.28)"
            strokeWidth="1"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        <path
          d={line}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {cursor ? (
          <g>
            <line
              x1={cursor.x}
              y1="0"
              x2={cursor.x}
              y2={VIEW_H}
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            {/* Radius is set in viewBox units on a stretched axis, so the dot is
                drawn on its own un-scaled layer to stay circular. */}
            <circle cx={cursor.x} cy={cursor.y} r="3.5" fill={stroke} />
          </g>
        ) : null}
      </svg>
          <div className="mt-1 flex justify-between">
            {axisLabels(series.length, times).map((label, i) => (
              <span key={i} className="num text-[9px] leading-none text-ink-muted">
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Three x-axis marks: first, middle, last. Falls back to a session count when
 * the caller has no timestamps to hand.
 */
function axisLabels(length: number, times?: number[]): string[] {
  if (!times || times.length !== length) return [`${length} sessions ago`, '', 'Now']
  const fmt = new Intl.DateTimeFormat('en-US', { month: 'numeric', day: 'numeric', timeZone: 'UTC' })
  const at = (i: number) => fmt.format(new Date(times[i] * 1000))
  return [at(0), at(Math.floor((length - 1) / 2)), 'Now']
}
