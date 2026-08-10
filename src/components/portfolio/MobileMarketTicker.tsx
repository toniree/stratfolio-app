import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, SlidersHorizontal } from 'lucide-react'
import type { PriceMap } from '@/api/marketData/MarketDataSimulator'
import { usePrices } from '@/store/priceStore'
import { formatSignedPercent } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

const STORAGE_KEY = 'stratfolio.mobile-market-ticker.v1'
const DEFAULT_SYMBOLS = ['SPY', 'NVDA', 'PLTR', 'WMT', 'TSLA']
const MIN_SYMBOLS = 2
const MAX_SYMBOLS = 8
const DISPLAY_TICK_MS = 2000
type PriceFlash = 'up' | 'down'

/** A compact, customizable market tape between mobile chrome and portfolio content. */
export function MobileMarketTicker({ priceOverride }: { priceOverride?: PriceMap }) {
  const livePrices = usePrices()
  const prices = priceOverride ?? livePrices
  const latestPrices = useRef(prices)
  const [displayedPrices, setDisplayedPrices] = useState(prices)
  const [priceFlashes, setPriceFlashes] = useState<Record<string, PriceFlash>>({})
  const [displayTick, setDisplayTick] = useState(0)
  const availableSymbols = useMemo(() => rankSymbols(Object.keys(prices)), [prices])
  const [selectedSymbols, setSelectedSymbols] = useState(() =>
    loadSymbols(availableSymbols),
  )
  const [draftSymbols, setDraftSymbols] = useState(selectedSymbols)
  const [editing, setEditing] = useState(false)
  const visibleSymbols = selectedSymbols.filter((symbol) => prices[symbol])

  useEffect(() => {
    latestPrices.current = prices
  }, [prices])

  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayedPrices((previous) => {
        const next = latestPrices.current
        const flashes: Record<string, PriceFlash> = {}
        for (const [symbol, snapshot] of Object.entries(next)) {
          const previousPrice = previous[symbol]?.price
          if (previousPrice === undefined || snapshot.price === previousPrice) continue
          flashes[symbol] = snapshot.price > previousPrice ? 'up' : 'down'
        }
        setPriceFlashes(flashes)
        setDisplayTick((tick) => tick + 1)
        return next
      })
    }, DISPLAY_TICK_MS)
    return () => clearInterval(interval)
  }, [])

  if (visibleSymbols.length === 0) return null

  const openEditor = () => {
    setDraftSymbols(visibleSymbols)
    setEditing(true)
  }

  return (
    <>
      <section
        className="flex h-6 min-w-0 overflow-hidden border-t border-white/[0.065] border-b border-[#25364b] bg-[#05090e]/98 shadow-[inset_0_1px_rgba(92,145,204,0.08),0_4px_12px_-9px_rgba(0,0,0,0.95)]"
        aria-label="Market ticker"
      >
        <div className="min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_1%,black_98%,transparent)]">
          <div className="mobile-market-ticker-track flex h-full w-max items-center whitespace-nowrap">
            <MarketTickerRun
              symbols={visibleSymbols}
              prices={displayedPrices}
              flashes={priceFlashes}
              displayTick={displayTick}
            />
            <MarketTickerRun
              symbols={visibleSymbols}
              prices={displayedPrices}
              flashes={priceFlashes}
              displayTick={displayTick}
              duplicate
            />
          </div>
        </div>
        <button
          type="button"
          aria-label="Customize market ticker"
          className="grid w-8 shrink-0 place-items-center border-l border-[#243349] bg-[#0a111b] text-[#78bfff]/72 transition-[background-color,color,transform] hover:bg-[#111d2c] hover:text-[#9dd2ff] active:scale-95"
          onClick={openEditor}
        >
          <SlidersHorizontal size={12} strokeWidth={2.1} />
        </button>
      </section>

      <Modal
        open={editing}
        onOpenChange={setEditing}
        title="Customize market ticker"
        description={`Choose ${MIN_SYMBOLS}–${MAX_SYMBOLS} symbols for your mobile tape.`}
        footer={
          <div className="grid grid-cols-[0.8fr_1.2fr] gap-2">
            <Button
              variant="secondary"
              className="border-white/[0.14] bg-white/[0.08] text-white/80 hover:bg-white/[0.13]"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
            <Button
              className="border border-brand-300/30 bg-brand-400/[0.2] text-[#d7ebff] hover:bg-brand-400/[0.28]"
              onClick={() => {
                setSelectedSymbols(draftSymbols)
                persistSymbols(draftSymbols)
                setEditing(false)
              }}
            >
              Save ticker
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-2">
          {availableSymbols.slice(0, 16).map((symbol) => {
            const selected = draftSymbols.includes(symbol)
            const cannotRemove = selected && draftSymbols.length <= MIN_SYMBOLS
            const cannotAdd = !selected && draftSymbols.length >= MAX_SYMBOLS
            return (
              <button
                key={symbol}
                type="button"
                role="checkbox"
                aria-checked={selected}
                disabled={cannotRemove || cannotAdd}
                onClick={() =>
                  setDraftSymbols((current) =>
                    selected
                      ? current.filter((item) => item !== symbol)
                      : [...current, symbol],
                  )
                }
                className={cn(
                  'liquid-control flex h-11 items-center gap-2 rounded-[14px] px-3 text-left transition-[border-color,background-color,opacity,transform] active:scale-[0.98]',
                  selected
                    ? 'border-brand-300/28 bg-brand-400/[0.14] text-white/92'
                    : 'text-white/66',
                  (cannotRemove || cannotAdd) && 'cursor-not-allowed opacity-45',
                )}
              >
                <span
                  className={cn(
                    'grid h-5 w-5 shrink-0 place-items-center rounded-full border',
                    selected
                      ? 'border-brand-300/40 bg-brand-400/[0.25] text-brand-100'
                      : 'border-white/[0.13] bg-white/[0.035] text-transparent',
                  )}
                >
                  <Check size={11} strokeWidth={2.8} />
                </span>
                <span className="num text-[11px] font-extrabold">{symbol}</span>
                <span
                  className={cn(
                    'num ml-auto text-[9px] font-bold',
                    displayedPrices[symbol]?.dayChangePct >= 0 ? 'text-up/85' : 'text-down/85',
                  )}
                >
                  {formatSignedPercent(displayedPrices[symbol]?.dayChangePct ?? 0, 1)}
                </span>
              </button>
            )
          })}
        </div>
      </Modal>
    </>
  )
}

