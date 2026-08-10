import { useId, useMemo } from 'react'
import { cn } from '@/lib/cn'

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  /** Overrides the automatic up/down colouring. */
  tone?: 'up' | 'down' | 'neutral'
  className?: string
  /** Draw a soft area fill under the line. */
  filled?: boolean
}

const COLORS = {
  up: '#0e9f6e',
  down: '#ef5b53',
  neutral: '#7d8ca4',
}

/**
 * Inline SVG sparkline — deliberately dependency-free so every position card
 * can render one without chart-library overhead.
 */
export function Sparkline({
  data,
  width = 96,
  height = 32,
  tone,
  className,
  filled = true,
}: SparklineProps) {
  const gradientId = useId()

  const { linePath, areaPath, color } = useMemo(() => {
    if (data.length < 2) {
      return { linePath: '', areaPath: '', color: COLORS.neutral }
    }
    const min = Math.min(...data)
    const max = Math.max(...data)
    const span = max - min || 1
    const pad = 2
    const usableH = height - pad * 2

    const points = data.map((value, i) => {
      const x = (i / (data.length - 1)) * width
      const y = pad + (1 - (value - min) / span) * usableH
      return [x, y] as const
    })

    // Smooth the polyline with a light Catmull-Rom → bezier conversion.
    let d = `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)]
      const p1 = points[i]
      const p2 = points[i + 1]
      const p3 = points[Math.min(points.length - 1, i + 2)]
      const c1x = p1[0] + (p2[0] - p0[0]) / 6
      const c1y = p1[1] + (p2[1] - p0[1]) / 6
      const c2x = p2[0] - (p3[0] - p1[0]) / 6
      const c2y = p2[1] - (p3[1] - p1[1]) / 6
      d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`
    }

    const resolvedTone = tone ?? (data[data.length - 1] >= data[0] ? 'up' : 'down')
    return {
      linePath: d,
      areaPath: `${d} L ${width} ${height} L 0 ${height} Z`,
      color: COLORS[resolvedTone],
    }
  }, [data, width, height, tone])

  if (!linePath) {
    return <div className={cn('rounded bg-surface-sunken', className)} style={{ width, height }} />
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('overflow-visible', className)}
      role="img"
      aria-label="Recent price trend"
      preserveAspectRatio="none"
    >
      {filled ? (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.20" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradientId})`} />
        </>
      ) : null}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
