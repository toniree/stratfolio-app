import { describe, expect, it } from 'vitest'
import {
  BarWindowError,
  barWindow,
  chainMarks,
  optionMarkKey,
  quoteMark,
  toBars,
  toChain,
  toMarketStatus,
  toProvenance,
  toQuote,
  toSnapshot,
  weakestProvenance,
} from '@/api/http/adapters/market'
import { MND_MAX_BAR_LIMIT } from '@/api/http/wire/mnd'
import {
  LIVE_PROVENANCE,
  MARKET_STATUS_REPLAY,
  REPLAY_PROVENANCE,
  SPY_BARS,
  SPY_CALL,
  SPY_CHAIN,
  SPY_QUOTE,
  SPY_SNAPSHOT,
  SYNTHETIC_PROVENANCE,
} from '@/test/msw/fixtures/mnd'

describe('mnd money decoding (§15.2)', () => {
  it('parses every quote price from its decimal string', () => {
    const quote = toQuote(SPY_QUOTE)!
    expect(quote).toMatchObject({ bid: 592.1, ask: 592.14, mid: 592.12, last: 592.11 })
    // Counts stay integers and are not run through the money path.
    expect(quote.bidSize).toBe(400)
    expect(quote.volume).toBe(41_233_900)
  })

  it('parses the nested contract money — strike and underlying_price included', () => {
    const [call] = toChain(SPY_CHAIN).contracts
    expect(call.strike).toBe(600)
    expect(call.bid).toBe(7.15)
    expect(call.ask).toBe(7.35)
    expect(call.mid).toBe(7.25)
    expect(call.underlyingPrice).toBe(592.12)
    // Greeks and IV are plain numbers, passed through untouched: they are
    // dimensionless model outputs and must never be treated as money.
    expect(call.impliedVolatility).toBe(0.1842)
    expect(call.greeks?.delta).toBe(0.4123)
    expect(call.openInterest).toBe(88_204)
  })

  it('parses the nested bar money — every OHLC leg and the VWAP', () => {
    const page = toBars(SPY_BARS)
    expect(page.bars).toHaveLength(2)
    expect(page.bars[1]).toMatchObject({
      open: 590.9,
      high: 593.14,
      low: 590.02,
      close: 592.11,
      vwap: 591.88,
      volume: 41_233_900,
    })
    // Oldest first, as the route promises.
    expect(page.bars[0].time).toBeLessThan(page.bars[1].time)
  })

  it('leaves a missing price undefined rather than 0', () => {
    const quote = toQuote({ ...SPY_QUOTE, bid: '', mid: 'not-a-number' })!
    expect(quote.bid).toBeUndefined()
    expect(quote.mid).toBeUndefined()
    // A one-sided book is not a mark; `last` is the honest fallback.
    expect(quoteMark(quote)).toBe(592.11)
  })

  it('drops a bar it cannot draw honestly instead of substituting a leg', () => {
    const page = toBars({
      ...SPY_BARS,
      bars: [{ ...SPY_BARS.bars[0], high: '' }, SPY_BARS.bars[1]],
    })
    expect(page.bars).toHaveLength(1)
    expect(page.bars[0].close).toBe(592.11)
  })
})

describe('provenance mapping (D10)', () => {
  it('maps synthetic through as synthetic — the anti-deception case', () => {
    expect(toProvenance(SYNTHETIC_PROVENANCE)).toBe('synthetic')
  })

  it('maps a replay source to replay', () => {
    expect(toProvenance(REPLAY_PROVENANCE)).toBe('replay')
  })

  it('maps a live source in realtime mode to live', () => {
    expect(toProvenance(LIVE_PROVENANCE)).toBe('live')
  })

  it('demotes a live source served in replay mode to replay', () => {
    expect(toProvenance({ ...LIVE_PROVENANCE, mode: 'MARKET_MODE_REPLAY' })).toBe('replay')
  })

  it('never promotes an unknown or absent origin to live', () => {
    expect(toProvenance(undefined)).toBe('synthetic')
    expect(toProvenance({ ...LIVE_PROVENANCE, source: 'DATA_SOURCE_FUTURE' })).toBe('synthetic')
  })

  it('takes the weakest claim when a response mixes sources', () => {
    const snapshot = toSnapshot({
      ...SPY_SNAPSHOT,
      provenance: LIVE_PROVENANCE,
      underlying: { ...SPY_QUOTE, provenance: SYNTHETIC_PROVENANCE },
    })
    // A live-labelled envelope around a generated quote is not live data.
    expect(snapshot.provenance).toBe('synthetic')
    expect(weakestProvenance('live', 'replay', undefined)).toBe('replay')
  })
})

