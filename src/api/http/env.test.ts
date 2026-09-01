import { describe, expect, it } from 'vitest'
import { dataMode, hasLiveDomain, isLive, requestTimeoutMs, serviceBase } from '@/api/http/env'

describe('per-domain data mode (D2)', () => {
  it('defaults every domain to mock when nothing is set', () => {
    const env = {}
    expect(dataMode('portfolio', env)).toBe('mock')
    expect(dataMode('universe', env)).toBe('mock')
    expect(dataMode('news', env)).toBe('mock')
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

describe('request timeout', () => {
  it('falls back to a sane default for a missing or nonsense value', () => {
    expect(requestTimeoutMs({})).toBe(15_000)
    expect(requestTimeoutMs({ VITE_API_TIMEOUT_MS: 'soon' })).toBe(15_000)
    expect(requestTimeoutMs({ VITE_API_TIMEOUT_MS: '-1' })).toBe(15_000)
    expect(requestTimeoutMs({ VITE_API_TIMEOUT_MS: '30000' })).toBe(30_000)
  })
})
