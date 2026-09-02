import type { Provenance } from '@/api/types'
import type {
  MndBar,
  MndBars,
  MndChain,
  MndChainSummary,
  MndEquityQuote,
  MndMarketStatus,
  MndOptionContract,
  MndProvenance,
  MndSnapshot,
  MndStaleness,
} from '@/api/http/wire/mnd'
import { MND_MAX_BAR_LIMIT, MND_MAX_CHAIN_CONTRACTS } from '@/api/http/wire/mnd'
import type {
  BarWindow,
  ChainSummary,
  MarketBar,
  MarketBarsPage,
  MarketQuote,
  MarketSnapshotView,
  MarketStaleness,
  MarketStatusView,
  OptionChainPage,
  OptionMark,
  OptionMarkMap,
  OptionQuote,
} from '@/api/marketData/types'
import { decimal, integer, instant, text } from '@/api/http/wire/scalars'

/**
 * Pure wire → view-model mapping for the mnd :7102 market facade.
 *
 * This module is the **one** place a §15 decimal-money string becomes a
 * JavaScript number. Every price on that wire — quote bid/ask/mid/last,
 * contract strike/bid/ask/mid/underlying_price, bar open/high/low/close/vwap —
 * is a string precisely so a careless `bid_micros: 190.12` misread is
 * impossible; parsing them in one tested function is the other half of that
 * bargain. `decimal()` never coerces a missing value to 0, so an absent price
 * stays `undefined` and the UI renders a gap rather than a free contract.
 *
 * Counts stay integers, Greeks and IV stay plain numbers (they are
 * dimensionless model outputs, never money), timestamps stay RFC3339 strings,
 * and provenance is passed through at every level — response, quote, contract
 * and bar — because "it came from mnd" is not the same claim as "it is real".
 */

/* -------------------------------------------------------- provenance ------ */

/**
 * mnd's `DataSource`/`MarketMode` enums → the app's per-panel provenance (D10).
 *
 * `DATA_SOURCE_SYNTHETIC` is the load-bearing case: mnd generated the number
 * itself, and the ProvenanceTag must say so. Replay is real recorded provider
 * data off a fixed clock, which is a different (and weaker) claim than live.
 * Anything unrecognised degrades to `synthetic` — the cautious direction. An
 * unknown origin must never be promoted to "live".
 */
export function toProvenance(wire: MndProvenance | null | undefined): Provenance {
  if (!wire) return 'synthetic'
  switch (wire.source) {
    case 'DATA_SOURCE_LIVE':
      // A live source in replay mode is still a replay: the mode is the
      // stronger constraint on what the number actually is.
      return wire.mode === 'MARKET_MODE_REPLAY' ? 'replay' : 'live'
    case 'DATA_SOURCE_REPLAY':
    case 'DATA_SOURCE_HISTORICAL':
      return 'replay'
    case 'DATA_SOURCE_SYNTHETIC':
      return 'synthetic'
    default:
      return wire.mode === 'MARKET_MODE_REPLAY' ? 'replay' : 'synthetic'
  }
}

/** The weaker of two provenance claims. A panel mixing a live quote with a
 *  synthetic chain is, as a whole, synthetic. */
const PROVENANCE_RANK: Record<Provenance, number> = {
  live: 3,
  replay: 2,
  synthetic: 1,
  mock: 0,
}

export function weakestProvenance(...claims: (Provenance | undefined)[]): Provenance {
  let weakest: Provenance = 'live'
  for (const claim of claims) {
    if (!claim) continue
    if (PROVENANCE_RANK[claim] < PROVENANCE_RANK[weakest]) weakest = claim
  }
  return weakest
}

export function toStaleness(wire: MndStaleness | null | undefined): MarketStaleness | undefined {
  if (!wire) return undefined
  return {
    eventTime: instant(wire.event_time),
    ingestTime: instant(wire.ingest_time),
    ageSeconds: decimal(wire.age_seconds) ?? 0,
    stale: wire.stale === true,
    thresholdSeconds: decimal(wire.threshold_seconds) ?? 0,
  }
}

/* ------------------------------------------------------------- quotes ----- */

