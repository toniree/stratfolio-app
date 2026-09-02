import type { Provenance } from '@/api/types'

/**
 * View models for the market-data domain, and the seam every quote source
 * implements.
 *
 * Two sources exist and they are swapped per D2 at `src/api/index.ts`:
 *  - `MarketDataSimulator` — the scripted demo book (`mock`);
 *  - `PollingQuoteProvider` over the mnd :7102 JSON facade (`live`).
 *
 * Everything downstream (the price store, the tape, position valuation) speaks
 * only these types, so no component knows which source it is rendering — it
 * knows only what `provenance` claims.
 */

export interface PriceSnapshot {
  symbol: string
  /** Current mark per share. Always a real observation from whichever source
   *  is bound; never a placeholder. */
  price: number
  /**
   * Prior session close.
   *
   * The live provider will not publish a symbol at all until it has read a
   * real prior daily close from the bars route: a day change needs a real
   * baseline, and inventing one (first price seen, today's open, the entry
   * price) is exactly the fabrication D4/§6 forbid. A symbol without one is
   * simply absent from the `PriceMap` — missing stays missing.
   */
  previousClose: number
  /** Session open, when the source has a real one. Optional: the facade's
   *  snapshot carries no open, and today's daily bar may not exist yet. */
  open?: number
  dayChange: number
  dayChangePct: number
  /** Rolling window of recent real prices for the inline sparklines. */
  history: number[]
  /** Where this quote came from (D10). Absent means the source made no claim. */
  provenance?: Provenance
  /** mnd's own staleness verdict, passed through untouched. */
  stale?: boolean
  /** RFC3339 event time of the observation behind `price`. */
  asOf?: string
}

export type PriceMap = Record<string, PriceSnapshot>

export type PriceListener = (prices: PriceMap) => void

/**
 * A source of streaming-ish quotes for the price store.
 *
 * `subscribe` immediately delivers the current snapshot, then delivers a whole
 * new `PriceMap` per batch — one notification per tick, not one per symbol.
 */
export interface QuoteProvider {
  getSnapshot(): PriceMap
  subscribe(listener: PriceListener): () => void
  /** Ask the provider to include these symbols. A source with a fixed book
   *  (the simulator) ignores it; the polling provider adds them to its poll
   *  set. Never throws for an unknown symbol — one the dataset does not serve
   *  simply never appears in the map. */
  track?(symbols: string[]): void
  stop(): void
}

/* --------------------------------------------------------------- market ---- */

/** Staleness as mnd reports it, passed through rather than re-derived. */
export interface MarketStaleness {
  eventTime?: string
  ingestTime?: string
  ageSeconds: number
  stale: boolean
  thresholdSeconds: number
}

export interface MarketQuote {
  symbol: string
  bid?: number
  ask?: number
  mid?: number
  last?: number
  bidSize?: number
  askSize?: number
  volume?: number
  eventTime?: string
  provenance: Provenance
  /** mnd's raw `DataSource` enum, kept for diagnostics and copy. */
  source?: string
}

/**
 * One real contract quote off the chain route.
 *
 * `impliedVolatility` and the Greeks are the **server's** numbers. Nothing in
 * the browser estimates them in live mode: the in-browser IV/OI model is the
 * fabrication §6 deletes, and a missing value renders "—".
 */
export interface OptionQuote {
  occSymbol: string
  underlyingTicker: string
  right: 'CALL' | 'PUT'
  strike: number
  /** `YYYY-MM-DD`. */
  expiration: string
  dte: number
  bid?: number
  ask?: number
  mid?: number
  bidSize?: number
  askSize?: number
  volume?: number
  openInterest?: number
  impliedVolatility?: number
  greeks?: { delta: number; gamma: number; theta: number; vega: number; rho: number }
  underlyingPrice?: number
  eventTime?: string
  provenance: Provenance
}