function MarketTickerRun({
  symbols,
  prices,
  flashes,
  displayTick,
  duplicate,
}: {
  symbols: string[]
  prices: PriceMap
  flashes: Record<string, PriceFlash>
  displayTick: number
  duplicate?: boolean
}) {
  return (
    <div className="num flex h-full items-center" aria-hidden={duplicate || undefined}>
      {symbols.map((symbol) => {
        const snapshot = prices[symbol]
        const up = snapshot.dayChangePct >= 0
        return (
          <span
            key={symbol}
            data-ticker-symbol={symbol}
            data-flash={flashes[symbol]}
            className="relative isolate inline-flex h-full items-center gap-1.5 overflow-hidden border-r border-[#1d2a3a] px-2.5"
          >
            <span className="relative z-10 text-[10px] leading-none font-bold tracking-[0.03em] text-white">
              {symbol}
            </span>
            <span
              key={`${symbol}-price-${displayTick}`}
              className={cn(
                'num relative z-10 text-[9.5px] leading-none font-medium text-[#f7fbff]',
                flashes[symbol] === 'up' && 'ticker-price-pulse-up',
                flashes[symbol] === 'down' && 'ticker-price-pulse-down',
              )}
            >
              ${snapshot.price.toFixed(2)}
            </span>
            <span
              className={cn(
                'num relative z-10 text-[9.5px] leading-none font-semibold tracking-[-0.01em]',
                up ? 'text-[#44e3a2]' : 'text-[#ff6969]',
              )}
            >
              {up ? '▲' : '▼'} {formatSignedPercent(snapshot.dayChangePct, 1)}
            </span>
          </span>
        )
      })}
    </div>
  )
}

function rankSymbols(symbols: string[]): string[] {
  const preferred = DEFAULT_SYMBOLS.filter((symbol) => symbols.includes(symbol))
  const remaining = symbols.filter((symbol) => !preferred.includes(symbol)).sort()
  return [...preferred, ...remaining]
}

function loadSymbols(availableSymbols: string[]): string[] {
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown
      if (Array.isArray(stored)) {
        const valid = stored
          .filter((symbol): symbol is string => typeof symbol === 'string')
          .filter((symbol) => availableSymbols.includes(symbol))
          .slice(0, MAX_SYMBOLS)
        if (valid.length >= MIN_SYMBOLS) return valid
      }
    } catch {
      // Fall through to a deterministic default if preferences are malformed.
    }
  }
  return availableSymbols.slice(0, Math.min(DEFAULT_SYMBOLS.length, MAX_SYMBOLS))
}

function persistSymbols(symbols: string[]) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols))
  } catch {
    // Preferences remain active in memory when storage is unavailable.
  }
}