export function toQuote(wire: MndEquityQuote | null | undefined): MarketQuote | undefined {
  if (!wire) return undefined
  return {
    symbol: wire.ticker,
    // Decimal STRINGS on the wire (§15.2). `decimal()` returns undefined for
    // an absent or unparseable value — never 0.
    bid: decimal(wire.bid),
    ask: decimal(wire.ask),
    mid: decimal(wire.mid),
    last: decimal(wire.last),
    bidSize: integer(wire.bid_size),
    askSize: integer(wire.ask_size),
    volume: integer(wire.volume),
    eventTime: instant(wire.event_time),
    provenance: toProvenance(wire.provenance),
    source: text(wire.provenance?.source),
  }
}

/**
 * The price a quote is worth marking at: mid when the book is two-sided,
 * otherwise last. Never an average of a missing side.
 */
export function quoteMark(quote: MarketQuote | undefined): number | undefined {
  if (!quote) return undefined
  if (quote.mid !== undefined && quote.mid > 0) return quote.mid
  if (quote.last !== undefined && quote.last > 0) return quote.last
  if (quote.bid !== undefined && quote.ask !== undefined && quote.bid > 0 && quote.ask > 0)
    return (quote.bid + quote.ask) / 2
  return undefined
}

function toRight(wire: MndOptionContract['type']): 'CALL' | 'PUT' {
  return wire === 'OPTION_TYPE_PUT' ? 'PUT' : 'CALL'
}

export function toOptionQuote(wire: MndOptionContract): OptionQuote {
  const greeks = wire.greeks
  return {
    occSymbol: wire.occ_symbol,
    underlyingTicker: wire.underlying_ticker,
    right: toRight(wire.type),
    // A strike is money, so it too arrives as a decimal string. Reading it
    // with `Number()` at a call site is the bug this module exists to prevent.
    strike: decimal(wire.strike) ?? 0,
    expiration: wire.expiration_date,
    dte: integer(wire.dte) ?? 0,
    bid: decimal(wire.bid),
    ask: decimal(wire.ask),
    mid: decimal(wire.mid),
    bidSize: integer(wire.bid_size),
    askSize: integer(wire.ask_size),
    volume: integer(wire.volume),
    openInterest: integer(wire.open_interest),
    // IV and Greeks are JSON numbers, not money — passed through, never
    // re-derived in the browser (§6 deletes in-browser IV fabrication).
    impliedVolatility: Number.isFinite(wire.implied_volatility)
      ? wire.implied_volatility
      : undefined,
    greeks: greeks
      ? {
          delta: greeks.delta,
          gamma: greeks.gamma,
          theta: greeks.theta,
          vega: greeks.vega,
          rho: greeks.rho,
        }
      : undefined,
    underlyingPrice: decimal(wire.underlying_price),
    eventTime: instant(wire.event_time),
    provenance: toProvenance(wire.provenance),
  }
}

export function toChainSummary(wire: MndChainSummary | null | undefined): ChainSummary | undefined {
  if (!wire) return undefined
  return {
    contractCount: integer(wire.contract_count) ?? 0,
    expirations: Array.isArray(wire.expirations) ? wire.expirations : [],
    atmImpliedVolatility: decimal(wire.atm_implied_volatility),
    totalCallVolume: integer(wire.total_call_volume),
    totalPutVolume: integer(wire.total_put_volume),
    totalCallOpenInterest: integer(wire.total_call_open_interest),
    totalPutOpenInterest: integer(wire.total_put_open_interest),
    putCallVolumeRatio: decimal(wire.put_call_volume_ratio),
    asOf: instant(wire.as_of),
  }
}

export function toSnapshot(wire: MndSnapshot): MarketSnapshotView {
  const underlying = toQuote(wire.underlying)
  return {
    symbol: wire.ticker,
    underlying,
    chainSummary: toChainSummary(wire.chain_summary),
    staleness: toStaleness(wire.staleness),
    mode: wire.mode,
    session: wire.session,
    // The response-level claim is only as strong as the quote inside it.
    provenance: weakestProvenance(toProvenance(wire.provenance), underlying?.provenance),
    asOf: instant(wire.as_of),
    sequence: integer(wire.sequence) ?? 0,
  }
}

