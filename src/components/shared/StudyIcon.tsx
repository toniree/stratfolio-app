import { cn } from '@/lib/cn'

const TEETH = 8
const CX = 12
const CY = 13.8
/** Radius of the gear body, between the teeth. */
const ROOT_R = 5.05
/** Radius out to the tooth tips. */
const TIP_R = 7.95
/** Half-width of a tooth at its root and at its tip, in degrees. */
const ROOT_HALF = 16
const TIP_HALF = 9

const point = (radius: number, degrees: number) => {
  const radians = (degrees * Math.PI) / 180
  return `${(CX + radius * Math.cos(radians)).toFixed(2)} ${(CY + radius * Math.sin(radians)).toFixed(2)}`
}

/**
 * The gear as one closed outline rather than a body plus separate teeth.
 *
 * A single path is what lets the highlight trace the real silhouette — teeth
 * included — instead of orbiting a circle drawn around it.
 */
const GEAR_PATH = (() => {
  const step = 360 / TEETH
  const segments: string[] = [`M ${point(ROOT_R, -90 - ROOT_HALF)}`]

  for (let i = 0; i < TEETH; i++) {
    const centre = -90 + i * step
    segments.push(
      `L ${point(TIP_R, centre - TIP_HALF)}`,
      `A ${TIP_R} ${TIP_R} 0 0 1 ${point(TIP_R, centre + TIP_HALF)}`,
      `L ${point(ROOT_R, centre + ROOT_HALF)}`,
      `A ${ROOT_R} ${ROOT_R} 0 0 1 ${point(ROOT_R, centre + step - ROOT_HALF)}`,
    )
  }

  return `${segments.join(' ')} Z`
})()

/** Mortarboard outline, drawn flat and tipped by the group transform. */
const BOARD_PATH = 'M12 1.9 L19.2 5.2 L12 8.5 L4.8 5.2 Z'
const CAP_BASE_PATH = 'M9 6.9 L9 8.7 Q12 10.2 15 8.7 L15 6.9'
const TASSEL_PATH = 'M18.4 5.8 L18.4 9.1'

/**
 * The studies control: a settings gear read as a face, wearing a mortarboard
 * at a jaunty angle. Drawn as line art so it sits beside the app's other
 * outlined icons, with a highlight that traces the gear and cap outlines
 * themselves.
 */
export function StudyIcon({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.05"
      strokeLinejoin="round"
      strokeLinecap="round"
      className={cn('shrink-0', className)}
      aria-hidden
    >
      {/* The resting outline sits back so the travelling highlight reads as
          the bright element rather than competing with it. */}
      <g opacity="0.42">
        {/* ---- Gear head ---- */}
        <path d={GEAR_PATH} />

        {/* ---- Face, light enough not to muddy the outline at 22px ---- */}
        <circle cx="10.1" cy="13.1" r="0.62" fill="currentColor" stroke="none" />
        <circle cx="13.9" cy="13.1" r="0.62" fill="currentColor" stroke="none" />
        <path d="M10.2 15.6 Q12 17 13.8 15.6" strokeWidth="0.85" />

        {/* ---- Mortarboard ---- */}
        <g transform={`rotate(-14 ${CX} 5.2)`}>
          <path d={BOARD_PATH} />
          <path d={CAP_BASE_PATH} />
          <path d={TASSEL_PATH} strokeWidth="0.85" />
          <circle cx="18.4" cy="9.9" r="0.85" fill="currentColor" stroke="none" />
        </g>
      </g>

      {/* ---- Highlight tracing both outlines ---- */}
      <g
        stroke="url(#study-trace-gradient)"
        strokeWidth="1.25"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={GEAR_PATH} className="study-trace" pathLength={100} />
        <path
          d={BOARD_PATH}
          className="study-trace"
          pathLength={100}
          transform={`rotate(-14 ${CX} 5.2)`}
        />
      </g>

      <defs>
        <linearGradient id="study-trace-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5ba6ff" />
          <stop offset="100%" stopColor="#c98bff" />
        </linearGradient>
      </defs>
    </svg>
  )
}
