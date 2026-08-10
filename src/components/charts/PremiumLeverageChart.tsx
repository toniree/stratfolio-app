import { useId, useMemo } from 'react'
import { cn } from '@/lib/cn'
import { blackScholes } from '@/lib/blackScholes'

const WIDTH = 190
/** Exported so the thesis rail can clamp itself to the charts beside it. */
export const PREMIUM_LEVERAGE_HEIGHT = 92
const HEIGHT = PREMIUM_LEVERAGE_HEIGHT
const PLOT_LEFT = 2
const PLOT_RIGHT = WIDTH - 22
const PLOT_TOP = 11
const PLOT_BOTTOM = HEIGHT - 12
const SAMPLES = 48
/** Return the curve is clipped at; a long option can only lose its debit. */
const MIN_RETURN = -100

export interface PremiumLeverageInput {
  spot: number
  strike: number
  right: 'CALL' | 'PUT'
  /** Annualised vol as a decimal. */
  volatility: number
  /** Time to expiry in years. */
  years: number
  /** Debit paid per share. */
  debit: number
  /** Underlying level the premium target implies. */
  targetUnderlying: number
  breakeven: number
}

/**
 * How fast the premium pays for a given move in the underlying, sampled at
 * three points in the contract's life.
 *
 * This is the chart a momentum premium buyer actually trades off: the gap
 * between the "now" curve and the expiry hockey stick *is* the extrinsic value
 * they are renting, and the steepness of the "now" curve near spot is the
 * leverage they are buying. A flat curve near spot means the strike is too far
 * out to respond to the move the thesis predicts.
 */