export function toChain(wire: MndChain): OptionChainPage {
  const underlying = toQuote(wire.underlying)
  const contracts = (wire.contracts ?? []).map(toOptionQuote)
  const contractCount = integer(wire.contract_count) ?? contracts.length
  const totalContractCount = integer(wire.total_contract_count) ?? contractCount
  return {
    symbol: wire.ticker,
    underlying,
    asOf: instant(wire.as_of),
    staleness: toStaleness(wire.staleness),
    provenance: weakestProvenance(toProvenance(wire.provenance), underlying?.provenance),
    contracts,
    contractCount,
    // Trust the server's flag, but a count mismatch is the same fact and mnd
    // guarantees both are present: either one means this is a page, not a
    // chain, and no chain-wide aggregate may be computed from it (§15.4).
    totalContractCount,
    truncated: wire.truncated === true || contractCount < totalContractCount,
    maxContracts: integer(wire.max_contracts) ?? MND_MAX_CHAIN_CONTRACTS,
  }
}

/* --------------------------------------------------------------- bars ----- */

export function toBar(wire: MndBar): MarketBar | undefined {
  const start = instant(wire.start_time)
  const open = decimal(wire.open)
  const high = decimal(wire.high)
  const low = decimal(wire.low)
  const close = decimal(wire.close)
  // A bar missing a timestamp or any OHLC leg cannot be drawn honestly, and
  // substituting a neighbouring value would invent a candle. Drop it.
  if (start === undefined || open === undefined || high === undefined) return undefined
  if (low === undefined || close === undefined) return undefined
  return {
    time: Math.floor(Date.parse(start) / 1000),
    open,
    high,
    low,
    close,
    volume: integer(wire.volume) ?? 0,
    vwap: decimal(wire.vwap),
    tradeCount: integer(wire.trade_count),
  }
}

export function toBars(wire: MndBars): MarketBarsPage {
  const bars = (wire.bars ?? [])
    .map(toBar)
    .filter((bar): bar is MarketBar => bar !== undefined)
    // The facade already promises `order: "oldest_first"`, but a chart that
    // silently mis-orders is worse than one that sorts twice.
    .sort((a, b) => a.time - b.time)
  return {
    symbol: wire.ticker,
    interval: wire.interval,
    bars,
    truncated: wire.truncated === true,
    provenance: toProvenance(wire.provenance),
  }
}

export function toMarketStatus(wire: MndMarketStatus): MarketStatusView {
  const replay = wire.replay
  return {
    mode: wire.mode,
    session: wire.session,
    latestDataAgeSeconds: decimal(wire.latest_data_age_seconds) ?? 0,
    serverTime: instant(wire.server_time),
    wallTime: instant(wire.wall_time),
    realtimeAvailable: wire.realtime_available === true,
    storageAvailable: wire.storage_available === true,
    serviceVersion: wire.service_version,
    replay: replay
      ? {
          state: replay.state,
          datasetId: replay.dataset_id,
          seed: replay.seed,
          speed: replay.speed,
          clock: instant(replay.clock),
          datasetStart: instant(replay.dataset_start),
          datasetEnd: instant(replay.dataset_end),
          eventsTotal: integer(replay.events_total) ?? 0,
          eventsEmitted: integer(replay.events_emitted) ?? 0,
        }
      : undefined,
    // Status carries no `Provenance` message; the mode is the only claim it
    // makes. REPLAY is a replay; REALTIME only *permits* live data, so it is
    // not by itself evidence any particular quote was live.
    provenance: wire.mode === 'MARKET_MODE_REPLAY' ? 'replay' : 'live',
  }
}

/* --------------------------------------------------------------- marks ---- */

/**
 * The key a contract is marked under.
 *
 * plt positions carry `(ticker, option_type, strike, expiration)` and **no OCC
 * symbol**, so an OCC string cannot be the join key without the app
 * constructing one — and a hand-rolled OCC symbol that is subtly wrong would
 * silently mark the wrong contract. The tuple plt actually sends is the honest
 * key. The strike is fixed to 4dp so `150` and `150.0000` collide as they
 * should.
 */
