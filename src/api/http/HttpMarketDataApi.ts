import { request } from '@/api/http/client'
import { ApiError } from '@/api/http/problem'
import {
  MND_MAX_BAR_LIMIT,
  MND_MAX_CHAIN_CONTRACTS,
  type MndBars,
  type MndChain,
  type MndMarketStatus,
  type MndSnapshot,
} from '@/api/http/wire/mnd'
import { toBars, toChain, toMarketStatus, toSnapshot } from '@/api/http/adapters/market'
import type {
  BarWindow,
  ChainQuery,
  MarketBarsPage,
  MarketDataApi,
  MarketSnapshotView,
  MarketStatusView,
  OptionChainPage,
} from '@/api/marketData/types'

/**
 * The live market-data domain, over the mnd :7102 JSON facade (contracts §15).
 *
 * Four routes exist and no more. `GetHistoricalChain`,
 * `GetChainSnapshotHistory` and `StreamSnapshots` are deferred from V1 with
 * **no route at all** — a request for one is a 404 — so this class does not
 * offer them and dependent features stay mocked. V1 polls (D8); there is no
 * browser-facing push anywhere in the backend.
 *
 * The one refusal worth knowing: a `FAILED_PRECONDITION` becomes a **409**,
 * and that is how "MARKET_MODE=REALTIME but the provider has no credentials"
 * reaches the browser. mnd refuses to fabricate a price; this client
 * propagates the `ApiError` so the UI renders the gap instead of a number.
 */
export class HttpMarketDataApi implements MarketDataApi {
  async getStatus(signal?: AbortSignal): Promise<MarketStatusView> {
    const wire = await request<MndMarketStatus>('mnd', '/api/v1/market/status', { signal })
    return toMarketStatus(wire)
  }

  async getSnapshot(
    symbol: string,
    options: { chainSummary?: boolean; signal?: AbortSignal } = {},
  ): Promise<MarketSnapshotView> {
    const wire = await request<MndSnapshot>(
      'mnd',
      `/api/v1/market/snapshots/${encodeURIComponent(symbol.toUpperCase())}`,
      {
        // The whole-chain roll-up is the expensive half of this route. A tape
        // that only needs a price says so rather than making mnd walk a chain
        // every five seconds.
        query: { chain_summary: options.chainSummary === true ? undefined : 'false' },
        signal: options.signal,
      },
    )
    return toSnapshot(wire)
  }

  /**
   * Historical bars over a **bounded** window.
   *
   * `start` and `end` are required by the route, and this method refuses to
   * assemble a request without both: the browser contract is deliberately
   * stricter than the gRPC RPC, because an unbounded scan of the hypertables
   * is a denial of service on the local database (§15.3). Build the window
   * with `barWindow()` — it is the only constructor that cannot omit a bound.
   */
  async getBars(
    symbol: string,
    window: BarWindow,
    signal?: AbortSignal,
  ): Promise<MarketBarsPage> {
    assertBounded(window)
    const wire = await request<MndBars>(
      'mnd',
      `/api/v1/market/bars/${encodeURIComponent(symbol.toUpperCase())}`,
      {
        query: {
          start: window.start,
          end: window.end,
          interval: window.interval,
          limit: window.limit,
        },
        signal,
      },
    )
    return toBars(wire)
  }

  /**
   * One page of the live option chain.
   *
   * Always filtered. An unfiltered SPY or QQQ chain is ~7,300 contracts
   * (MND-013b) — mnd truncates rather than rejecting it, but a truncated page
   * is a page, not a chain, so every caller here narrows by expiration, DTE or
   * type first. An explicit `limit` above the cap is a client bug and is
   * refused locally instead of spending a round trip on a certain 400.
   */
  async getChain(
    symbol: string,
    query: ChainQuery = {},
    signal?: AbortSignal,
  ): Promise<OptionChainPage> {
    if (query.limit !== undefined && query.limit > MND_MAX_CHAIN_CONTRACTS) {
      throw new ApiError({
        message: `limit ${query.limit} exceeds the facade maximum of ${MND_MAX_CHAIN_CONTRACTS} contracts; narrow the filter instead`,
        status: 400,
        url: `/api/v1/market/chains/${symbol}`,
      })
    }
    const wire = await request<MndChain>(
      'mnd',
      `/api/v1/market/chains/${encodeURIComponent(symbol.toUpperCase())}`,
      {
        query: {
          expiration: query.expiration,
          min_dte: query.minDte,
          max_dte: query.maxDte,
          type: query.right === undefined ? undefined : query.right.toLowerCase(),
          limit: query.limit,
        },
        signal,
      },
    )
    return toChain(wire)
  }
}

function assertBounded(window: BarWindow): void {
  const start = Date.parse(window.start)
  const end = Date.parse(window.end)
  if (Number.isNaN(start) || Number.isNaN(end)) {
    throw new ApiError({
      message: 'bars require RFC3339 start and end instants',
      status: 400,
      url: '/api/v1/market/bars',
    })
  }
  if (end <= start) {
    throw new ApiError({
      message: 'bars require end to be after start',
      status: 400,
      url: '/api/v1/market/bars',
    })
  }
  if (window.limit !== undefined && window.limit > MND_MAX_BAR_LIMIT) {
    throw new ApiError({
      message: `bar limit ${window.limit} exceeds the facade maximum of ${MND_MAX_BAR_LIMIT}; narrow the window instead`,
      status: 400,
      url: '/api/v1/market/bars',
    })
  }
}

export const httpMarketDataApi = new HttpMarketDataApi()
