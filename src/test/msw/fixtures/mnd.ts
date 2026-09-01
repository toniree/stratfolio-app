import type {
  MndBars,
  MndChain,
  MndEquityQuote,
  MndMarketStatus,
  MndOptionContract,
  MndProvenance,
  MndSnapshot,
} from '@/api/http/wire/mnd'

/**
 * Fixtures pinned against the mnd :7102 facade's own encoding
 * (`internal/marketjson/marketjson.go`, contracts §15).
 *
 * The point of every literal here is that **money is a decimal string** and
 * counts, Greeks and IV are numbers. If a future change to the adapter starts
 * treating `strike: "150.00"` as a number-shaped field, these fixtures are what
 * catches it — including the nested ones (strike, OHLCV, VWAP,
 * `underlying_price`) that a hand-rolled parser is most likely to miss.
 */

export const REPLAY_PROVENANCE: MndProvenance = {
  source: 'DATA_SOURCE_REPLAY',
  mode: 'MARKET_MODE_REPLAY',
  provider: 'replay',
  dataset_id: 'spy-2026-08',
  seed: 42,
}

export const SYNTHETIC_PROVENANCE: MndProvenance = {
  source: 'DATA_SOURCE_SYNTHETIC',
  mode: 'MARKET_MODE_REPLAY',
  provider: 'synthetic',
  dataset_id: '',
  seed: 7,
}

export const LIVE_PROVENANCE: MndProvenance = {
  source: 'DATA_SOURCE_LIVE',
  mode: 'MARKET_MODE_REALTIME',
  provider: 'schwab',
  dataset_id: '',
  seed: 0,
}

export const SPY_QUOTE: MndEquityQuote = {
  ticker: 'SPY',
  bid: '592.10',
  ask: '592.14',
  mid: '592.12',
  last: '592.11',
  bid_size: 400,
  ask_size: 250,
  volume: 41_233_900,
  event_time: '2026-08-31T13:35:00Z',
  ingest_time: '2026-08-31T13:35:00.412Z',
  provenance: REPLAY_PROVENANCE,
}

export const SPY_CALL: MndOptionContract = {
  occ_symbol: 'SPY260918C00600000',
  underlying_ticker: 'SPY',
  type: 'OPTION_TYPE_CALL',
  // Nested money: a strike is a decimal string too.
  strike: '600.00',
  expiration_date: '2026-09-18',
  dte: 18,
  bid: '7.15',
  ask: '7.35',
  mid: '7.25',
  bid_size: 12,
  ask_size: 30,
  volume: 4_512,
  open_interest: 88_204,
  // IV and the Greeks are JSON numbers, never money strings.
  implied_volatility: 0.1842,
  greeks: { delta: 0.4123, gamma: 0.0071, theta: -0.1934, vega: 0.5512, rho: 0.2201 },
  underlying_price: '592.12',
  event_time: '2026-08-31T13:35:00Z',
  ingest_time: '2026-08-31T13:35:00.500Z',
  provenance: REPLAY_PROVENANCE,
}

export const SPY_PUT: MndOptionContract = {
  ...SPY_CALL,
  occ_symbol: 'SPY260918P00600000',
  type: 'OPTION_TYPE_PUT',
  bid: '14.05',
  ask: '14.45',
  mid: '14.25',
  volume: 2_210,
  open_interest: 51_003,
  implied_volatility: 0.2011,
  greeks: { delta: -0.5814, gamma: 0.0069, theta: -0.2015, vega: 0.5601, rho: -0.3004 },
}

export const SPY_SNAPSHOT: MndSnapshot = {
  ticker: 'SPY',
  underlying: SPY_QUOTE,
  chain_summary: {
    contract_count: 7_312,
    expirations: ['2026-09-04', '2026-09-11', '2026-09-18'],
    atm_implied_volatility: 0.1795,
    total_call_volume: 1_204_112,
    total_put_volume: 998_004,
    total_call_open_interest: 4_120_009,
    total_put_open_interest: 3_880_112,
    put_call_volume_ratio: 0.8288,
    as_of: '2026-08-31T13:35:00Z',
  },
  staleness: {
    event_time: '2026-08-31T13:35:00Z',
    ingest_time: '2026-08-31T13:35:00.412Z',
    age_seconds: 1.4,
    stale: false,
    threshold_seconds: 30,
  },
  mode: 'MARKET_MODE_REPLAY',
  session: 'SESSION_REGULAR',
  provenance: REPLAY_PROVENANCE,
  as_of: '2026-08-31T13:35:00Z',
  sequence: 918_233,
}

/** A truncated chain page: 2 of 7,312 contracts (§15.4). */
export const SPY_CHAIN: MndChain = {
  ticker: 'SPY',
  underlying: SPY_QUOTE,
  as_of: '2026-08-31T13:35:00Z',
  staleness: SPY_SNAPSHOT.staleness,
  provenance: REPLAY_PROVENANCE,
  contracts: [SPY_CALL, SPY_PUT],
  contract_count: 2,
  total_contract_count: 7_312,
  truncated: true,
  max_contracts: 1500,
}

export const SPY_BARS: MndBars = {
  ticker: 'SPY',
  interval: 'BAR_INTERVAL_ONE_DAY',
  start: '2026-08-17T00:00:00Z',
  end: '2026-09-01T00:00:00Z',
  bars: [
    {
      ticker: 'SPY',
      interval: 'BAR_INTERVAL_ONE_DAY',
      start_time: '2026-08-28T00:00:00Z',
      // Nested money again: every OHLC leg and the VWAP are decimal strings.
      open: '588.40',
      high: '591.02',
      low: '587.11',
      close: '590.55',
      volume: 62_004_112,
      vwap: '589.61',
      trade_count: 812_004,
      provenance: REPLAY_PROVENANCE,
    },
    {
      ticker: 'SPY',
      interval: 'BAR_INTERVAL_ONE_DAY',
      start_time: '2026-08-31T00:00:00Z',
      open: '590.90',
      high: '593.14',
      low: '590.02',
      close: '592.11',
      volume: 41_233_900,
      vwap: '591.88',
      trade_count: 511_223,
      provenance: REPLAY_PROVENANCE,
    },
  ],
  bar_count: 2,
  order: 'oldest_first',
  truncated: false,
  provenance: REPLAY_PROVENANCE,
}

export const MARKET_STATUS_REPLAY: MndMarketStatus = {
  mode: 'MARKET_MODE_REPLAY',
  session: 'SESSION_REGULAR',
  latest_data_age_seconds: 1.4,
  server_time: '2026-08-31T13:35:00Z',
  wall_time: '2026-08-31T21:02:11Z',
  realtime_available: false,
  storage_available: true,
  service_version: '0.1.0',
  replay: {
    state: 'STATE_RUNNING',
    dataset_id: 'spy-2026-08',
    seed: 42,
    speed: 1,
    clock: '2026-08-31T13:35:00Z',
    dataset_start: '2026-08-03T13:30:00Z',
    dataset_end: '2026-08-31T20:00:00Z',
    events_total: 4_120_004,
    events_emitted: 2_004_112,
  },
}
