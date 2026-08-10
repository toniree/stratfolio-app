import { create } from 'zustand'
import {
  marketDataSimulator,
  type PriceMap,
  type PriceSnapshot,
} from '@/api/marketData/MarketDataSimulator'

interface PriceState {
  prices: PriceMap
  tick: number
  applyBatch: (prices: PriceMap) => void
}

export const usePriceStore = create<PriceState>((set) => ({
  prices: marketDataSimulator.getSnapshot(),
  tick: 0,
  applyBatch: (prices) => set((s) => ({ prices, tick: s.tick + 1 })),
}))

let unsubscribe: (() => void) | null = null

/** Wire the single simulator interval into the store exactly once. */
export function startMarketData(): () => void {
  if (unsubscribe) return unsubscribe
  const off = marketDataSimulator.subscribe((prices) => {
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