describe('truncation flags (§15.3, §15.4)', () => {
  it('reports a chain page as truncated and keeps both counts', () => {
    const page = toChain(SPY_CHAIN)
    expect(page.truncated).toBe(true)
    expect(page.contractCount).toBe(2)
    expect(page.totalContractCount).toBe(7_312)
    expect(page.maxContracts).toBe(1500)
  })

  it('treats a count mismatch as truncation even if the flag is false', () => {
    const page = toChain({ ...SPY_CHAIN, truncated: false })
    expect(page.truncated).toBe(true)
  })

  it('is not truncated when the page holds the whole filtered chain', () => {
    const page = toChain({ ...SPY_CHAIN, total_contract_count: 2, truncated: false })
    expect(page.truncated).toBe(false)
  })

  it('passes the bars truncation flag through', () => {
    expect(toBars(SPY_BARS).truncated).toBe(false)
    expect(toBars({ ...SPY_BARS, truncated: true }).truncated).toBe(true)
  })

  it('keeps chain-wide totals on the snapshot, where they are computed over the whole chain', () => {
    const snapshot = toSnapshot(SPY_SNAPSHOT)
    // 7,312 — deliberately not the 2 contracts a truncated page would carry.
    expect(snapshot.chainSummary?.contractCount).toBe(7_312)
    expect(snapshot.chainSummary?.expirations).toEqual([
      '2026-09-04',
      '2026-09-11',
      '2026-09-18',
    ])
  })
})

describe('option marks', () => {
  it('keys a mark by the tuple plt actually sends, not a hand-rolled OCC symbol', () => {
    expect(optionMarkKey({ symbol: 'spy', right: 'CALL', strike: 600, expiry: '2026-09-18' })).toBe(
      'SPY|2026-09-18|600.0000|CALL',
    )
    // 150 and 150.0000 are the same strike and must collide.
    expect(optionMarkKey({ symbol: 'SPY', right: 'PUT', strike: 150, expiry: '2026-09-18' })).toBe(
      optionMarkKey({ symbol: 'SPY', right: 'PUT', strike: 150.0, expiry: '2026-09-18' }),
    )
  })

  it('indexes a chain page by mark key with the server mid', () => {
    const marks = chainMarks(toChain(SPY_CHAIN))
    expect(marks['SPY|2026-09-18|600.0000|CALL']).toMatchObject({
      mid: 7.25,
      occSymbol: 'SPY260918C00600000',
      impliedVolatility: 0.1842,
      openInterest: 88_204,
      provenance: 'replay',
    })
    expect(marks['SPY|2026-09-18|600.0000|PUT']?.mid).toBe(14.25)
  })

  it('omits a contract the server did not quote rather than marking it at nothing', () => {
    const marks = chainMarks(
      toChain({ ...SPY_CHAIN, contracts: [{ ...SPY_CALL, mid: '', bid: '', ask: '' }] }),
    )
    expect(Object.keys(marks)).toHaveLength(0)
  })

  it('falls back to a two-sided midpoint when the server sent no mid', () => {
    const marks = chainMarks(toChain({ ...SPY_CHAIN, contracts: [{ ...SPY_CALL, mid: '' }] }))
    expect(marks['SPY|2026-09-18|600.0000|CALL']?.mid).toBeCloseTo(7.25, 6)
  })
})

describe('bounded bar windows (§15.3)', () => {
  const end = Date.parse('2026-08-31T13:35:00Z')

  it('always produces both bounds', () => {
    const window = barWindow({ end, spanMs: 2 * 86_400_000, interval: '5m' })
    expect(window.start).toBe('2026-08-29T13:35:00.000Z')
    expect(window.end).toBe('2026-08-31T13:35:00.000Z')
    expect(new Date(window.end).getTime()).toBeGreaterThan(new Date(window.start).getTime())
  })

  it('refuses a non-positive span — an unbounded scan is a 400 at the facade', () => {
    expect(() => barWindow({ end, spanMs: 0, interval: '1d' })).toThrow(BarWindowError)
    expect(() => barWindow({ end, spanMs: -1, interval: '1d' })).toThrow(BarWindowError)
  })

  it('refuses a limit above the store cap locally rather than spending a certain 400', () => {
    expect(() =>
      barWindow({ end, spanMs: 86_400_000, interval: '1d', limit: MND_MAX_BAR_LIMIT + 1 }),
    ).toThrow(/narrow the window/)
    expect(barWindow({ end, spanMs: 86_400_000, interval: '1d', limit: 500 }).limit).toBe(500)
  })
})

describe('market status', () => {
  it('reports a replay clock and calls the mode a replay', () => {
    const status = toMarketStatus(MARKET_STATUS_REPLAY)
    expect(status.provenance).toBe('replay')
    expect(status.replay?.clock).toBe('2026-08-31T13:35:00Z')
    expect(status.realtimeAvailable).toBe(false)
    // Event time and wall time stay distinct; the replay clock is not "now".
    expect(status.wallTime).not.toBe(status.serverTime)
  })
})
