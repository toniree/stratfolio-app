import { useId, useMemo } from 'react'
import { Hammer, ListChecks } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { HistoryPoint } from '@/lib/optionHistory'
import { splitTwoLines, watermarkFontSize } from '@/lib/chartText'
import { isPlanEvent, type PositionEvent } from '@/lib/positionEvents'

const WIDTH = 190
/**
 * Tall enough that the plot's x-axis lands ~60% down the position tile; the
 * tile's stat rows and footer occupy the remaining 40%.
 */
export const MINI_CHART_HEIGHT = 174

const HEIGHT = MINI_CHART_HEIGHT
const PLOT_LEFT = 2
// Plot through the former Y-axis gutter. Mobile price labels now float inside
// the chart so the series can run all the way to the AI-note divider.
const PLOT_RIGHT = WIDTH
const PLOT_TOP = 3
const PLOT_BOTTOM = HEIGHT - 11
// Proportional to the plot: a value sitting at the domain edge lands a fixed
// *fraction* down the plot, so a fixed pixel threshold stops firing as the
// chart grows taller.
const END_LABEL_CLEARANCE = (PLOT_BOTTOM - PLOT_TOP) * 0.12
/** CSS reference pixels per millimetre (96dpi / 25.4). */
const MM_IN_PX = 96 / 25.4

interface ChartPoint {
  time: number
  value: number
  x: number
  y: number
}

/**
 * Dense, axis-aware mobile chart. Blue lives above the entry baseline and a
 * soft pink-white takes over below it, while the entry point remains in view.
 */
