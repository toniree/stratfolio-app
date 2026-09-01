import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { HttpMarketDataApi } from '@/api/http/HttpMarketDataApi'
import { ApiError } from '@/api/http/problem'
import { barWindow } from '@/api/http/adapters/market'
import { MND_MAX_BAR_LIMIT, MND_MAX_CHAIN_CONTRACTS } from '@/api/http/wire/mnd'
import { MARKET_STATUS_REPLAY, SPY_BARS, SPY_CHAIN, SPY_SNAPSHOT } from '@/test/msw/fixtures/mnd'
import { server, useMswServer } from '@/test/msw/server'

useMswServer()

const api = new HttpMarketDataApi()
const END = Date.parse('2026-08-31T13:35:00Z')

describe('HttpMarketDataApi request construction', () => {
  it('sends both bounds on every bars request (§15.3)', async () => {
    let seen = ''
    server.use(
      http.get('/mnd/api/v1/market/bars/SPY', ({ request }) => {
        seen = new URL(request.url).search
        return HttpResponse.json(SPY_BARS)
      }),
    )
    await api.getBars('spy', barWindow({ end: END, spanMs: 2 * 86_400_000, interval: '5m' }))
    const params = new URLSearchParams(seen)
    expect(params.get('start')).toBe('2026-08-29T13:35:00.000Z')
    expect(params.get('end')).toBe('2026-08-31T13:35:00.000Z')
    expect(params.get('interval')).toBe('5m')
    // No limit means mnd applies its own default; an empty `limit=` is a 400.
    expect(seen).not.toContain('limit=')
  })

  it('refuses an unbounded or inverted window before it reaches the wire', async () => {
    await expect(
      api.getBars('SPY', { start: '', end: '2026-08-31T13:35:00Z', interval: '1d' }),
    ).rejects.toBeInstanceOf(ApiError)
    await expect(
      api.getBars('SPY', {
        start: '2026-08-31T13:35:00Z',
        end: '2026-08-31T13:35:00Z',
        interval: '1d',
      }),
    ).rejects.toThrow(/after start/)
    await expect(
      api.getBars('SPY', {
        start: '2026-08-01T00:00:00Z',
        end: '2026-08-31T00:00:00Z',
        interval: '1d',
        limit: MND_MAX_BAR_LIMIT + 1,
      }),
    ).rejects.toThrow(/narrow the window/)
  })

  it('refuses an explicit chain limit above the cap instead of a certain 400', async () => {
    await expect(
      api.getChain('SPY', { limit: MND_MAX_CHAIN_CONTRACTS + 1 }),
    ).rejects.toThrow(/narrow the filter/)
  })

  it('maps chain filters onto the route’s snake_case query', async () => {
    let seen = ''
    server.use(
      http.get('/mnd/api/v1/market/chains/SPY', ({ request }) => {
        seen = new URL(request.url).search
        return HttpResponse.json(SPY_CHAIN)
      }),
    )
    await api.getChain('SPY', { expiration: '2026-09-18', minDte: 1, maxDte: 45, right: 'PUT' })
    const params = new URLSearchParams(seen)
    expect(params.get('expiration')).toBe('2026-09-18')
    expect(params.get('min_dte')).toBe('1')
    expect(params.get('max_dte')).toBe('45')
    expect(params.get('type')).toBe('put')
  })

  it('skips the whole-chain roll-up on a tape snapshot', async () => {
    let seen = ''
    server.use(
      http.get('/mnd/api/v1/market/snapshots/SPY', ({ request }) => {
        seen = new URL(request.url).search
        return HttpResponse.json(SPY_SNAPSHOT)
      }),
    )
    await api.getSnapshot('SPY')
    expect(new URLSearchParams(seen).get('chain_summary')).toBe('false')
  })

  it('surfaces the 409 refusal rather than degrading to a number', async () => {
    // FAILED_PRECONDITION -> 409 is how "REALTIME but no credentials" reaches
    // the browser: mnd refuses to fabricate a price and the client must not
    // paper over it.
    server.use(
      http.get('/mnd/api/v1/market/snapshots/SPY', () =>
        HttpResponse.json(
          {
            type: 'about:blank',
            title: 'Conflict',
            status: 409,
            detail: 'MARKET_MODE=REALTIME but provider has no credentials',
          },
          { status: 409, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )
    await expect(api.getSnapshot('SPY')).rejects.toMatchObject({ status: 409 })
  })

  it('reads the replay clock off the status route', async () => {
    server.use(
      http.get('/mnd/api/v1/market/status', () => HttpResponse.json(MARKET_STATUS_REPLAY)),
    )
    const status = await api.getStatus()
    expect(status.mode).toBe('MARKET_MODE_REPLAY')
    expect(status.replay?.clock).toBe('2026-08-31T13:35:00Z')
  })
})
