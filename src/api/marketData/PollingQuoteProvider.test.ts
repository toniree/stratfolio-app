import { describe, expect, it, vi } from 'vitest'
import { PollingQuoteProvider } from '@/api/marketData/PollingQuoteProvider'
import { toBars, toMarketStatus, toSnapshot } from '@/api/http/adapters/market'
import type {
  BarWindow,
  MarketBarsPage,
  MarketDataApi,
  MarketSnapshotView,
  MarketStatusView,
  OptionChainPage,
} from '@/api/marketData/types'
import { MARKET_STATUS_REPLAY, SPY_BARS, SPY_SNAPSHOT } from '@/test/msw/fixtures/mnd'

/** A stub facade that records the windows it was asked for. */
function stubApi(overrides: Partial<MarketDataApi> = {}) {
  const windows: BarWindow[] = []
  const api: MarketDataApi = {
    getStatus: async (): Promise<MarketStatusView> => toMarketStatus(MARKET_STATUS_REPLAY),
    getSnapshot: async (): Promise<MarketSnapshotView> => toSnapshot(SPY_SNAPSHOT),
    getBars: async (_symbol, window): Promise<MarketBarsPage> => {
      windows.push(window)
      return toBars(SPY_BARS)
    },
    getChain: async (): Promise<OptionChainPage> => {
      throw new Error('not used')
    },
    ...overrides,
  }
  return { api, windows }
}

const options = {
  symbols: ['SPY'],
  setInterval: (() => 0) as unknown as typeof setInterval,
  clearInterval: (() => {}) as unknown as typeof clearInterval,
  isVisible: () => true,
}

describe('PollingQuoteProvider', () => {
  it('publishes a quote with a real prior close from daily bars', async () => {
    const { api } = stubApi()
    const provider = new PollingQuoteProvider({ ...options, api })
    await provider.poll()

    const quote = provider.getSnapshot().SPY
    expect(quote).toBeDefined()
    // Mid off the snapshot; previous close off the *prior* daily bar, not
    // today's own open and not the first tick observed.
    expect(quote.price).toBe(592.12)
    expect(quote.previousClose).toBe(590.55)
    expect(quote.open).toBe(590.9)
    expect(quote.dayChange).toBeCloseTo(1.57, 6)
    // Provenance travels with the price (D10).
    expect(quote.provenance).toBe('replay')
    expect(quote.stale).toBe(false)
  })

  it('asks for a bounded window anchored to mnd’s clock, not the browser’s', async () => {
    const { api, windows } = stubApi()
    await new PollingQuoteProvider({ ...options, api }).poll()

    expect(windows).toHaveLength(1)
    const [window] = windows
    expect(window.interval).toBe('1d')
    expect(window.start).toBeTruthy()
    expect(window.end).toBeTruthy()
    expect(Date.parse(window.end)).toBeGreaterThan(Date.parse(window.start))
    // The replay dataset sits at 2026-08-31; a wall-clock window would miss it
    // entirely, so the window must straddle the replay clock.
    const replayClock = Date.parse('2026-08-31T13:35:00Z')
    expect(Date.parse(window.start)).toBeLessThan(replayClock)
    expect(Date.parse(window.end)).toBeGreaterThan(replayClock)
  })

  it('omits a symbol with no real prior close rather than inventing a baseline', async () => {
    const { api } = stubApi({
      // One bar only: there is no prior session to measure a day change from.
      getBars: async () => toBars({ ...SPY_BARS, bars: [SPY_BARS.bars[1]] }),
    })
    const provider = new PollingQuoteProvider({ ...options, api })
    await provider.poll()
    expect(provider.getSnapshot().SPY).toBeUndefined()
  })

  it('omits a symbol whose daily page was truncated', async () => {
    // A truncated daily page holds the OLDEST bars and cuts the newest — so
    // its "prior close" may be days stale, and every day change built on it
    // would be quietly wrong.
    const { api } = stubApi({ getBars: async () => toBars({ ...SPY_BARS, truncated: true }) })
    const provider = new PollingQuoteProvider({ ...options, api })
    await provider.poll()
    expect(provider.getSnapshot().SPY).toBeUndefined()
  })

  it('omits a symbol the facade cannot quote instead of holding a stale one', async () => {
    const { api } = stubApi({
      getSnapshot: async () => toSnapshot({ ...SPY_SNAPSHOT, underlying: null }),
    })
    const provider = new PollingQuoteProvider({ ...options, api })
    await provider.poll()
    expect(provider.getSnapshot().SPY).toBeUndefined()
  })

  it('never falls back to mock data when the facade errors', async () => {
    const onError = vi.fn()
    const { api } = stubApi({
      getSnapshot: async () => {
        throw new Error('503')
      },
    })
    const provider = new PollingQuoteProvider({ ...options, api, onError })
    await provider.poll()
    // Empty, not simulated: a live domain with a dead backend shows a gap.
    expect(provider.getSnapshot()).toEqual({})
    expect(onError).toHaveBeenCalled()
  })

  it('tracks additional symbols without dropping the existing ones', async () => {
    const seen: string[] = []
    const { api } = stubApi({
      getSnapshot: async (symbol) => {
        seen.push(symbol)
        return toSnapshot({ ...SPY_SNAPSHOT, ticker: symbol })
      },
    })
    const provider = new PollingQuoteProvider({ ...options, api })
    provider.track(['qqq', 'SPY'])
    await provider.poll()
    expect(seen.sort()).toEqual(['QQQ', 'SPY'])
  })
})