export function PositionMiniChart({
  data,
  entryPrice,
  entryDate,
  currentPrice,
  symbol,
  openPrice,
  watermark,
  events = [],
  selectedEventId,
  onSelectEvent,
}: {
  data: HistoryPoint[]
  entryPrice: number
  entryDate: string
  currentPrice: number
  symbol: string
  /** Session open, drawn as a faint dotted reference line. */
  openPrice?: number
  /** Faint company wordmark behind the plot, ThinkOrSwim style. */
  watermark?: string
  /** Fills and plan changes, pinned to the line where they happened. */
  events?: PositionEvent[]
  selectedEventId?: string | null
  onSelectEvent?: (id: string) => void
}) {
  const uid = useId().replace(/:/g, '')
  const chart = useMemo(
    () => buildChart(data, entryPrice, entryDate),
    [data, entryDate, entryPrice],
  )

  if (!chart) {
    return <div className="w-full rounded-lg bg-white/[0.025]" style={{ height: HEIGHT }} />
  }

  const { points, linePath, areaPath, entryX, entryY, min, max } = chart
  const openY =
    openPrice !== undefined && max > min
      ? PLOT_TOP + (1 - (openPrice - min) / (max - min)) * (PLOT_BOTTOM - PLOT_TOP)
      : null
  const openInRange = openY !== null && openY > PLOT_TOP + 4 && openY < PLOT_BOTTOM - 4
  const currentY = points[points.length - 1].y
  const currentBelowEntry = currentPrice < entryPrice
  const currentLabelY = clamp(currentY, PLOT_TOP + 9, PLOT_BOTTOM - 8)
  const maxLabelY = PLOT_TOP + 5
  const minLabelY = PLOT_BOTTOM - 2
  const showMaxLabel = Math.abs(currentLabelY - maxLabelY) > END_LABEL_CLEARANCE
  const showMinLabel = Math.abs(currentLabelY - minLabelY) > END_LABEL_CLEARANCE
  const entryDateLabel = formatAxisDate(entryDate)
  const watermarkLines = watermark ? splitTwoLines(watermark) : null
  const watermarkSize = watermarkLines
    ? watermarkFontSize(watermarkLines, PLOT_RIGHT - PLOT_LEFT - 12)
    : 0
  // Four evenly spaced ticks across the series (fewer if the series is short),
  // with the trailing one always reading as the live edge.
  const tickCount = Math.min(4, points.length)
  const axisTicks = Array.from({ length: tickCount }, (_, index) => {
    const point = points[Math.round((index / (tickCount - 1)) * (points.length - 1))]
    return {
      key: `${index}-${point.time}`,
      x: clamp(point.x, 9, PLOT_RIGHT - 3),
      label:
        index === tickCount - 1
          ? 'Now'
          : formatAxisDate(new Date(point.time * 1000).toISOString()),
    }
  })

  // Markers sit in an HTML layer above the plot rather than inside the SVG:
  // they need real buttons for hit area and keyboard access, and the
  // preserveAspectRatio="none" mapping makes the coordinate maths trivial.
  // The opening fill is already drawn as the yellow entry dot, so it gets a
  // hit area there instead of a second marker on top of it.
  const openEvent = events.find((event) => event.kind === 'open')
  const markers = events
    .filter((event) => event.kind !== 'open')
    .map((event) => {
    const point = points.reduce(
      (best, candidate) =>
        Math.abs(candidate.time - event.time) < Math.abs(best.time - event.time)
          ? candidate
          : best,
      points[0],
    )
      return { event, leftPct: (point.x / WIDTH) * 100, top: point.y }
    })

  return (
    <div className="relative min-w-0">
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      width="100%"
      height={HEIGHT}
      role="img"
      aria-label={`${symbol} premium chart. Entry ${formatAxisPrice(entryPrice)} on ${entryDateLabel}. Current ${formatAxisPrice(currentPrice)}.`}
      className="min-w-0 overflow-visible"
    >
      <defs>
        <clipPath id={`above-${uid}`}>
          <rect x="0" y="0" width={PLOT_RIGHT} height={entryY} />
        </clipPath>
        <clipPath id={`below-${uid}`}>
          <rect x="0" y={entryY} width={PLOT_RIGHT} height={PLOT_BOTTOM - entryY + 1} />
        </clipPath>
        <linearGradient id={`blue-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4d9dff" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#2f7bff" stopOpacity="0.025" />
        </linearGradient>
        <linearGradient id={`pink-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff1f4" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#f3a6b5" stopOpacity="0.24" />
        </linearGradient>
      </defs>

      {watermarkLines ? (
        <text
          x={(PLOT_LEFT + PLOT_RIGHT) / 2}
          y={watermarkBaseline(watermarkSize)}
          textAnchor="middle"
          className="fill-white/[0.1] font-extrabold tracking-[-0.03em] select-none"
          style={{ fontSize: watermarkSize }}
          aria-hidden
        >
          {watermarkLines.map((line, index) => (
            <tspan
              key={line}
              x={(PLOT_LEFT + PLOT_RIGHT) / 2}
              dy={index === 0 ? 0 : watermarkSize * 0.98}
            >
              {line}
            </tspan>
          ))}
        </text>
      ) : null}

      {[PLOT_TOP, (PLOT_TOP + PLOT_BOTTOM) / 2, PLOT_BOTTOM].map((y) => (
        <line
          key={y}
          x1={PLOT_LEFT}
          y1={y}
          x2={PLOT_RIGHT}
          y2={y}
          stroke="rgba(255,255,255,0.055)"
          strokeWidth="0.7"
        />
      ))}

      <path
        d={areaPath}
        fill={`url(#blue-${uid})`}
        clipPath={`url(#above-${uid})`}
      />
      <path
        d={areaPath}
        fill={`url(#pink-${uid})`}
        clipPath={`url(#below-${uid})`}
      />
      <path
        d={linePath}
        fill="none"
        stroke="#5ba6ff"
        strokeWidth="1.55"
        strokeLinecap="round"
        strokeLinejoin="round"
        clipPath={`url(#above-${uid})`}
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={linePath}
        fill="none"
        stroke="#f3b2bf"
        strokeWidth="1.55"
        strokeLinecap="round"
        strokeLinejoin="round"
        clipPath={`url(#below-${uid})`}
        vectorEffect="non-scaling-stroke"
        data-testid="below-entry-segment"
      />

      {openInRange ? (
        <>
          <line
            x1={PLOT_LEFT}
            y1={openY}
            x2={PLOT_RIGHT}
            y2={openY}
            stroke="rgba(190,200,214,0.3)"
            strokeWidth="0.65"
            strokeDasharray="1.5 2.5"
          />
          <text
            x={PLOT_LEFT + 2}
            y={openY - 2}
            className="fill-white/35 text-[6.5px] font-semibold"
            data-testid="open-price-line"
          >
            open
          </text>
        </>
      ) : null}

      <line
        x1={PLOT_LEFT}
        y1={entryY}
        x2={PLOT_RIGHT}
        y2={entryY}
        stroke="rgba(255,255,255,0.28)"
        strokeWidth="0.75"
        strokeDasharray="2 2"
      />
      <line
        x1={entryX}
        y1={PLOT_TOP}
        x2={entryX}
        y2={PLOT_BOTTOM}
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="0.65"
        strokeDasharray="2 2"
      />
      <circle cx={entryX} cy={entryY} r="2.4" fill="#12171f" stroke="#ffd977" strokeWidth="1.2" />
      {openEvent ? (
        <circle
          cx={entryX}
          cy={entryY}
          r="7"
          fill="transparent"
          className="cursor-pointer"
          onClick={(clickEvent) => {
            clickEvent.stopPropagation()
            onSelectEvent?.(openEvent.id)
          }}
        >
          <title>{openEvent.title}</title>
        </circle>
      ) : null}

      <line
        x1={PLOT_RIGHT}
        y1={PLOT_TOP}
        x2={PLOT_RIGHT}
        y2={PLOT_BOTTOM}
        stroke="rgba(255,255,255,0.09)"
        strokeWidth="0.7"
      />
      {showMaxLabel ? (
        <text
          x={PLOT_RIGHT - 2}
          y={maxLabelY}
          textAnchor="end"
          className="fill-ink-muted text-[8.4px]"
          data-testid="max-price-label"
        >
          {formatAxisPrice(max)}
        </text>
      ) : null}
      {showMinLabel ? (
        <text
          x={PLOT_RIGHT - 2}
          y={minLabelY}
          textAnchor="end"
          className="fill-ink-muted text-[8.4px]"
          data-testid="min-price-label"
        >
          {formatAxisPrice(min)}
        </text>
      ) : null}

      {/* A fully-rounded callout with a tail back to the last plotted point.
          Reads against the entry line: green above it, light red below. */}
      {/* Bubble and tail are one closed path — as two overlapping translucent
          shapes the shared area doubled up and read as a third colour. */}
      <path
        d={calloutPath(currentLabelY, currentY)}
        fill={currentBelowEntry ? 'rgba(120,32,48,0.92)' : 'rgba(10,86,60,0.92)'}
        stroke={currentBelowEntry ? 'rgba(255,150,175,0.85)' : 'rgba(52,211,153,0.85)'}
        strokeWidth="0.8"
        strokeLinejoin="round"
        style={{
          filter: currentBelowEntry
            ? 'drop-shadow(0 0 2px rgba(255,120,150,0.35))'
            : 'drop-shadow(0 0 2px rgba(52,255,180,0.35))',
        }}
      />
      <circle
        cx={PLOT_RIGHT - 1}
        cy={currentY}
        r="2"
        fill={currentBelowEntry ? '#ffd9e1' : '#7ff0c0'}
      />
      <text
        x={PLOT_RIGHT - 28}
        y={currentLabelY + 2.5}
        textAnchor="middle"
        className="fill-white text-[9.5px] font-bold"
      >
        {formatAxisPrice(currentPrice)}
      </text>

      {axisTicks.map((tick, index) => (
        <text
          key={tick.key}
          x={tick.x}
          y={HEIGHT - 2}
          textAnchor={index === 0 ? 'start' : index === axisTicks.length - 1 ? 'end' : 'middle'}
          className="fill-ink-muted text-[8.4px]"
        >
          {tick.label}
        </text>
      ))}
      <text x={PLOT_LEFT + 24} y={entryY - 3.5} className="fill-[#bda45f] text-[8px] font-bold">
        entry {formatAxisPrice(entryPrice)}
      </text>
    </svg>

      {markers.map(({ event, leftPct, top }) => {
        const active = event.id === selectedEventId
        const plan = isPlanEvent(event.kind)
        return (
          <button
            key={event.id}
            type="button"
            title={event.title}
            aria-label={`${event.title}. Show details.`}
            aria-pressed={active}
            onClick={(clickEvent) => {
              clickEvent.stopPropagation()
              onSelectEvent?.(event.id)
            }}
            style={{ left: `${leftPct}%`, top }}
            className={cn(
              'absolute grid h-[17px] w-[17px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border transition-[transform,background-color,border-color] active:scale-90',
              plan
                ? 'border-[#ca8eff]/28 bg-[#1d1030]/48 text-[#d9b3ff]/55'
                : 'border-amber-300/26 bg-[#1d1708]/48 text-amber-200/55',
              active &&
                (plan
                  ? 'scale-110 border-[#e0c0ff] bg-[#6b2fb0]/60 text-white'
                  : 'scale-110 border-amber-200 bg-amber-400/35 text-white'),
            )}
          >
            {plan ? <ListChecks size={9.5} strokeWidth={2.6} /> : <Hammer size={9.5} strokeWidth={2.6} />}
          </button>
        )
      })}
    </div>
  )
}

function buildChart(data: HistoryPoint[], entryPrice: number, entryDate: string) {
  if (data.length < 2) return null

  const entryTime = new Date(entryDate).getTime() / 1000
  let entryIndex = 0
  for (let index = 1; index < data.length; index += 1) {
    if (Math.abs(data[index].time - entryTime) < Math.abs(data[entryIndex].time - entryTime)) {
      entryIndex = index
    }
  }

  // The actual fill at entry is authoritative and must always be represented.
  const values = data.map((point, index) => (index === entryIndex ? entryPrice : point.value))
  const rawMin = Math.min(entryPrice, ...values)
  const rawMax = Math.max(entryPrice, ...values)
  const rawSpan = Math.max(rawMax - rawMin, Math.max(entryPrice * 0.08, 0.5))
  // Keep a little breathing room above peaks, but avoid wasting the lower
  // portion of a compact mobile chart on empty domain padding.
  const min = Math.max(0, rawMin - rawSpan * 0.035)
  const max = rawMax + rawSpan * 0.1
  const span = max - min

  const points: ChartPoint[] = data.map((point, index) => ({
    time: point.time,
    value: values[index],
    x: PLOT_LEFT + (index / (data.length - 1)) * (PLOT_RIGHT - PLOT_LEFT),
    y: PLOT_TOP + (1 - (values[index] - min) / span) * (PLOT_BOTTOM - PLOT_TOP),
  }))

  const linePath = smoothPath(points)
  const entryX = points[entryIndex].x
  const entryY = PLOT_TOP + (1 - (entryPrice - min) / span) * (PLOT_BOTTOM - PLOT_TOP)
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${entryY.toFixed(2)} L ${points[0].x.toFixed(2)} ${entryY.toFixed(2)} Z`

  return { points, linePath, areaPath, entryX, entryY, min, max }
}

function smoothPath(points: ChartPoint[]): string {
  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(0, index - 1)]
    const p1 = points[index]
    const p2 = points[index + 1]
    const p3 = points[Math.min(points.length - 1, index + 2)]
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    path += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }
  return path
}

function formatAxisPrice(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`
  if (value >= 100) return `$${value.toFixed(0)}`
  if (value >= 10) return `$${value.toFixed(1)}`
  return `$${value.toFixed(2)}`
}

/**
 * Rounded price bubble with a tail running back to the last plotted point,
 * as a single closed path so the fill never overlaps itself.
 */
function calloutPath(labelY: number, pointY: number): string {
  const left = PLOT_RIGHT - 47
  const right = PLOT_RIGHT - 9
  const top = labelY - 8.5
  const bottom = labelY + 8.5
  const r = 5
  const tail = 3.5

  return [
    `M ${left + r} ${top}`,
    `L ${right - r} ${top}`,
    `Q ${right} ${top} ${right} ${top + r}`,
    `L ${right} ${labelY - tail}`,
    `L ${PLOT_RIGHT - 0.5} ${pointY}`,
    `L ${right} ${labelY + tail}`,
    `L ${right} ${bottom - r}`,
    `Q ${right} ${bottom} ${right - r} ${bottom}`,
    `L ${left + r} ${bottom}`,
    `Q ${left} ${bottom} ${left} ${bottom - r}`,
    `L ${left} ${top + r}`,
    `Q ${left} ${top} ${left + r} ${top}`,
    'Z',
  ].join(' ')
}

/**
 * Sits as high in the plot as the cap height allows, so the wordmark clears
 * the price action rather than sitting behind it.
 */
function watermarkBaseline(size: number): number {
  const raised = PLOT_TOP + size * 1.1 - MM_IN_PX * 3
  return Math.max(size * 0.8, raised)
}

function formatAxisDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'numeric',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(iso))
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
