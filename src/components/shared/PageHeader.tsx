import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Every route's header.
 *
 * Mobile and desktop want different things from this: a phone wants a centred
 * lockup that reads like an app bar over the back button, while a desktop
 * wants a left-aligned page title. Both live here rather than in each route,
 * because when they lived in the routes only two of ten pages got the mobile
 * treatment and the rest silently fell back to a bare heading.
 */
export function PageHeader({
  title,
  mobileTitle,
  mobileSubtitle,
  subtitle,
  backTo,
  backLabel,
  aside,
}: {
  /** Desktop heading. Omit when the page's first card already names itself. */
  title?: ReactNode
  /** Centred mobile lockup. Falls back to `title` when omitted. */
  mobileTitle?: ReactNode
  /** Small caption under the mobile lockup. */
  mobileSubtitle?: string
  subtitle?: string
  backTo?: string
  backLabel?: string
  aside?: ReactNode
}) {
  const mobile = mobileTitle ?? title

  return (
    <header
      className={cn(
        'relative space-y-1.5',
        // The mobile lockup is absolutely positioned, so without a back button
        // in flow the header has no height and overlaps whatever follows it.
        !backTo && mobile && 'min-h-[30px] lg:min-h-0',
      )}
    >
      {backTo ? (
        <Link to={backTo} aria-label={backLabel || 'Back'} className="nav-gloss-button h-9 w-9">
          <ChevronLeft size={17} strokeWidth={2.4} />
        </Link>
      ) : null}

      {/* Centred over the back button, which keeps its own row. */}
      {mobile ? (
      <span
        className={cn(
          'absolute inset-x-10 text-center lg:hidden',
          backTo ? 'top-[calc(0.25rem-3mm)]' : 'top-0',
        )}
      >
        <span className="mobile-logo-text inline-flex items-center justify-center gap-1.5 text-[15px] leading-5 text-[#dce3ec]">
          {mobile}
        </span>
        {mobileSubtitle ? (
          <span className="mt-0.5 block text-[7px] leading-tight font-medium tracking-normal text-[#8d99a8] [-webkit-text-fill-color:currentColor]">
            {mobileSubtitle}
          </span>
        ) : null}
      </span>
      ) : null}

      {title ? (
      <div className="hidden flex-wrap items-baseline justify-between gap-x-4 gap-y-1 lg:flex">
        <h1 className="text-[24px] leading-tight font-extrabold tracking-[-0.025em] text-ink sm:text-[27px]">
          {title}
        </h1>
        {aside}
      </div>
      ) : null}

      {subtitle ? <p className="hidden text-[13px] text-ink-soft lg:block">{subtitle}</p> : null}
    </header>
  )
}
