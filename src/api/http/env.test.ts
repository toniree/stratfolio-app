import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MARKET_SYMBOLS,
  backtestTimeoutMs,
  chainPollMs,
  dataMode,
  hasLiveDomain,
  isLive,
  marketSymbols,
  quotePollMs,
  requestTimeoutMs,
  serviceBase,
} from '@/api/http/env'

describe('per-domain data mode (D2)', () => {
  it('defaults every domain to mock when nothing is set', () => {
    const env = {}
    expect(dataMode('portfolio', env)).toBe('mock')
    expect(dataMode('universe', env)).toBe('mock')
    expect(dataMode('news', env)).toBe('mock')
    expect(dataMode('market', env)).toBe('mock')
    expect(dataMode('research', env)).toBe('mock')
    expect(hasLiveDomain(env)).toBe(false)
  })

  it('treats anything other than the exact string "live" as mock', () => {
    // A typo must never accidentally point the UI at a real backend, and an
    // unset flag must never mean "live because a server happens to be up".
    for (const value of ['Live', 'LIVE', 'true', '1', 'http', '', undefined]) {
      expect(dataMode('portfolio', { VITE_DATA_PORTFOLIO: value })).toBe('mock')
    }
    expect(isLive('portfolio', { VITE_DATA_PORTFOLIO: 'live' })).toBe(true)
  })

  it('switches domains independently', () => {
    const env = { VITE_DATA_PORTFOLIO: 'live' }
    expect(isLive('portfolio', env)).toBe(true)
    expect(isLive('planner', env)).toBe(false)
    // One live domain is enough to make the global "everything is simulated"
    // claim false (D10).
    expect(hasLiveDomain(env)).toBe(true)
  })
})

describe('research backtests (APP-122)', () => {
  it('has its own flag: the desk does not go live with the portfolio', () => {
    expect(isLive('research', { VITE_DATA_PORTFOLIO: 'live' })).toBe(false)
    expect(isLive('research', { VITE_DATA_RESEARCH: 'live' })).toBe(true)
    expect(hasLiveDomain({ VITE_DATA_RESEARCH: 'live' })).toBe(true)
  })

  it('gives the synchronous backtest POST a budget of its own', () => {
    // The general budget would abort a request bkt is still honestly working
    // on — and an aborted POST throws away the id of a run that happened.
    expect(requestTimeoutMs({})).toBe(15_000)
    expect(backtestTimeoutMs({})).toBe(300_000)
    expect(backtestTimeoutMs({ VITE_BACKTEST_TIMEOUT_MS: '60000' })).toBe(60_000)
    expect(backtestTimeoutMs({ VITE_BACKTEST_TIMEOUT_MS: 'soon' })).toBe(300_000)
  })
})

describe('service bases', () => {
  it('uses same-origin prefixes by default — no service sends CORS headers', () => {
    expect(serviceBase('plt', {})).toBe('/plt')
    expect(serviceBase('ai', {})).toBe('/ai')
    expect(serviceBase('bkt', {})).toBe('/bkt')
    expect(serviceBase('mnd', {})).toBe('/mnd')
  })

  it('honours an explicit override for a differently-mounted reverse proxy', () => {
    expect(serviceBase('plt', { VITE_PLT_BASE: '/api/plt' })).toBe('/api/plt')
  })
})

describe('market data configuration (APP-108)', () => {
  it('has its own flag, so live quotes do not ride in on another domain', () => {
    expect(isLive('market', { VITE_DATA_PORTFOLIO: 'live' })).toBe(false)
    expect(isLive('market', { VITE_DATA_MARKET: 'live' })).toBe(true)
    expect(hasLiveDomain({ VITE_DATA_MARKET: 'live' })).toBe(true)
  })

  it('defaults to the symbols the active replay dataset actually serves', () => {
    // mnd's `synthetic-v1` serves these three and nothing else — QQQ and NVDA
    // answer 404/503 there (Wave B0 proof pass). A default naming symbols the
    // dataset cannot serve spends every poll on guaranteed failures, and the
    // list must be re-matched whenever the dataset or provider changes.
    expect(DEFAULT_MARKET_SYMBOLS).toEqual(['SPY', 'AAPL', 'MSFT'])
  })

  it('parses a symbol request list, upper-cased and de-duplicated', () => {
    expect(marketSymbols({})).toEqual([...DEFAULT_MARKET_SYMBOLS])
    expect(marketSymbols({ VITE_MARKET_SYMBOLS: ' spy , qqq ,spy ' })).toEqual(['SPY', 'QQQ'])
    // An empty or all-blank list is not "watch nothing"; it is unset.
    expect(marketSymbols({ VITE_MARKET_SYMBOLS: ' , ' })).toEqual([...DEFAULT_MARKET_SYMBOLS])
  })

  it('polls chains far more slowly than quotes (D8)', () => {
    expect(quotePollMs({})).toBe(5_000)
    expect(chainPollMs({})).toBe(60_000)
    expect(chainPollMs({})).toBeGreaterThan(quotePollMs({}))
    // A nonsense or punishing value falls back rather than hammering mnd.
    expect(quotePollMs({ VITE_MARKET_QUOTE_POLL_MS: '10' })).toBe(5_000)
    expect(quotePollMs({ VITE_MARKET_QUOTE_POLL_MS: '15000' })).toBe(15_000)
  })
})

describe('request timeout', () => {
  it('falls back to a sane default for a missing or nonsense value', () => {
    expect(requestTimeoutMs({})).toBe(15_000)
    expect(requestTimeoutMs({ VITE_API_TIMEOUT_MS: 'soon' })).toBe(15_000)
    expect(requestTimeoutMs({ VITE_API_TIMEOUT_MS: '-1' })).toBe(15_000)
    expect(requestTimeoutMs({ VITE_API_TIMEOUT_MS: '30000' })).toBe(30_000)
  })
})
