import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatMoney } from '@/lib/format'
import type { Position } from '@/api/types'
import { SymbolIcon } from '@/components/shared/SymbolIcon'
import { IntradayCandles } from '@/components/charts/IntradayCandles'
import { optionQuoteValue } from '@/components/positions/OptionQuoteSelector'
import { usePrice } from '@/store/priceStore'

/**
 * Mirrors the plan sheet's context card, and expands into the underlying's
 * recent action plus the contract's quote book — the two things worth a look
 * before choosing a limit.
 */
export function PositionContextPanel({
  position,
  price,
  previousClose,
  expanded,
  onToggle,
  selectedQuote,
  onSelectQuote,
}: {
  position: Position
  price: number
  previousClose: number
  expanded: boolean
  onToggle: () => void
  /** Label of the quote currently feeding the limit field, if any. */
  selectedQuote: string | null
  /** Tapping a quote drops it straight into the limit field. */
  onSelectQuote: (label: string, value: number) => void
}) {
  const [series, setSeries] = useState<'underlying' | 'option'>('underlying')
  const [flash, setFlash] = useState<'up' | 'down' | null>(null)
  const [tick, setTick] = useState(0)
  const [markFlash, setMarkFlash] = useState<'up' | 'down' | null>(null)
  const [markTick, setMarkTick] = useState(0)
  const underlying = usePrice(position.symbol)
  const underlyingPrice = underlying?.price ?? price
  const quotePrice = series === 'option' ? price : underlyingPrice
  const previousQuote = useRef(quotePrice)

  useEffect(() => {
    const prior = previousQuote.current
    previousQuote.current = quotePrice
    if (quotePrice === prior) return
    setFlash(quotePrice > prior ? 'up' : 'down')
    setTick((n) => n + 1)
  }, [quotePrice])

  // The header mark tracks the contract itself, so it flashes independently of
  // whichever series the chart is currently showing.
  const previousMark = useRef(price)
  useEffect(() => {
    const prior = previousMark.current
    previousMark.current = price
    if (price === prior) return
    setMarkFlash(price > prior ? 'up' : 'down')
    setMarkTick((n) => n + 1)
  }, [price])
  const quotes = position.option
    ? ([
        ['Bid', optionQuoteValue('bid', price, previousClose)],
        ['Mark', price],
        ['Ask', optionQuoteValue('ask', price, previousClose)],
        ['Last', optionQuoteValue('last', price, previousClose)],
      ] as const)
    : null

  return (
    <div className="glass-flat rounded-[18px] border-white/[0.09]">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
      >
        <SymbolIcon symbol={position.symbol} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-baseline gap-1.5">
            <span className="shrink-0 text-[15px] leading-none font-extrabold tracking-[-0.02em] text-ink">
              {position.symbol}
            </span>
            {position.option ? (
              <span className="num min-w-0 truncate text-[12px] leading-none font-semibold text-white/80">
                {`$${position.option.strike}`}
                <span className={position.option.right === 'CALL' ? 'text-up' : 'text-[#ff9aad]'}>
                  {position.option.right === 'CALL' ? 'C' : 'P'}
                </span>
                {` ${numericExpiry(position.option.expiry)}`}
              </span>
            ) : (
              <span className="min-w-0 truncate text-[11px] leading-none font-semibold text-white/72">
                {position.company}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <span
            key={markTick}
            className={cn(
              'num block text-[14px] leading-none font-extrabold text-ink',
              markFlash === 'up' && 'price-tick-up',
              markFlash === 'down' && 'price-tick-down',
            )}
          >
            {formatMoney(price)}
          </span>
          <span className="mt-1 block text-[7px] font-bold tracking-[0.06em] text-ink-muted uppercase">
            Current mark
          </span>
        </div>
        <ChevronDown
          size={15}
          className={cn(
            'shrink-0 text-ink-muted transition-transform duration-200',
            expanded && 'rotate-180',
          )}
        />
      </button>

      {expanded ? (
        <div className="border-t border-white/[0.07] px-3 pt-2 pb-3">
          {/* Chart keeps the left; the toggle and the live price stack in a
              narrow right-hand column so neither sits on top of the plot. */}
          <div className="flex items-stretch gap-2">
            <IntradayCandles
              live
              symbol={position.symbol}
              lastPrice={quotePrice}
              previousClose={
                series === 'option'
                  ? (previousClose ?? price)
                  : (underlying?.previousClose ?? underlyingPrice)
              }
              className="min-w-0 flex-1 overflow-hidden rounded-[10px] border border-white/[0.07]"
            />
            <div className="flex w-[78px] shrink-0 flex-col gap-1.5">
              <span
                // Re-keyed each tick so the animation restarts rather than
                // being ignored as an already-running one.
                key={tick}
                className={cn(
                  'num text-center text-[12.5px] leading-none font-extrabold text-ink',
                  flash === 'up' && 'price-tick-up',
                  flash === 'down' && 'price-tick-down',
                )}
              >
                {formatMoney(quotePrice)}
              </span>
              {position.option ? (
                <div className="liquid-inset grid grid-cols-2 gap-0.5 rounded-full p-0.5">
                  {(['underlying', 'option'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={series === option}
                      onClick={() => setSeries(option)}
                      className={cn(
                        'rounded-full py-0.5 text-[6.5px] font-bold tracking-[0.05em] uppercase transition-colors',
                        series === option
                          ? 'bg-white/[0.14] text-ink'
                          : 'text-ink-muted hover:text-ink',
                      )}
                    >
                      {option === 'underlying' ? position.symbol : 'Opt'}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {quotes ? (
            <div className="mt-2.5 grid grid-cols-4 gap-1.5">
              {quotes.map(([label, value]) => (
                <button
                  key={label}
                  type="button"
                  aria-label={`Use ${label} ${formatMoney(value)} as the limit price`}
                  aria-pressed={selectedQuote === label}
                  onClick={() => onSelectQuote(label, value)}
                  className={cn(
                    'rounded-[10px] px-1.5 pt-0.5 pb-1 text-center transition-colors active:scale-[0.97]',
                    selectedQuote === label
                      ? 'border border-brand-300/60 bg-brand-400/[0.22] shadow-[inset_0_1px_rgba(255,255,255,0.12)]'
                      : 'liquid-control',
                  )}
                >
                  <span
                    className={cn(
                      'block text-[6.5px] font-bold tracking-[0.05em] uppercase',
                      selectedQuote === label ? 'text-white' : 'text-ink-muted',
                    )}
                  >
                    {label}
                  </span>
                  <span className="num block text-[11px] font-extrabold text-ink">
                    {formatMoney(value)}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/** Expiry as `1/15/2027`; the label is a UTC calendar date. */
function numericExpiry(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(iso))
}

