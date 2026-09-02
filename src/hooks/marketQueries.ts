import { useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { marketDataApi } from '@/api'
import { chainPollMs } from '@/api/http/env'
import { barWindow, chainMarks } from '@/api/http/adapters/market'
import type { Position } from '@/api/types'
import type {
  MarketBarsPage,
  MarketStatusView,
  OptionChainPage,
  OptionMarkMap,
} from '@/api/marketData/types'
import type { MndBarInterval } from '@/api/http/wire/mnd'

/**
 * TanStack hooks over the mnd :7102 market facade (APP-108).
 *
 * Every hook here is **disabled in mock mode**. `marketDataApi` is `null` when
 * `VITE_DATA_MARKET` is not `live`, and these return an idle query rather than
 * a simulated payload: chains, bars and IV are exactly the surfaces the app
 * used to fabricate in the browser, and a mock implementation of this seam
 * would put that fabrication behind a live-looking API (D4, §6).
 *
 * Cadence follows D8: quotes poll on the provider's own ~5s loop, and anything
 * chain-shaped polls an order of magnitude slower because a chain request is
 * an order of magnitude more expensive than a snapshot.
 */

export const marketKeys = {
  status: ['market', 'status'] as const,
  snapshot: (symbol: string, chainSummary: boolean) =>
    ['market', 'snapshot', symbol, chainSummary ? 'summary' : 'quote'] as const,
  chain: (symbol: string, expiration?: string) =>
    ['market', 'chain', symbol, expiration ?? 'all'] as const,
  bars: (symbol: string, interval: string, start: string, end: string) =>
    ['market', 'bars', symbol, interval, start, end] as const,
  marks: (keys: string[]) => ['market', 'marks', ...keys] as const,
}

export function useMarketStatus() {
  return useQuery<MarketStatusView>({
    queryKey: marketKeys.status,
    queryFn: ({ signal }) => marketDataApi!.getStatus(signal),
    enabled: marketDataApi !== null,
    // Status is the one route that answers with the database down; it is cheap
    // and it is how the UI learns it is looking at a replay clock.
    refetchInterval: 30_000,
    staleTime: 15_000,
  })
}

/** True when the market domain is bound to the live facade (D2). */
export function isMarketLive(): boolean {
  return marketDataApi !== null
}

/**
 * A snapshot with the whole-chain roll-up.
 *
 * `chainSummary` is the expensive half of the route, so this is deliberately
 * separate from the tape's quote polling and runs on the chain cadence. It is
 * also the **only** correct source of chain-wide totals and the expiration
 * list: mnd computes them over the complete chain, so they stay right even
 * when a chain *page* comes back truncated (§15.4).
 */
export function useMarketSnapshot(
  symbol: string | undefined,
  options: { chainSummary?: boolean; enabled?: boolean } = {},
) {
  const chainSummary = options.chainSummary !== false
  return useQuery({
    queryKey: marketKeys.snapshot(symbol ?? '', chainSummary),
    queryFn: ({ signal }) => marketDataApi!.getSnapshot(symbol!, { chainSummary, signal }),
    enabled: marketDataApi !== null && Boolean(symbol) && options.enabled !== false,
    refetchInterval: chainSummary ? chainPollMs() : undefined,
    staleTime: chainPollMs() / 2,
  })
}

/**
 * One page of a live chain, always filtered.
 *
 * A single expiration keeps the response far below the 1,500-contract cap; an
 * unfiltered SPY chain is ~7,300 contracts and would come back truncated —
 * a *page*, not a chain, from which no chain-wide aggregate may be computed.
 */
export function useLiveChain(
  symbol: string | undefined,
  options: { expiration?: string; minDte?: number; maxDte?: number; enabled?: boolean } = {},
) {
  return useQuery<OptionChainPage>({
    queryKey: marketKeys.chain(symbol ?? '', options.expiration),
    queryFn: ({ signal }) =>
      marketDataApi!.getChain(
        symbol!,
        {
          expiration: options.expiration,
          // V1 policy is DTE >= 1: an expiring-today contract is not tradeable
          // under the product invariant, so it is not offered.
          minDte: options.minDte ?? 1,
          maxDte: options.maxDte,
        },
        signal,
      ),
    enabled: marketDataApi !== null && Boolean(symbol) && options.enabled !== false,
    refetchInterval: chainPollMs(),
    staleTime: chainPollMs() / 2,
  })
}

/**
 * Bars over a **bounded** window.
 *
 * `start` and `end` are required by the route (§15.3): an unbounded scan is a
 * 400, and rightly so — it is a denial of service on the local hypertables.
 * `barWindow()` is the only constructor here, so a caller cannot forget one.
 */
export function useLiveBars(
  symbol: string | undefined,
  spec: { spanMs: number; interval: MndBarInterval; limit?: number; enabled?: boolean },
) {
  // The window is anchored to a coarse tick so the query key is stable between
  // renders; a key rebuilt from `Date.now()` would refetch on every render.
  const anchor = Math.floor(Date.now() / 60_000) * 60_000
  const window = useMemo(
    () => barWindow({ end: anchor, spanMs: spec.spanMs, interval: spec.interval, limit: spec.limit }),
    [anchor, spec.spanMs, spec.interval, spec.limit],
  )

  return useQuery<MarketBarsPage>({
    queryKey: marketKeys.bars(symbol ?? '', window.interval, window.start, window.end),
    queryFn: ({ signal }) => marketDataApi!.getBars(symbol!, window, signal),
    enabled: marketDataApi !== null && Boolean(symbol) && spec.enabled !== false,
    staleTime: 60_000,
  })
}

/**
 * Real marks for the open option book — the hook that makes unrealized P&L
 * real (plan §3.1).
 *
 * plt writes a position's mark only at entry and at close, so an open
 * position's `unrealized_pnl` is 0 on the wire forever. The honest mark is the
 * chain mid for that exact contract, so this fetches one chain page per
 * distinct (ticker, expiration) the book actually holds — never a full-chain
 * pull, and never one request per contract.
 *
 * Returns `{}` in mock mode, which sends `valuePosition()` down its demo-model
 * path unchanged.
 */
export function useOptionMarks(positions: Position[] | undefined): {
  marks: OptionMarkMap
  isFetching: boolean
  isError: boolean
} {
  const groups = useMemo(() => {
    const seen = new Map<string, { symbol: string; expiration: string }>()
    for (const position of positions ?? []) {
      if (position.assetType !== 'option' || !position.option) continue
      const symbol = position.symbol.toUpperCase()
      const expiration = position.option.expiry
      if (!expiration) continue
      seen.set(`${symbol}|${expiration}`, { symbol, expiration })
    }
    return [...seen.values()].sort((a, b) =>
      `${a.symbol}|${a.expiration}`.localeCompare(`${b.symbol}|${b.expiration}`),
    )
  }, [positions])

  const results = useQueries({
    queries: groups.map((group) => ({
      queryKey: marketKeys.chain(group.symbol, group.expiration),
      queryFn: ({ signal }: { signal?: AbortSignal }) =>
        marketDataApi!.getChain(
          group.symbol,
          // Both types: a book can hold a call and a put on the same
          // expiration, and one filtered request covers both.
          { expiration: group.expiration },
          signal,
        ),
      enabled: marketDataApi !== null,
      refetchInterval: chainPollMs(),
      staleTime: chainPollMs() / 2,
    })),
  })

  return useMemo(() => {
    const marks: OptionMarkMap = {}
    let isFetching = false
    let isError = false
    for (const result of results) {
      if (result.isFetching) isFetching = true
      if (result.isError) isError = true
      if (result.data) Object.assign(marks, chainMarks(result.data))
    }
    return { marks, isFetching, isError }
    // `results` is a fresh array each render; the marks it produces are not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.map((r) => r.dataUpdatedAt).join(','), results.length])
}
