import { describe, expect, it } from 'vitest'
import { MarketDataSimulator } from '@/api/marketData/MarketDataSimulator'
import { SYMBOLS } from '@/api/mock/seededData'

describe('MarketDataSimulator', () => {
  it('produces the same series for the same seed on every construction', () => {
    const a = new MarketDataSimulator(SYMBOLS, 1000)
    const b = new MarketDataSimulator(SYMBOLS, 1000)
    for (const spec of SYMBOLS) {
      for (const cursor of [0, 1, 17, 250, 3599]) {
        expect(a.priceAt(spec.symbol, cursor)).toBe(b.priceAt(spec.symbol, cursor))
      }
    }
  })

  it('keeps every symbol inside a ±10% band of its anchor — the demo cannot tank', () => {
    const sim = new MarketDataSimulator(SYMBOLS, 1000)
    for (const spec of SYMBOLS) {
      for (let cursor = 0; cursor < 3600; cursor += 7) {
        const price = sim.priceAt(spec.symbol, cursor)!
        const anchorMax = Math.max(spec.open, spec.open * (1 + spec.drift))
        const anchorMin = Math.min(spec.open, spec.open * (1 + spec.drift))
        expect(price).toBeGreaterThan(anchorMin * 0.9)
        expect(price).toBeLessThan(anchorMax * 1.1)
      }
    }
  })

  it('batch-notifies subscribers once per tick with every symbol', () => {
    const sim = new MarketDataSimulator(SYMBOLS, 100_000)
    const batches: number[] = []
    const off = sim.subscribe((prices) => batches.push(Object.keys(prices).length))
    sim.tick()
    sim.tick()
    off()
    sim.stop()

    // One initial snapshot plus one batch per tick — never one event per symbol.
    expect(batches).toHaveLength(3)
    expect(batches.every((count) => count === SYMBOLS.length)).toBe(true)
  })

  it('exposes a rolling history window for sparklines', () => {
    const sim = new MarketDataSimulator(SYMBOLS, 100_000)
    const snapshot = sim.getSnapshot()
    expect(snapshot.NVDA.history.length).toBe(28)
    expect(snapshot.NVDA.history.at(-1)).toBe(snapshot.NVDA.price)
    sim.stop()
  })
})