export interface OptionChainPage {
  symbol: string
  underlying?: MarketQuote
  asOf?: string
  staleness?: MarketStaleness
  provenance: Provenance
  contracts: OptionQuote[]
  contractCount: number
  totalContractCount: number
  /**
   * True when this response is a **page** of the chain, not the chain.
   * Callers must not compute chain-wide aggregates from it (§15.4); the
   * whole-chain roll-up lives on the snapshot route's `chainSummary`.
   */
  truncated: boolean
  maxContracts: number
}

export interface ChainSummary {
  contractCount: number
  expirations: string[]
  atmImpliedVolatility?: number
  totalCallVolume?: number
  totalPutVolume?: number
  totalCallOpenInterest?: number
  totalPutOpenInterest?: number
  putCallVolumeRatio?: number
  asOf?: string
}

export interface MarketSnapshotView {
  symbol: string
  underlying?: MarketQuote
  chainSummary?: ChainSummary
  staleness?: MarketStaleness
  mode: string
  session: string
  provenance: Provenance
  asOf?: string
  sequence: number
}

export interface MarketBar {
  /** Unix seconds, ascending. */
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  vwap?: number
  tradeCount?: number
}

export interface MarketBarsPage {
  symbol: string
  interval: string
  bars: MarketBar[]
  /**
   * True when the page hit the effective limit. Because the store scans
   * ascending, a truncated page holds the **oldest** bars of the window — the
   * newest candles are the ones missing. A caller that wants recent candles
   * narrows the window; raising the limit makes it worse (§15.3).
   */
  truncated: boolean
  provenance: Provenance
}

export interface MarketStatusView {
  mode: string
  session: string
  latestDataAgeSeconds: number
  serverTime?: string
  wallTime?: string
  realtimeAvailable: boolean
  storageAvailable: boolean
  serviceVersion: string
  replay?: {
    state: string
    datasetId: string
    seed: number
    speed: number
    clock?: string
    datasetStart?: string
    datasetEnd?: string
    eventsTotal: number
    eventsEmitted: number
  }
  /** The provenance the whole service is claiming right now. */
  provenance: Provenance
}

/* ----------------------------------------------------------- mark source ---- */

/**
 * A server-supplied mark for one option contract, keyed by
 * `optionMarkKey()`. This is what turns a plt position's unrealized P&L from
 * an entry-based estimate into a real one.
 */
export interface OptionMark {
  key: string
  occSymbol: string
  mid?: number
  bid?: number
  ask?: number
  impliedVolatility?: number
  openInterest?: number
  volume?: number
  greeks?: OptionQuote['greeks']
  asOf?: string
  provenance: Provenance
}

export type OptionMarkMap = Record<string, OptionMark>

/* ------------------------------------------------------------------- api ---- */

export interface BarWindow {
  /** RFC3339 UTC, inclusive. Required — the facade refuses an unbounded
   *  window (§15.3). */
  start: string
  /** RFC3339 UTC, exclusive. */
  end: string
  interval: import('@/api/http/wire/mnd').MndBarInterval
  /** Optional page cap; must be <= `MND_MAX_BAR_LIMIT` or mnd answers 400. */
  limit?: number
}

export interface ChainQuery {
  /** `YYYY-MM-DD`; a single-expiration filter. */
  expiration?: string
  minDte?: number
  maxDte?: number
  right?: 'CALL' | 'PUT'
  /** Must be <= `MND_MAX_CHAIN_CONTRACTS` or mnd answers 400 (§15.4). */
  limit?: number
}

/**
 * The read-only market-data seam.
 *
 * Deliberately missing: historical chains, chain-snapshot history and any
 * stream. All three are deferred from the V1 facade and have **no route at
 * all** (a 404, pinned by an mnd test), so this interface cannot promise them.
 */
export interface MarketDataApi {
  getStatus(signal?: AbortSignal): Promise<MarketStatusView>
  getSnapshot(
    symbol: string,
    options?: { chainSummary?: boolean; signal?: AbortSignal },
  ): Promise<MarketSnapshotView>
  getBars(symbol: string, window: BarWindow, signal?: AbortSignal): Promise<MarketBarsPage>
  getChain(symbol: string, query?: ChainQuery, signal?: AbortSignal): Promise<OptionChainPage>
}
