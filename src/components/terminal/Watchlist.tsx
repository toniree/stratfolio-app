import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Plus, Search } from 'lucide-react'
import { cn } from '@/lib/cn'
import { SYMBOLS } from '@/api/mock/seededData'
import { usePrices, useTrackedSymbols } from '@/store/priceStore'
import { useTerminalStore } from '@/store/terminalStore'
import { Sparkline } from '@/components/charts/Sparkline'

/** The rail shows the core tape, not the whole options-book symbol soup. */
const DEFAULT_WATCHLIST = SYMBOLS.slice(0, 20)

/**
 * Ticker collection for the desktop rail. Every row is live off the one
 * simulator feed; clicking a row focuses the terminal chart on that symbol
 * (navigating home first if the user is elsewhere).
 */
export function Watchlist({ className }: { className?: string }) {
  const prices = usePrices()
  const symbol = useTerminalStore((s) => s.symbol)
  const setSymbol = useTerminalStore((s) => s.setSymbol)
  const navigate = useNavigate()
  const [watchlist, setWatchlist] = useState(DEFAULT_WATCHLIST)
  // The rail stays a local tape (plan §3.8) — adding a ticker here must never
  // touch the AI's ActiveUniverse — but its quotes come from whichever source
  // is bound, so the live provider is told which symbols the rail wants. One
  // the dataset does not serve simply never gets a row.
  useTrackedSymbols(useMemo(() => watchlist.map((item) => item.symbol), [watchlist]))
  const [query, setQuery] = useState('')
  const available = useMemo(() => {
    const included = new Set(watchlist.map((item) => item.symbol))
    const needle = query.trim().toLowerCase()
    return SYMBOLS.filter(
      (item) =>
        !included.has(item.symbol) &&
        (!needle || item.symbol.toLowerCase().includes(needle) || item.company.toLowerCase().includes(needle)),
    )
  }, [query, watchlist])

  const focus = (next: string) => {
    setSymbol(next)
    navigate('/app/portfolio')
  }

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div className="flex items-center px-3 pb-1.5">
        <span className="text-[10px] font-extrabold tracking-[0.09em] text-ink-muted uppercase">
          Watchlist
        </span>
        <span className="num ml-auto text-[9.5px] font-semibold text-ink-muted/70">
          {watchlist.length} live
        </span>
        <DropdownMenu.Root onOpenChange={(open) => !open && setQuery('')}>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label="Add ticker"
              className="relative ml-1.5 grid h-6 w-6 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-white/[0.06] hover:text-brand-300"
            >
              <Search size={14} strokeWidth={2} />
              <span className="absolute right-[2px] bottom-[2px] grid h-2.5 w-2.5 place-items-center rounded-full bg-brand-500 text-white ring-1 ring-[#111925]">
                <Plus size={7} strokeWidth={3.2} />
              </span>
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              side="right"
              align="start"
              sideOffset={12}
              collisionPadding={12}
              className="menu-surface z-[70] w-[238px] p-2"
            >
              <DropdownMenu.Label className="px-1 pb-2 text-[9px] font-extrabold tracking-[0.08em] text-ink-muted uppercase">
                Add ticker
              </DropdownMenu.Label>
              <div className="relative mb-1.5">
                <Search size={13} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-muted" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => event.stopPropagation()}
                  placeholder="Search symbol or company"
                  aria-label="Search tickers"
                  className="h-8 w-full rounded-lg border border-line bg-black/15 pr-2 pl-8 text-[11px] text-ink placeholder:text-ink-muted focus:border-brand-400/40 focus:outline-none"
                />
              </div>
              <div className="no-scrollbar max-h-[280px] overflow-y-auto">
                {available.length > 0 ? (
                  available.map((item) => (
                    <DropdownMenu.Item
                      key={item.symbol}
                      onSelect={() => setWatchlist((current) => [...current, item])}
                      className="flex cursor-default items-center gap-2 rounded-lg px-2 py-2 outline-none transition-colors hover:bg-white/[0.055] focus:bg-white/[0.055]"
                    >
                      <span className="num w-10 shrink-0 text-[11px] font-extrabold text-ink">{item.symbol}</span>
                      <span className="min-w-0 flex-1 truncate text-[10px] text-ink-muted">{item.company}</span>
                      <Plus size={12} className="shrink-0 text-brand-300" />
                    </DropdownMenu.Item>
                  ))
                ) : (
                  <p className="px-2 py-4 text-center text-[10px] text-ink-muted">
                    {watchlist.length === SYMBOLS.length ? 'All tickers added' : 'No tickers found'}
                  </p>
                )}
              </div>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
      <div className="grid grid-cols-[42px_minmax(26px,1fr)_52px_44px_46px] items-center gap-1 px-2 pb-1 text-right text-[8px] font-extrabold tracking-[0.07em] text-ink-muted/70 uppercase">
        <span className="text-left">Symbol</span>
        <span aria-hidden />
        <span>Price</span>
        <span>% Day</span>
        <span>Chg</span>
      </div>
      <div className="no-scrollbar min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-0.5">
        {watchlist.map((spec) => {
          const quote = prices[spec.symbol]
          if (!quote) return null
          const up = quote.dayChange >= 0
          const active = spec.symbol === symbol
          return (
            <button
              key={spec.symbol}
              type="button"
              onClick={() => focus(spec.symbol)}
              aria-pressed={active}
              aria-label={`Chart ${spec.symbol}`}
              className={cn(
                'grid w-full grid-cols-[42px_minmax(26px,1fr)_52px_44px_46px] items-center gap-1 rounded-lg px-2 py-[5px] text-left transition-colors',
                active
                  ? 'bg-brand-400/[0.13] ring-1 ring-brand-300/25 ring-inset'
                  : 'hover:bg-white/[0.045]',
              )}
            >
              <span
                className={cn(
                  'num truncate text-[10.5px] font-extrabold tracking-[-0.01em]',
                  active ? 'text-brand-200' : 'text-ink',
                )}
              >
                {spec.symbol}
              </span>
              <Sparkline
                data={quote.history}
                width={40}
                height={16}
                tone={up ? 'up' : 'down'}
                className="min-w-0 w-full"
              />
              <span className="num truncate text-right text-[10px] font-bold text-ink">
                {quote.price.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span className={cn('num truncate text-right text-[8.5px] font-bold', up ? 'text-up' : 'text-down')}>
                {up ? '+' : ''}{quote.dayChangePct.toFixed(2)}%
              </span>
              <span className={cn('num truncate text-right text-[8.5px] font-bold', up ? 'text-up' : 'text-down')}>
                {up ? '+' : ''}{quote.dayChange.toFixed(2)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
