import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/cn'
import { SYMBOLS } from '@/api/mock/seededData'
import { usePrices } from '@/store/priceStore'
import { useTerminalStore } from '@/store/terminalStore'
import { SymbolIcon } from '@/components/shared/SymbolIcon'

const MAX_RESULTS = 8

/**
 * The chart header's ticker identity, as a combobox: it reads as the current
 * symbol + company, but the search glyph and chevron say "click me". Clicking
 * swaps in a text input; typing filters every symbol the desk can price by
 * ticker or company name, and picking one refocuses the whole terminal —
 * chart, chain, everything.
 */
export function SymbolSearch({ className }: { className?: string }) {
  const symbol = useTerminalStore((s) => s.symbol)
  const setSymbol = useTerminalStore((s) => s.setSymbol)
  const prices = usePrices()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const current = SYMBOLS.find((s) => s.symbol === symbol)

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return SYMBOLS.slice(0, MAX_RESULTS)
    const starts = SYMBOLS.filter((s) => s.symbol.toLowerCase().startsWith(needle))
    const rest = SYMBOLS.filter(
      (s) =>
        !s.symbol.toLowerCase().startsWith(needle) &&
        (s.symbol.toLowerCase().includes(needle) || s.company.toLowerCase().includes(needle)),
    )
    return [...starts, ...rest].slice(0, MAX_RESULTS)
  }, [query])

  useEffect(() => setHighlight(0), [query])
  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const choose = (next: string) => {
    setSymbol(next)
    setOpen(false)
    setQuery('')
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setOpen(false)
      setQuery('')
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlight((h) => Math.min(h + 1, matches.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const pick = matches[highlight] ?? matches[0]
      if (pick) choose(pick.symbol)
    }
  }

  return (
    <div className={cn('relative', className)}>
      {open ? (
        <div className="flex items-center gap-2 rounded-xl border border-brand-300/45 bg-[#141b26] py-1.5 pr-2.5 pl-2.5 shadow-[0_0_0_3px_rgba(77,152,255,0.12)]">
          <Search size={14} className="shrink-0 text-brand-300" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ticker or company…"
            aria-label="Search tickers"
            role="combobox"
            aria-expanded="true"
            className="num w-[168px] bg-transparent text-[13px] font-bold text-ink placeholder:font-medium placeholder:text-ink-muted focus:outline-none"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Charting ${symbol} — search for another ticker`}
          title="Search tickers"
          className="group flex items-center gap-2.5 rounded-xl border border-line bg-white/[0.03] py-1.5 pr-2 pl-1.5 text-left transition-colors hover:border-brand-300/40 hover:bg-white/[0.06]"
        >
          <SymbolIcon symbol={symbol} size="sm" />
          <span className="min-w-0">
            <span className="flex items-baseline gap-2">
              <span className="text-[15px] font-extrabold tracking-[-0.01em] text-ink">
                {symbol}
              </span>
              <span className="hidden max-w-[150px] truncate text-[11px] font-medium text-ink-muted xl:inline">
                {current?.company ?? ''}
              </span>
            </span>
          </span>
          <span className="ml-1 flex shrink-0 items-center gap-0.5 text-ink-muted transition-colors group-hover:text-brand-300">
            <Search size={12} />
            <ChevronDown size={12} />
          </span>
        </button>
      )}

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close ticker search"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => {
              setOpen(false)
              setQuery('')
            }}
          />
          <ul
            role="listbox"
            aria-label="Matching tickers"
            className="no-scrollbar absolute top-full left-0 z-40 mt-1.5 max-h-[320px] w-[280px] overflow-y-auto rounded-xl border border-line bg-[#141b26]/97 p-1 shadow-[0_22px_50px_-16px_rgba(0,0,0,0.9)] backdrop-blur-md"
          >
            {matches.map((item, index) => {
              const quote = prices[item.symbol]
              const up = (quote?.dayChangePct ?? 0) >= 0
              return (
                <li key={item.symbol}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={item.symbol === symbol}
                    onClick={() => choose(item.symbol)}
                    onMouseEnter={() => setHighlight(index)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors',
                      index === highlight ? 'bg-white/[0.07]' : 'hover:bg-white/[0.05]',
                      item.symbol === symbol && 'ring-1 ring-brand-300/30 ring-inset',
                    )}
                  >
                    <SymbolIcon symbol={item.symbol} size="xs" />
                    <span className="num w-[52px] shrink-0 text-[11.5px] font-extrabold text-ink">
                      {item.symbol}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[10px] text-ink-muted">
                      {item.company}
                    </span>
                    {quote ? (
                      <span className="shrink-0 text-right">
                        <span className="num block text-[10.5px] font-bold text-ink">
                          {quote.price.toFixed(2)}
                        </span>
                        <span
                          className={cn(
                            'num block text-[8.5px] font-bold',
                            up ? 'text-up' : 'text-down',
                          )}
                        >
                          {up ? '+' : ''}
                          {quote.dayChangePct.toFixed(2)}%
                        </span>
                      </span>
                    ) : null}
                  </button>
                </li>
              )
            })}
            {matches.length === 0 ? (
              <li className="px-3 py-4 text-center text-[10.5px] text-ink-muted">
                No tickers match “{query.trim()}”
              </li>
            ) : null}
          </ul>
        </>
      ) : null}
    </div>
  )
}
