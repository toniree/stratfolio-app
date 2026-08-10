import { useId, useMemo } from 'react'
import { cn } from '@/lib/cn'
import { splitTwoLines, watermarkFontSize } from '@/lib/chartText'
import { MINI_CHART_HEIGHT } from '@/components/charts/PositionMiniChart'

const WIDTH = 190
/** Locked to the position tile's chart so both carousels line up. */
const HEIGHT = MINI_CHART_HEIGHT
const PLOT_LEFT = 2
const PLOT_RIGHT = WIDTH
const PLOT_TOP = 3
const PLOT_BOTTOM = HEIGHT - 11
/** Where history ends and the forward projection begins. */
const NOW_X = WIDTH * 0.62
const MM_IN_PX = 96 / 25.4
/** Steps used to draw each edge of the cone. */
const CONE_STEPS = 22

export interface ThesisConeInput {
  /** Underlying closes, oldest first. */
  history: number[]
  spot: number
  /** Annualised vol as a decimal — drives the width of the cone. */
  volatility: number
  /** Time to expiry in years. */
  years: number
  breakeven: number
  /** Underlying level the premium target implies at expiry. */
  targetLow: number
  targetHigh: number
  entryLow: number
  entryHigh: number
}

/**
 * The trade's whole geometry in one frame: where the underlying has been, the
 * ±1σ cone the market is pricing between now and expiry, and the levels the
 * thesis depends on drawn across both.
 *
 * The argument a trader reads off it instantly is whether break-even sits
 * inside the cone — if it does, the move being asked for is one the option
 * market already considers ordinary.
 */