export function optionMarkKey(input: {
  symbol: string
  right: 'CALL' | 'PUT'
  strike: number
  /** `YYYY-MM-DD`. */
  expiry: string
}): string {
  return `${input.symbol.toUpperCase()}|${input.expiry}|${input.strike.toFixed(4)}|${input.right}`
}

/**
 * Index a chain page by mark key.
 *
 * Only contracts with a usable mark are indexed: a contract whose mid, last
 * and both book sides are missing supplies no mark, and an entry with an
 * `undefined` mid would read downstream as "the server marked it at nothing".
 */
export function chainMarks(page: OptionChainPage): OptionMarkMap {
  const marks: OptionMarkMap = {}
  for (const contract of page.contracts) {
    const mid = optionQuoteMark(contract)
    if (mid === undefined) continue
    const key = optionMarkKey({
      symbol: contract.underlyingTicker || page.symbol,
      right: contract.right,
      strike: contract.strike,
      expiry: contract.expiration,
    })
    const mark: OptionMark = {
      key,
      occSymbol: contract.occSymbol,
      mid,
      bid: contract.bid,
      ask: contract.ask,
      impliedVolatility: contract.impliedVolatility,
      openInterest: contract.openInterest,
      volume: contract.volume,
      greeks: contract.greeks,
      asOf: contract.eventTime ?? page.asOf,
      provenance: contract.provenance,
    }
    marks[key] = mark
  }
  return marks
}

/** Mid when the server sent one, else the honest midpoint of a two-sided
 *  book. Never one side alone: a bid with no ask is not a mark. */
export function optionQuoteMark(contract: OptionQuote): number | undefined {
  if (contract.mid !== undefined && contract.mid > 0) return contract.mid
  if (contract.bid !== undefined && contract.ask !== undefined && contract.ask > 0)
    return (contract.bid + contract.ask) / 2
  return undefined
}

/* -------------------------------------------------------------- windows --- */

export class BarWindowError extends Error {}

/**
 * Build the **bounded** window the bars route requires.
 *
 * `start` and `end` are mandatory on this route — stricter than the gRPC RPC,
 * which permits an unbounded scan — because "every bar ever recorded" has no
 * browser use and is a denial of service on the local hypertables (§15.3).
 * This helper exists so no caller can construct a request without both.
 *
 * It also refuses a `limit` above `store.MaxBarLimit` locally rather than
 * spending a round trip on a guaranteed 400.
 */
export function barWindow(input: {
  end: Date | number
  /** Span back from `end`, in milliseconds. Must be positive. */
  spanMs: number
  interval: BarWindow['interval']
  limit?: number
}): BarWindow {
  const endMs = typeof input.end === 'number' ? input.end : input.end.getTime()
  if (!Number.isFinite(endMs)) throw new BarWindowError('bar window end must be a valid instant')
  if (!(input.spanMs > 0)) throw new BarWindowError('bar window span must be positive')
  if (input.limit !== undefined) {
    if (!Number.isInteger(input.limit) || input.limit <= 0)
      throw new BarWindowError('bar limit must be a positive integer')
    if (input.limit > MND_MAX_BAR_LIMIT)
      throw new BarWindowError(
        `bar limit ${input.limit} exceeds the facade maximum of ${MND_MAX_BAR_LIMIT}; narrow the window instead`,
      )
  }
  return {
    start: new Date(endMs - input.spanMs).toISOString(),
    end: new Date(endMs).toISOString(),
    interval: input.interval,
    limit: input.limit,
  }
}

/**
 * A truncated bar page holds the OLDEST bars of the window, so the newest
 * candles are the missing ones (§15.3). The fix is always a narrower window;
 * raising the limit cannot help once the store cap is reached. This is the
 * copy the chart shows rather than silently drawing stale candles as current.
 */
export const TRUNCATED_BARS_NOTE =
  'Showing the oldest bars in this window — newer candles were cut. Narrow the range.'

/** Same idea for chains: a page is not a chain (§15.4). */
export const TRUNCATED_CHAIN_NOTE =
  'Showing part of the chain. Filter by expiration or DTE for the rest; chain totals come from the snapshot summary.'
