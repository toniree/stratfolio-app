import { useState } from 'react'
import { cn } from '@/lib/cn'
import { getBrokerage } from '@/data/brokerages'
import { getBrokerageLogoSrc } from '@/data/brandLogos'
import type { BrokerageId } from '@/api/types'

const LOGO_SIZES = {
  xs: 'h-4 w-4 rounded-[5px]',
  sm: 'h-5 w-5 rounded-md',
  md: 'h-6 w-6 rounded-md',
  lg: 'h-8 w-8 rounded-lg',
}

export function BrokerageLogo({
  id,
  size = 'md',
  className,
}: {
  id: BrokerageId
  size?: keyof typeof LOGO_SIZES
  className?: string
}) {
  const brokerage = getBrokerage(id)
  const src = getBrokerageLogoSrc(id)
  const [failed, setFailed] = useState(false)

  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center overflow-hidden border border-white/15 bg-white shadow-sm',
        LOGO_SIZES[size],
        className,
      )}
      aria-hidden
    >
      {failed ? (
        <span
          className="grid h-full w-full place-items-center text-[8px] font-black tracking-tight"
          style={{ backgroundColor: brokerage.badgeBg, color: brokerage.badgeFg }}
        >
          {brokerage.monogram}
        </span>
      ) : (
        <img
          src={src}
          alt=""
          className="h-full w-full object-contain"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  )
}

export function BrokerageBadge({
  id,
  showName = false,
  showMask = false,
  size = 'md',
  className,
}: {
  id: BrokerageId
  showName?: boolean
  showMask?: boolean
  size?: 'sm' | 'md'
  className?: string
}) {
  const brokerage = getBrokerage(id)

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <BrokerageLogo id={id} size={size} />
      {showName || showMask ? (
        <span className="truncate text-[12px] font-semibold text-ink-soft">
          {showName ? brokerage.short : null}
          {showName && showMask ? ' ' : null}
          {showMask ? <span className="num text-ink-muted">{brokerage.accountMask}</span> : null}
        </span>
      ) : (
        <span className="sr-only">{brokerage.name}</span>
      )}
    </span>
  )
}
