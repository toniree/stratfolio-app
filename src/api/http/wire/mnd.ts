/**
 * Wire DTOs for the browser-facing market-data facade on service-mnd :7102
 * (backend contracts §15, MND-014). Pinned against
 * `service-mnd/internal/marketjson/marketjson.go` and
 * `service-mnd/internal/httpapi/market.go` — code, not prose.
 *
 * THREE ENCODING RULES ARE BINDING (contracts §15.2) and every type below is
 * shaped so TypeScript refuses to let a caller forget them:
 *
 *  1. **Money is a decimal string.** Every field that was `*_micros` on the
 *     gRPC wire is emitted here as a plain decimal USD string, with the
 *     `_micros` suffix dropped *together with the scale*. That is every price:
 *     quote bid/ask/mid/last, contract strike/bid/ask/mid/underlying_price,
 *     and bar open/high/low/close/vwap. They are typed `string`, never
 *     `number`, so a `Number(...)` has to be written somewhere visible — and
 *     the only place it is written is `adapters/market.ts`.
 *  2. **Counts are JSON integers; Greeks, IV, ratios and ages are JSON
 *     numbers.** Sizes, volume, open interest, trade count, dte and sequence
 *     are integers. Greeks and IV are dimensionless model outputs and must
 *     never be formatted as money.
 *  3. **Provenance and staleness pass through untouched at every level** —
 *     response, quote, contract and bar. mnd never omits a provenance field,
 *     so `DATA_SOURCE_SYNTHETIC` stays legible in the browser: "it came from
 *     mnd" is not the same claim as "it is real".
 *
 * Absent timestamps are `null`, never the zero instant.
 */

/** `DataSource` proto names. `DATA_SOURCE_SYNTHETIC` is the anti-deception
 *  signal the UI must surface (D10) — it is a generated price, not a quote. */
export type MndDataSource =
  | 'DATA_SOURCE_UNSPECIFIED'
  | 'DATA_SOURCE_LIVE'
  | 'DATA_SOURCE_REPLAY'
  | 'DATA_SOURCE_SYNTHETIC'
  | 'DATA_SOURCE_HISTORICAL'
  | (string & {})

/** `MarketMode` proto names. */
export type MndMarketMode =
  | 'MARKET_MODE_UNSPECIFIED'
  | 'MARKET_MODE_REALTIME'
  | 'MARKET_MODE_REPLAY'
  | (string & {})

export type MndOptionType =
  | 'OPTION_TYPE_UNSPECIFIED'
  | 'OPTION_TYPE_CALL'
  | 'OPTION_TYPE_PUT'
  | (string & {})

/** Every field is always emitted by mnd; none is omitted when empty. */
export interface MndProvenance {
  source: MndDataSource
  mode: MndMarketMode
  provider: string
  dataset_id: string
  seed: number
}

export interface MndStaleness {
  event_time: string | null
  ingest_time: string | null
  age_seconds: number
  stale: boolean
  threshold_seconds: number
}

/** Dimensionless model outputs. Never money. */
export interface MndGreeks {
  delta: number
  gamma: number
  theta: number
  vega: number
  rho: number
}

export interface MndEquityQuote {
  ticker: string
  /** Decimal USD strings. */
  bid: string
  ask: string
  mid: string
  last: string
  bid_size: number
  ask_size: number
  volume: number
  event_time: string | null
  ingest_time: string | null
  provenance: MndProvenance | null
}

export interface MndOptionContract {
  occ_symbol: string
  underlying_ticker: string
  type: MndOptionType
  /** Decimal USD string — a strike is money and arrives as a string too. */
  strike: string
  /** `YYYY-MM-DD`. */
  expiration_date: string
  dte: number
  bid: string
  ask: string
  mid: string
  bid_size: number
  ask_size: number
  volume: number
  open_interest: number
  implied_volatility: number
  greeks: MndGreeks
  underlying_price: string
  event_time: string | null
  ingest_time: string | null
  provenance: MndProvenance | null
}

/** Server-computed over the **whole** chain, so it stays correct even when a
 *  chain response is truncated (§15.4). */
export interface MndChainSummary {
  contract_count: number
  expirations: string[]
  atm_implied_volatility: number
  total_call_volume: number
  total_put_volume: number
  total_call_open_interest: number
  total_put_open_interest: number
  put_call_volume_ratio: number
  as_of: string | null
}

export interface MndSnapshot {
  ticker: string
  underlying: MndEquityQuote | null
  chain_summary: MndChainSummary | null
  staleness: MndStaleness | null
  mode: MndMarketMode
  session: string
  provenance: MndProvenance | null
  as_of: string | null
  sequence: number
}

export interface MndChain {
  ticker: string
  underlying: MndEquityQuote | null
  as_of: string | null
  staleness: MndStaleness | null
  provenance: MndProvenance | null
  contracts: MndOptionContract[]
  /** Contracts in *this* response. */
  contract_count: number
  /** Contracts the filtered chain held before the cap. */
  total_contract_count: number
  /** True when `contract_count < total_contract_count`: this is a **page of
   *  contracts, not a chain**, and chain-wide aggregates must not be computed
   *  from it (§15.4 — read `chain_summary` on the snapshot route instead). */
  truncated: boolean
  max_contracts: number
}

export interface MndBar {
  ticker: string
  interval: string
  start_time: string | null
  /** Decimal USD strings — OHLC and VWAP are money. */
  open: string
  high: string
  low: string
  close: string
  volume: number
  vwap: string
  trade_count: number
  provenance: MndProvenance | null
}

export interface MndBars {
  ticker: string
  interval: string
  start: string | null
  end: string | null
  bars: MndBar[]
  bar_count: number
  /** Always `"oldest_first"` (§15.3). */
  order: string
  /** True when the page hit the effective limit. The store scans **ascending**
   *  and the limit cuts the **newest** end, so a truncated page holds the
   *  OLDEST bars of the window. A chart wanting recent candles must narrow the
   *  window, never raise the limit. */
  truncated: boolean
  provenance: MndProvenance | null
}

export interface MndReplayStatus {
  state: string
  dataset_id: string
  seed: number
  speed: number
  clock: string | null
  dataset_start: string | null
  dataset_end: string | null
  events_total: number
  events_emitted: number
}

export interface MndMarketStatus {
  mode: MndMarketMode
  session: string
  latest_data_age_seconds: number
  server_time: string | null
  wall_time: string | null
  realtime_available: boolean
  storage_available: boolean
  service_version: string
  replay: MndReplayStatus | null
}

/* -------------------------------------------------------------- bounds ---- */

/** `marketjson.MaxChainContracts`. An explicit `limit` above this is a 400
 *  (§15.4); an unbounded request over a bigger chain is truncated instead. */
export const MND_MAX_CHAIN_CONTRACTS = 1500

/** `store.MaxBarLimit`. An explicit `limit` above this is a 400 (§15.3). */
export const MND_MAX_BAR_LIMIT = 50_000

/** `store.DefaultBarLimit` — the limit mnd applies when the caller sends none. */
export const MND_DEFAULT_BAR_LIMIT = 10_000

/** Bar intervals the facade accepts (`barInterval` in market.go). */
export type MndBarInterval = '1m' | '5m' | '15m' | '1h' | '1d'