export function ThesisConeChart({
  symbol,
  watermark,
  input,
  className,
}: {
  symbol: string
  watermark?: string
  input: ThesisConeInput
  className?: string
}) {
  const uid = useId().replace(/:/g, '')
  const { history, spot, volatility, years, breakeven, targetLow, targetHigh } = input

  const series = useMemo(
    () => (history.length > 1 ? history.slice(-90) : [spot, spot]),
    [history, spot],
  )

  // One sigma at expiry sets both the cone and the vertical domain.
  const sigma = Math.max(volatility, 0.05) * Math.sqrt(Math.max(years, 1 / 365))
  const coneHigh = spot * Math.exp(sigma)
  const coneLow = spot * Math.exp(-sigma)

  const candidates = [
    ...series,
    coneHigh,
    coneLow,
    breakeven,
    targetLow,
    targetHigh,
    spot,
  ].filter((value) => Number.isFinite(value) && value > 0)
  const rawMax = Math.max(...candidates)
  const rawMin = Math.min(...candidates)
  const pad = Math.max((rawMax - rawMin) * 0.07, rawMax * 0.004)
  const max = rawMax + pad
  const min = Math.max(0, rawMin - pad)
  const span = Math.max(max - min, 0.01)

  const y = (value: number) => PLOT_TOP + (1 - (value - min) / span) * (PLOT_BOTTOM - PLOT_TOP)
  const historyX = (index: number) =>
    PLOT_LEFT + (index / Math.max(series.length - 1, 1)) * (NOW_X - PLOT_LEFT)

  const linePath = series
    .map((value, index) => `${index === 0 ? 'M' : 'L'} ${historyX(index).toFixed(2)} ${y(value).toFixed(2)}`)
    .join(' ')

  // Cone edges widen with √t, so the shape is a parabola rather than a wedge.
  const upper: string[] = []
  const lower: string[] = []
  for (let step = 0; step <= CONE_STEPS; step++) {
    const fraction = step / CONE_STEPS
    const x = NOW_X + fraction * (PLOT_RIGHT - NOW_X)
    const drift = sigma * Math.sqrt(fraction)
    upper.push(`${x.toFixed(2)} ${y(spot * Math.exp(drift)).toFixed(2)}`)
    lower.push(`${x.toFixed(2)} ${y(spot * Math.exp(-drift)).toFixed(2)}`)
  }
  const conePath = `M ${upper.join(' L ')} L ${lower.reverse().join(' L ')} Z`

  const watermarkLines = watermark ? splitTwoLines(watermark) : null
  const watermarkSize = watermarkLines
    ? watermarkFontSize(watermarkLines, PLOT_RIGHT - PLOT_LEFT - 12)
    : 0
  const watermarkY = Math.max(
    watermarkSize * 0.8,
    PLOT_TOP + watermarkSize * 1.1 - MM_IN_PX * 3,
  )

  const targetTop = y(Math.max(targetLow, targetHigh))
  const targetBottom = y(Math.min(targetLow, targetHigh))
  const breakevenY = y(breakeven)
  const spotY = y(spot)
  // Break-even inside the cone is the headline: the move is already priced.
  const breakevenInsideCone = breakeven <= coneHigh && breakeven >= coneLow

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      width="100%"
      height={HEIGHT}
      role="img"
      aria-label={`${symbol} setup: spot ${spot.toFixed(2)}, break-even ${breakeven.toFixed(2)}, one sigma to expiry ${coneLow.toFixed(2)} to ${coneHigh.toFixed(2)}`}
      className={cn('min-w-0 overflow-visible', className)}
    >
      <defs>
        <linearGradient id={`cone-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#5ba6ff" stopOpacity="0.24" />
          <stop offset="100%" stopColor="#5ba6ff" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {watermarkLines ? (
        <text
          x={(PLOT_LEFT + PLOT_RIGHT) / 2}
          y={watermarkY}
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

      {[PLOT_TOP, (PLOT_TOP + PLOT_BOTTOM) / 2, PLOT_BOTTOM].map((line) => (
        <line
          key={line}
          x1={PLOT_LEFT}
          y1={line}
          x2={PLOT_RIGHT}
          y2={line}
          stroke="rgba(255,255,255,0.055)"
          strokeWidth="0.7"
        />
      ))}

      {/* Target band the thesis is playing for. */}
      <rect
        x={PLOT_LEFT}
        y={targetTop}
        width={PLOT_RIGHT - PLOT_LEFT}
        height={Math.max(targetBottom - targetTop, 1)}
        fill="rgba(52,211,153,0.13)"
      />
      <line
        x1={PLOT_LEFT}
        y1={targetTop}
        x2={PLOT_RIGHT}
        y2={targetTop}
        stroke="rgba(52,211,153,0.5)"
        strokeWidth="0.6"
        strokeDasharray="3 2"
      />

      {/* The ±1σ distribution between now and expiry. */}
      <path d={conePath} fill={`url(#cone-${uid})`} />
      <path
        d={`M ${upper.join(' L ')}`}
        fill="none"
        stroke="rgba(91,166,255,0.45)"
        strokeWidth="0.65"
        strokeDasharray="2 2"
      />
      <path
        d={`M ${lower.slice().reverse().join(' L ')}`}
        fill="none"
        stroke="rgba(91,166,255,0.45)"
        strokeWidth="0.65"
        strokeDasharray="2 2"
      />

      <path
        d={linePath}
        fill="none"
        stroke="#5ba6ff"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* Break-even: amber when the cone covers it, red when it does not. */}
      <line
        x1={PLOT_LEFT}
        y1={breakevenY}
        x2={PLOT_RIGHT}
        y2={breakevenY}
        stroke={breakevenInsideCone ? 'rgba(224,196,118,0.85)' : 'rgba(248,113,113,0.85)'}
        strokeWidth="0.75"
        strokeDasharray="2.5 2"
        data-testid="thesis-breakeven"
        data-inside-cone={breakevenInsideCone || undefined}
      />
      <text
        x={PLOT_LEFT + 2}
        y={breakevenY - 3}
        className={cn(
          'text-[8px] font-bold',
          breakevenInsideCone ? 'fill-[#e0c476]' : 'fill-[#ff9aad]',
        )}
      >
        b/e {breakeven.toFixed(2)}
      </text>

      <line
        x1={NOW_X}
        y1={PLOT_TOP}
        x2={NOW_X}
        y2={PLOT_BOTTOM}
        stroke="rgba(255,255,255,0.16)"
        strokeWidth="0.65"
        strokeDasharray="2 2"
      />
      <circle cx={NOW_X} cy={spotY} r="2.1" fill="#12171f" stroke="#5ba6ff" strokeWidth="1.2" />

      <text
        x={PLOT_RIGHT - 2}
        y={y(coneHigh) + 6}
        textAnchor="end"
        className="fill-[#8fc4ff] text-[7.5px] font-semibold"
      >
        +1σ {coneHigh.toFixed(0)}
      </text>
      <text
        x={PLOT_RIGHT - 2}
        y={y(coneLow) - 2}
        textAnchor="end"
        className="fill-[#8fc4ff] text-[7.5px] font-semibold"
      >
        −1σ {coneLow.toFixed(0)}
      </text>

      <text x={PLOT_LEFT + 1} y={HEIGHT - 2} className="fill-ink-muted text-[8.4px]">
        history
      </text>
      <text x={NOW_X} y={HEIGHT - 2} textAnchor="middle" className="fill-ink-muted text-[8.4px]">
        now
      </text>
      <text
        x={PLOT_RIGHT - 2}
        y={HEIGHT - 2}
        textAnchor="end"
        className="fill-ink-muted text-[8.4px]"
      >
        exp
      </text>
    </svg>
  )
}
