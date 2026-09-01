import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { HttpPortfolioApi } from '@/api/http/HttpPortfolioApi'
import { ApiError } from '@/api/http/problem'
import { PLT_LIST_LIMIT_MAX } from '@/api/http/wire/plt'
import { SILENT_TRADE_CLOSED_FIXTURE } from '@/test/msw/fixtures/plt'
import { server, useMswServer } from '@/test/msw/server'

useMswServer()

/**
 * End-to-end over MSW: the adapter's queries must match plt's real contract,
 * because a wrong query is a bug the pure mapping tests cannot catch.
 */
describe('HttpPortfolioApi', () => {
  it('returns exactly one live paper account', async () => {
    const accounts = await new HttpPortfolioApi().getAccounts()
    expect(accounts).toHaveLength(1)
    expect(accounts[0].provenance).toBe('live')
  })

  it('asks plt only for OPEN positions', async () => {
    let seen: string | null = null
    server.use(
      http.get('/plt/api/v1/positions', ({ request }) => {
        seen = new URL(request.url).searchParams.get('status')
        return HttpResponse.json([])
      }),
    )
    await new HttpPortfolioApi().getPositions()
    // `status` overrides `include_closed` server-side; asking explicitly means
    // a change to plt's default cannot silently add closed rows.
    expect(seen).toBe('OPEN')
  })

  it('builds the settled-equity curve from CLOSED trades at plt’s hard cap', async () => {
    const params: Record<string, string | null> = {}
    server.use(
      http.get('/plt/api/v1/silent-trades', ({ request }) => {
        const search = new URL(request.url).searchParams
        params.status = search.get('status')
        params.limit = search.get('limit')
        return HttpResponse.json([SILENT_TRADE_CLOSED_FIXTURE])
      }),
    )
    const series = await new HttpPortfolioApi().getPerformance('paper', 'ALL')
    expect(params.status).toBe('CLOSED')
    // 500 is the maximum plt accepts; 501 would be a 400, not a clamp.
    expect(params.limit).toBe(String(PLT_LIST_LIMIT_MAX))
    expect(series.basis).toBe('settled-equity')
    expect(series.provenance).toBe('live')
    expect(series.truncated).toBe(false)
  })

  it('flags the curve as truncated when the list comes back at the cap', async () => {
    const rows = Array.from({ length: PLT_LIST_LIMIT_MAX }, (_, i) => ({
      ...SILENT_TRADE_CLOSED_FIXTURE,
      id: `t-${i}`,
      exit_ts: new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString(),
    }))
    server.use(http.get('/plt/api/v1/silent-trades', () => HttpResponse.json(rows)))
    const series = await new HttpPortfolioApi().getPerformance('paper', 'ALL')
    // HKP-PLT-8: no cursor exists, so older history is unreachable and the
    // chart says so rather than implying the book began in January.
    expect(series.truncated).toBe(true)
    expect(series.label).toMatch(/500/)
  })

  it('merges orders without an N+1 fan-out over by-plan executions', async () => {
    const calls: string[] = []
    server.use(
      http.get('/plt/api/v1/silent-trades', ({ request }) => {
        calls.push(new URL(request.url).pathname)
        return HttpResponse.json([])
      }),
      http.get('/plt/api/v1/trade-plans', ({ request }) => {
        const url = new URL(request.url)
        calls.push(`${url.pathname}?status=${url.searchParams.get('status')}`)
        return HttpResponse.json([])
      }),
    )
    await new HttpPortfolioApi().getOrders()
    // plt's list endpoints take one `status` each, hence two plan calls — and
    // nothing per-plan.
    expect(calls).toEqual([
      '/plt/api/v1/silent-trades',
      '/plt/api/v1/trade-plans?status=VALIDATED',
      '/plt/api/v1/trade-plans?status=REJECTED',
    ])
  })

  it('keeps a session-retained NO_FILL in order history', async () => {
    const api = new HttpPortfolioApi()
    api.retainSessionOutcome({
      id: 'exec-9',
      symbol: 'NVDA',
      side: 'BUY',
      quantity: 1,
      status: 'NO_FILL',
      submittedAt: new Date().toISOString(),
      provenance: 'live',
    })
    server.use(
      http.get('/plt/api/v1/silent-trades', () => HttpResponse.json([])),
      http.get('/plt/api/v1/trade-plans', () => HttpResponse.json([])),
    )
    const orders = await api.getOrders()
    expect(orders.map((o) => o.status)).toEqual(['NO_FILL'])
  })

  it('surfaces a plt failure as an ApiError instead of falling back to mock data', async () => {
    server.use(
      http.get('/plt/api/v1/portfolio', () =>
        HttpResponse.json(
          { type: 'https://stratfolio.local/problems/internal-error', status: 500 },
          { status: 500 },
        ),
      ),
    )
    await expect(new HttpPortfolioApi().getMeta()).rejects.toBeInstanceOf(ApiError)
  })

  describe('operations the backend cannot serve', () => {
    it.each([
      ['getOutlook', () => new HttpPortfolioApi().getOutlook()],
      ['submitOrder', () => new HttpPortfolioApi().submitOrder({} as never)],
      ['addPositionFromIdea', () => new HttpPortfolioApi().addPositionFromIdea()],
    ])('%s refuses rather than simulating', async (_name, call) => {
      const error = (await call().catch((e: unknown) => e)) as ApiError
      expect(error).toBeInstanceOf(ApiError)
      expect(error.status).toBe(501)
      expect(error.problem.gap).toBeTruthy()
    })

    it('never routes anything resembling a live order', () => {
      // The V1 invariant: silent/paper only. There is no code path from this
      // adapter to a brokerage, and `submitOrder` throws before any request.
      const api = new HttpPortfolioApi()
      expect(api.submitOrder({} as never)).rejects.toBeInstanceOf(ApiError)
    })
  })
})