export function PremiumLeverageChart({
  input,
  className,
}: {
  input: PremiumLeverageInput
  className?: string
}) {
  const uid = useId().replace(/:/g, '')
  const { spot, strike, right, volatility, years, debit, targetUnderlying, breakeven } = input

  const curves = useMemo(() => {
    const call = right === 'CALL'
    // Frame the move the thesis needs, plus room the other way for the risk.
    const favourable = Math.max(targetUnderlying, breakeven, spot * (call ? 1.28 : 1))
    const adverse = Math.min(spot * (call ? 0.82 : 0.72), targetUnderlying, breakeven)
    const low = Math.max(0.01, Math.min(adverse, spot * 0.8))
    const high = Math.max(favourable, spot * 1.05)

    const priceAt = (underlying: number, t: number) =>
      blackScholes({ spot: underlying, strike, years: t, volatility, right }).price

    const slices: { key: string; years: number; label: string }[] = [
      { key: 'now', years, label: 'now' },
      { key: 'half', years: years / 2, label: '½' },
      { key: 'exp', years: 0, label: 'exp' },
    ]

    const sampled = slices.map((slice) => ({
      ...slice,
      points: Array.from({ length: SAMPLES + 1 }, (_, i) => {
        const underlying = low + ((high - low) * i) / SAMPLES
        const value = priceAt(underlying, slice.years)
        const ret = debit > 0 ? ((value - debit) / debit) * 100 : 0
        return { underlying, ret: Math.max(MIN_RETURN, ret) }
      }),
    }))

    const maxReturn = Math.max(
      ...sampled.flatMap((slice) => slice.points.map((point) => point.ret)),
      50,
    )
    return { low, high, slices: sampled, maxReturn }
  }, [spot, strike, right, volatility, years, debit, targetUnderlying, breakeven])

  const { low, high, slices, maxReturn } = curves
  const ceiling = Math.ceil(maxReturn / 50) * 50
  const x = (underlying: number) =>
    PLOT_LEFT + ((underlying - low) / Math.max(high - low, 0.01)) * (PLOT_RIGHT - PLOT_LEFT)
  const y = (ret: number) =>
    PLOT_BOTTOM - ((ret - MIN_RETURN) / (ceiling - MIN_RETURN)) * (PLOT_BOTTOM - PLOT_TOP)

  const path = (points: { underlying: number; ret: number }[]) =>
    points
      .map((point, i) => `${i === 0 ? 'M' : 'L'} ${x(point.underlying).toFixed(2)} ${y(point.ret).toFixed(2)}`)
      .join(' ')

  const zeroY = y(0)
  const expiry = slices[slices.length - 1]
  // Shade the region where the expiry payoff is actually in profit.
  const profitArea = `${path(expiry.points.filter((p) => p.ret >= 0))} L ${x(high).toFixed(2)} ${zeroY.toFixed(2)} L ${x(breakeven).toFixed(2)} ${zeroY.toFixed(2)} Z`

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      width="100%"
      height={HEIGHT}
      role="img"
      aria-label="Premium return against the underlying, sampled now, at mid-life and at expiry"
      className={cn('min-w-0 overflow-visible', className)}
    >
      <defs>
        <linearGradient id={`profit-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      <text x={PLOT_LEFT} y={6} className="fill-ink-muted text-[7px] font-bold tracking-[0.07em] uppercase">
        Premium vs move
      </text>

      <path d={profitArea} fill={`url(#profit-${uid})`} />

      {/* Break-even in return terms: the line the trade has to clear. */}
      <line
        x1={PLOT_LEFT}
        y1={zeroY}
        x2={PLOT_RIGHT}
        y2={zeroY}
        stroke="rgba(224,196,118,0.6)"
        strokeWidth="0.65"
        strokeDasharray="2.5 2"
      />
      <text x={PLOT_RIGHT + 2} y={zeroY + 2.4} className="fill-[#e0c476] text-[7px] font-semibold">
        0%
      </text>
      <text x={PLOT_RIGHT + 2} y={PLOT_TOP + 3} className="fill-up text-[7px] font-semibold">
        +{ceiling}%
      </text>
      <text x={PLOT_RIGHT + 2} y={PLOT_BOTTOM} className="fill-down text-[7px] font-semibold">
        −100%
      </text>

      {/* Where the underlying sits today. */}
      <line
        x1={x(spot)}
        y1={PLOT_TOP}
        x2={x(spot)}
        y2={PLOT_BOTTOM}
        stroke="rgba(255,255,255,0.2)"
        strokeWidth="0.65"
        strokeDasharray="2 2"
      />
      {targetUnderlying > low && targetUnderlying < high ? (
        <line
          x1={x(targetUnderlying)}
          y1={PLOT_TOP}
          x2={x(targetUnderlying)}
          y2={PLOT_BOTTOM}
          stroke="rgba(52,211,153,0.45)"
          strokeWidth="0.65"
          strokeDasharray="2 2"
        />
      ) : null}

      {slices.map((slice, index) => (
        <path
          key={slice.key}
          d={path(slice.points)}
          fill="none"
          stroke={index === 0 ? '#5ba6ff' : index === 1 ? 'rgba(91,166,255,0.55)' : '#e6edf7'}
          strokeWidth={index === 2 ? 1.2 : 1}
          strokeDasharray={index === 1 ? '3 2' : undefined}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          data-testid={`leverage-${slice.key}`}
        />
      ))}

      <text x={PLOT_LEFT} y={HEIGHT - 3} className="fill-ink-muted text-[7px]">
        {((low / spot - 1) * 100).toFixed(0)}%
      </text>
      <text
        x={x(spot)}
        y={HEIGHT - 3}
        textAnchor="middle"
        className="fill-ink-muted text-[7px]"
      >
        spot
      </text>
      <text
        x={PLOT_RIGHT}
        y={HEIGHT - 3}
        textAnchor="end"
        className="fill-ink-muted text-[7px]"
      >
        +{((high / spot - 1) * 100).toFixed(0)}%
      </text>

      {/* Legend, kept to three glyphs so it never competes with the curves. */}
      <g>
        <line x1={PLOT_RIGHT - 46} y1={5} x2={PLOT_RIGHT - 38} y2={5} stroke="#5ba6ff" strokeWidth="1" />
        <text x={PLOT_RIGHT - 36} y={7} className="fill-ink-muted text-[6.5px]">now</text>
        <line
          x1={PLOT_RIGHT - 24}
          y1={5}
          x2={PLOT_RIGHT - 16}
          y2={5}
          stroke="rgba(91,166,255,0.55)"
          strokeWidth="1"
          strokeDasharray="3 2"
        />
        <text x={PLOT_RIGHT - 14} y={7} className="fill-ink-muted text-[6.5px]">½</text>
        <line x1={PLOT_RIGHT - 8} y1={5} x2={PLOT_RIGHT} y2={5} stroke="#e6edf7" strokeWidth="1.2" />
        <text x={PLOT_RIGHT + 2} y={7} className="fill-ink-muted text-[6.5px]">exp</text>
      </g>
    </svg>
  )
}
