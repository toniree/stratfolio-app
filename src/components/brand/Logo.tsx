import { useId } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'gradient' | 'mono' | 'inverse'

const PLINTH_PATH = 'M10.6 39h26.8a2 2 0 0 1 2 2v1.1a2 2 0 0 1-2 2H10.6a2 2 0 0 1-2-2V41a2 2 0 0 1 2-2z'
const KNIGHT_PATH = 'M30.4 1.8 33.6 9.2c3 3 4.8 7 4.8 11.4V39H13.6v-3.6c0-4 1.6-7.8 4.5-10.6L21 22c-2.8 1-5.7 1.6-8.7 1.9l-2.9.3c-2.5.3-4.5-2-4-4.5.3-1.5 1.5-2.6 3-2.8l4-.6c3.5-.6 6.6-2.4 8.9-5.1l3.5-4.2c1.2-1.4 2.8-2.4 4.6-2.8z'

/**
 * StratFolio mark — a chess knight whose mane resolves into a rising arrow.
 *
 * The knight is the strategy half of the name; the arrow cut out of its mane is
 * the folio half. Drawn as a single filled silhouette with the arrow knocked
 * out, so it stays readable as one shape down to ~20px where a detailed
 * outline would turn to mud.
 */
export function LogoMark({
  size = 32,
  variant = 'gradient',
  className,
  trace = false,
}: {
  size?: number
  variant?: Variant
  className?: string
  /** Animate a highlight around the mark's silhouette. */
  trace?: boolean
}) {
  const id = useId().replace(/:/g, '')
  const gradientId = `sf-mark-${id}`
  const traceGradientId = `sf-trace-${id}`
  const maskId = `sf-mask-${id}`

  const fill =
    variant === 'gradient'
      ? `url(#${gradientId})`
      : variant === 'inverse'
        ? '#ffffff'
        : 'currentColor'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={cn('shrink-0', className)}
      role="img"
      aria-label="StratFolio"
      fill="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="4" y1="44" x2="44" y2="4" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="52%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
        <linearGradient id={traceGradientId} x1="5" y1="43" x2="41" y2="4" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#5ba6ff" />
          <stop offset="100%" stopColor="#c98bff" />
        </linearGradient>

        {/* The rising arrow is knocked out of the knight, not drawn on top of
            it — that keeps the mark a single silhouette at any size. */}
        {/* A single breakout step — rise, one short pullback, then a decisive
            climb into the head. The direction change is a light suggestion of
            a chart, not the subject; more segments than this turn to a squiggle
            at nav size. Knocked out of the neck rather than drawn on top of it,
            so the mark stays a single silhouette, and kept below the jawline so
            it never eats the horse's head. */}
        <mask id={maskId}>
          <rect width="48" height="48" fill="#fff" />
          <path
            d="M16.4 36.8 L22.6 30.2 L26.4 33.4 L33.8 27.1"
            stroke="#000"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* Solid triangular head. A stroked chevron disappears at 24px; a
              filled head holds its shape all the way down to favicon size. */}
          <path d="M36.24 25.03 L33.64 31.84 L29.10 26.52 Z" fill="#000" />
        </mask>
      </defs>

      <g mask={`url(#${maskId})`} fill={fill}>
        {/* Plinth */}
        <path d={PLINTH_PATH} />
        {/* Knight, facing left. Traced clockwise from the ear tip: back of the
            ear, down the mane, across the base of the neck, up the chest to
            the throat, out along the jaw to the muzzle, around the nose, then
            back up the length of the face to the forehead. */}
        <path d={KNIGHT_PATH} />
      </g>

      {trace ? (
        <g
          mask={`url(#${maskId})`}
          fill="none"
          stroke={`url(#${traceGradientId})`}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d={KNIGHT_PATH} pathLength={100} className="sf-logo-trace" />
          <path d={PLINTH_PATH} pathLength={100} className="sf-logo-trace sf-logo-trace-delayed" />
        </g>
      ) : null}
    </svg>
  )
}

/** Full lockup: mark plus wordmark. */
export function Logo({
  className,
  wordmarkClassName,
  compact = false,
  size = 32,
  variant = 'gradient',
}: {
  className?: string
  wordmarkClassName?: string
  compact?: boolean
  size?: number
  variant?: Variant
}) {
  return (
    // Tight lockup: the wordmark sits close enough to the mark that the two
    // read as one unit, nudged down a hair to optically centre against the
    // knight (whose visual mass sits below the geometric centre).
    <span className={cn('inline-flex items-center gap-[5px]', className)}>
      <LogoMark size={size} variant={variant} />
      {!compact ? (
        <span
          className={cn(
            'translate-y-[0.5px] text-[20px] leading-none font-extrabold tracking-[-0.03em]',
            wordmarkClassName,
          )}
        >
          {variant === 'inverse' ? (
            // On the gradient chrome the wordmark goes white, with the second
            // half dropped to a light grey to keep the two-tone reading.
            <span className="text-white">
              Strat<span className="text-brand-300">Folio</span>
            </span>
          ) : (
            <span className="text-ink">
              Strat<span className="ai-text">Folio</span>
            </span>
          )}
        </span>
      ) : null}
    </span>
  )
}
