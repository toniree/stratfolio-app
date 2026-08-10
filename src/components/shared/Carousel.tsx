import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

interface CarouselProps {
  title: string
  titleIcon?: ReactNode
  titleClassName?: string
  /** Compact metadata rendered on the same baseline as the title. */
  titleMeta?: ReactNode
  /** Shows the currently snapped card's one-based position. */
  showPosition?: boolean
  subtitle?: ReactNode
  /** Route for the row's "See all" affordance. */
  seeAllTo?: string
  seeAllLabel?: string
  /** Compact control rendered immediately before the See all link. */
  headerAction?: ReactNode
  eyebrow?: ReactNode
  children: ReactNode
  className?: string
  /** Rendered instead of the track when there is nothing to show. */
  empty?: ReactNode
  itemCount: number
}

/**
 * One horizontal scroll-snap row, used for every carousel on the home surface.
 *
 * Native overflow scrolling does the work — that gives real touch/trackpad
 * momentum for free. Arrows are a desktop affordance layered on top, and the
 * track itself is focusable so arrow keys scroll it for keyboard users.
 */
export function Carousel({
  title,
  titleIcon,
  titleClassName,
  titleMeta,
  showPosition = false,
  subtitle,
  seeAllTo,
  seeAllLabel = 'see all',
  headerAction,
  eyebrow,
  children,
  className,
  empty,
  itemCount,
}: CarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const sync = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setAtStart(el.scrollLeft <= 2)
    setAtEnd(el.scrollLeft >= max - 2)

    const items = Array.from(el.children).slice(0, itemCount) as HTMLElement[]
    if (items.length > 0) {
      const leadingOffset = items[0].offsetLeft
      const viewportStart = el.scrollLeft + leadingOffset
      const nearest = items.reduce(
        (best, item, index) =>
          Math.abs(item.offsetLeft - viewportStart) < best.distance
            ? { index, distance: Math.abs(item.offsetLeft - viewportStart) }
            : best,
        { index: 0, distance: Number.POSITIVE_INFINITY },
      )
      setActiveIndex(nearest.index)
    } else {
      setActiveIndex(0)
    }
  }, [itemCount])

  useEffect(() => {
    sync()
    const el = trackRef.current
    if (!el) return
    const observer = new ResizeObserver(sync)
    observer.observe(el)
    return () => observer.disconnect()
  }, [sync, itemCount])

  const scrollByPage = (direction: 1 | -1) => {
    const el = trackRef.current
    if (!el) return
    el.scrollBy({ left: direction * el.clientWidth * 0.82, behavior: 'smooth' })
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      scrollByPage(1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      scrollByPage(-1)
    }
  }

  return (
    <section className={cn('min-w-0', className)}>
      {/* Controls share the title's row so they stay centred on it whether or
          not the row carries a subtitle. */}
      <header className="relative mb-1.5 px-0.5">
        {eyebrow}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <h2
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 text-[18px] leading-tight font-extrabold tracking-[-0.02em] text-ink sm:text-[19px]',
                titleClassName,
              )}
            >
              {titleIcon ? <span className="inline-flex shrink-0">{titleIcon}</span> : null}
              {title}
            </h2>
            {showPosition && itemCount > 0 ? (
              <span className="num min-w-0 truncate text-[10.5px] font-semibold text-ink-muted">
                {Math.min(activeIndex + 1, itemCount)} of {itemCount}
              </span>
            ) : titleMeta ? (
              <span className="min-w-0 truncate">{titleMeta}</span>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {headerAction}
            {seeAllTo ? (
              <Link
                to={seeAllTo}
                aria-label={`${seeAllLabel} ${title}`}
                className="nav-gloss-button h-9 w-9"
              >
                <ChevronRight size={17} strokeWidth={2.5} />
              </Link>
            ) : null}
            <div className="hidden items-center gap-1 lg:flex">
              <ArrowButton
                label={`Scroll ${title} left`}
                disabled={atStart}
                onClick={() => scrollByPage(-1)}
              >
                <ChevronLeft size={17} />
              </ArrowButton>
              <ArrowButton
                label={`Scroll ${title} right`}
                disabled={atEnd}
                onClick={() => scrollByPage(1)}
              >
                <ChevronRight size={17} />
              </ArrowButton>
            </div>
          </div>
        </div>

        {subtitle ? (
          <div className="mt-0.5 min-w-0 text-[12.5px] text-ink-muted">{subtitle}</div>
        ) : null}
      </header>

      {itemCount === 0 && empty ? (
        empty
      ) : (
        <div
          ref={trackRef}
          onScroll={sync}
          onKeyDown={onKeyDown}
          tabIndex={0}
          role="group"
          aria-label={`${title} carousel`}
          className={cn(
            'no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-smooth px-4 pb-1 sm:-mx-6 sm:px-6',
            'focus-visible:outline-none',
          )}
          style={{ scrollPaddingInline: '1rem' }}
        >
          {children}
          {/* Trailing spacer so the last tile can snap clear of the edge. */}
          <div className="w-1 shrink-0" aria-hidden />
        </div>
      )}
    </section>
  )
}

function ArrowButton({
  children,
  disabled,
  onClick,
  label,
}: {
  children: ReactNode
  disabled: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'nav-gloss-button h-8 w-8',
        disabled && 'opacity-35',
      )}
    >
      {children}
    </button>
  )
}

/** Fixed-width snap target sized to peek the next tile at the row edge. */
export function CarouselItem({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'w-[87vw] max-w-[356px] shrink-0 snap-start sm:w-[345px] lg:w-[363px]',
        className,
      )}
    >
      {children}
    </div>
  )
}
