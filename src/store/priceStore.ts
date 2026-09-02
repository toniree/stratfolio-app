import { useEffect } from 'react'
import { create } from 'zustand'
import type { Provenance } from '@/api/types'
import type { PriceMap, PriceSnapshot, QuoteProvider } from '@/api/marketData/types'
import { quoteProvider } from '@/api/index'

interface PriceState {
  prices: PriceMap
  tick: number
  applyBatch: (prices: PriceMap) => void
}

/**
 * The app's quote store, fed by whichever source `src/api/index.ts` bound:
 * the demo simulator (`mock`) or the polling provider over the mnd facade
 * (`live`). Components read snapshots and never learn which — they read
 * `provenance` instead.
 */
const provider: QuoteProvider = quoteProvider

export const usePriceStore = create<PriceState>((set) => ({
  prices: provider.getSnapshot(),
  tick: 0,
  applyBatch: (prices) => set((s) => ({ prices, tick: s.tick + 1 })),
}))

let unsubscribe: (() => void) | null = null

/** Wire the single quote interval into the store exactly once. */
export function startMarketData(): () => void {
  if (unsubscribe) return unsubscribe
  const off = provider.subscribe((prices) => {
    usePriceStore.getState().applyBatch(prices)
  })
  unsubscribe = () => {
    off()
    unsubscribe = null
  }
  return unsubscribe
}

export function usePrice(symbol: string): PriceSnapshot | undefined {
  return usePriceStore((s) => s.prices[symbol])
}

export function usePrices(): PriceMap {
  return usePriceStore((s) => s.prices)
}

/**
 * Ask the bound source to include these symbols.
 *
 * The simulator ignores it — its book is fixed — and the live provider adds
 * them to its poll set. A symbol the dataset does not serve never appears in
 * the map, which is the honest outcome: nothing renders for it.
 */
export function useTrackedSymbols(symbols: readonly string[]): void {
  const key = symbols.join(',')
  useEffect(() => {
    if (!provider.track || key === '') return
    provider.track(key.split(','))
  }, [key])
}

/**
 * The provenance the tape as a whole is claiming (D10).
 *
 * The weakest claim across the visible symbols wins: one synthetic quote in a
 * strip makes the strip synthetic, because a viewer cannot tell which tile was
 * the generated one.
 */
const RANK: Record<Provenance, number> = { live: 3, replay: 2, synthetic: 1, mock: 0 }

export function quoteProvenance(prices: PriceMap, symbols?: readonly string[]): Provenance | undefined {
  const keys = symbols ?? Object.keys(prices)
  let weakest: Provenance | undefined
  for (const key of keys) {
    const claim = prices[key]?.provenance
    if (!claim) continue
    if (weakest === undefined || RANK[claim] < RANK[weakest]) weakest = claim
  }
  return weakest
}

export function useQuoteProvenance(symbols?: readonly string[]): Provenance | undefined {
  const prices = usePrices()
  return quoteProvenance(prices, symbols)
}
