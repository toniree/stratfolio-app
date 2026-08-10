import { useState } from 'react'
import { cn } from '@/lib/cn'
import { hashString } from '@/lib/prng'
import { getCompanyLogoSrc } from '@/data/brandLogos'

const SIZES = {
  xs: { box: 18, radius: 5, logo: 'h-[72%] w-[72%]', text: 'text-[7px]' },
  sm: { box: 26, radius: 8, logo: 'h-[68%] w-[68%]', text: 'text-[9px]' },
  md: { box: 34, radius: 10, logo: 'h-[68%] w-[68%]', text: 'text-[11px]' },
  lg: { box: 44, radius: 13, logo: 'h-[70%] w-[70%]', text: 'text-[13px]' },
}

const FALLBACK_COLORS = [
  ['#245aa8', '#3b82f6'],
  ['#14735a', '#34d399'],
  ['#80531f', '#e59a42'],
  ['#5d3f91', '#8b6de0'],
  ['#84314e', '#d94f79'],
] as const

/**
 * Locally bundled company mark with a deterministic ticker fallback.
 * The white tile mirrors the compact identity treatment used by trading apps
 * and keeps black or multicolor brand art legible on the dark glass surface.
 */
export function SymbolIcon({
  symbol,
  size = 'md',
  className,
  shape = 'circle',
}: {
  symbol: string
  size?: keyof typeof SIZES
  className?: string
  /** Circular glossy dome by default; `squircle` is the legacy tile shape. */
  shape?: 'squircle' | 'circle'
}) {
  const normalized = symbol.trim().toUpperCase()
  const src = getCompanyLogoSrc(normalized)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const dim = SIZES[size]
  const colors = FALLBACK_COLORS[hashString(normalized) % FALLBACK_COLORS.length]
  const showLogo = Boolean(src && failedSrc !== src)
  const circle = shape === 'circle'

  return (
    <span
      className={cn('relative inline-flex shrink-0', className)}
      style={{ width: dim.box, height: dim.box }}
      role="img"
      aria-label={`${normalized} company logo`}
    >
      <span
        className={cn(
          'relative grid h-full w-full place-items-center overflow-hidden bg-white',
          circle
            ? 'border border-white/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-3px_6px_-3px_rgba(0,0,0,0.28),0_5px_14px_-7px_rgba(0,0,0,0.85)]'
            : 'border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_14px_-8px_rgba(0,0,0,0.8)]',
        )}
        style={{ borderRadius: circle ? 9999 : dim.radius }}
      >
        {showLogo ? (
          <img
            src={src}
            alt=""
            className={cn('object-contain', dim.logo)}
            loading="lazy"
            decoding="async"
            onError={() => setFailedSrc(src ?? null)}
          />
        ) : (
          <span
            className={cn(
              'grid h-full w-full place-items-center font-black tracking-[-0.04em] text-white',
              dim.text,
            )}
            style={{ background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})` }}
          >
            {normalized.slice(0, 2)}
          </span>
        )}
        {circle ? (
          <span
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.14) 38%, rgba(255,255,255,0) 55%)',
              mixBlendMode: 'overlay',
            }}
            aria-hidden
          />
        ) : null}
      </span>

    </span>
  )
}
