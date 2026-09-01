import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { HttpPortfolioApi } from '@/api/http/HttpPortfolioApi'
import { ApiError } from '@/api/http/problem'
import { PLT_LIST_LIMIT_MAX } from '@/api/http/wire/plt'
import {
  EXECUTION_FILLED_FIXTURE,
  EXECUTION_NO_FILL_FIXTURE,
  EXECUTION_PLATFORM_ERROR_FIXTURE,
  EXIT_FILLED_FIXTURE,
  EXIT_NO_FILL_FIXTURE,
  POLICY_REJECTION_PROBLEM,
  SILENT_TRADE_CLOSED_FIXTURE,
  TRADE_PLAN_VALIDATED_FIXTURE,
} from '@/test/msw/fixtures/plt'
import type { ExitRequest, OrderRequest } from '@/api/types'
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

/* ------------------------------------------------- the open path (APP-112) -- */

const OPEN: OrderRequest = {
  symbol: 'nvda',
  side: 'BUY',
  intent: 'open',
  quantity: 4,
  estimatedPrice: 15.8,
  contract: {
    occSymbol: 'NVDA261218C00190000',
    right: 'CALL',
    strike: 190,
    expiry: '2026-12-18',
    dte: 109,
    mid: 15.8,
    underlyingPrice: 178.4,
  },
  idempotencyKey: 'open-fixed-key',
}

describe('HttpPortfolioApi.submitOrder — open', () => {
  it('posts a plan then an execution, with the key in the right place each time', async () => {
    let planHeader: string | null = null
    let planBody: Record<string, unknown> = {}
    let execBody: Record<string, unknown> = {}
    server.use(
      http.post('/plt/api/v1/trade-plans', async ({ request }) => {
        planHeader = request.headers.get('Idempotency-Key')
        planBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(TRADE_PLAN_VALIDATED_FIXTURE, { status: 201 })
      }),
      http.post('/bkt/api/v1/executions', async ({ request }) => {
        execBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(EXECUTION_FILLED_FIXTURE, { status: 201 })
      }),
    )

    const order = await new HttpPortfolioApi().submitOrder(OPEN)

    // plt takes a header, bkt takes a body field (§7.7). Getting this backwards
    // means neither service dedupes and a retry opens two positions.
    expect(planHeader).toBe('open-fixed-key')
    expect(execBody.idempotency_key).toBe('open-fixed-key')
    expect(execBody.trade_plan_id).toBe(TRADE_PLAN_VALIDATED_FIXTURE.id)
    // bkt reads the plan from plt; sending one inline is a 422.
    expect(execBody).not.toHaveProperty('trade_plan')
    // D11: pinned, never derived from the request.
    expect(planBody.execution_mode).toBe('SILENT')
    expect(planBody.risk_profile).toBe('HIGH_REWARD_HIGH_RISK')
    expect(planBody.side).toBe('LONG')
    expect(order.status).toBe('FILLED')
    expect(order.price).toBe(15.8)
  })

  it('returns a NO_FILL as an outcome and retains it for the session', async () => {
    server.use(
      http.post('/bkt/api/v1/executions', () =>
        HttpResponse.json(EXECUTION_NO_FILL_FIXTURE, { status: 201 }),
      ),
    )
    const api = new HttpPortfolioApi()
    const order = await api.submitOrder(OPEN)

    // A 201 that opened nothing is a success, not an error and not "pending".
    expect(order.status).toBe('NO_FILL')
    expect(order.sessionOnly).toBe(true)

    // …and it appears in order history even though no silent-trade row exists.
    const history = await api.getOrders()
    expect(history.some((o) => o.id === EXECUTION_NO_FILL_FIXTURE.execution_id)).toBe(true)
  })

  it('turns plt’s 422 into a REJECTED outcome carrying the reasons verbatim', async () => {
    server.use(
      http.post('/plt/api/v1/trade-plans', () =>
        HttpResponse.json(POLICY_REJECTION_PROBLEM, {
          status: 422,
          headers: { 'Content-Type': 'application/problem+json' },
        }),
      ),
    )
    const order = await new HttpPortfolioApi().submitOrder(OPEN)
    expect(order.status).toBe('REJECTED')
    expect(order.rejectionReasons).toEqual(['DTE_LT_1', 'DTE_LT_1'])
    expect(order.tradePlanId).toBe(POLICY_REJECTION_PROBLEM.trade_plan_id)
  })

  it('surfaces a fill plt never heard about as a recoverable, session-only row', async () => {
    server.use(
      http.post('/bkt/api/v1/executions', () =>
        HttpResponse.json(EXECUTION_PLATFORM_ERROR_FIXTURE, { status: 201 }),
      ),
    )
    const order = await new HttpPortfolioApi().submitOrder(OPEN)
    expect(order.status).toBe('FILLED')
    expect(order.reportedToPlatform).toBe(false)
    expect(order.platformError).toContain('platform unreachable')
    expect(order.sessionOnly).toBe(true)
  })

  it('throws — rather than inventing an outcome — when the execution call fails', async () => {
    server.use(
      http.post('/bkt/api/v1/executions', () =>
        HttpResponse.json({ title: 'Bad gateway', status: 502 }, { status: 502 }),
      ),
    )
    // The plan is durable and the execution's fate is unknown: the caller must
    // retry the *same* operation under the same key, not mint a new one (D6).
    await expect(new HttpPortfolioApi().submitOrder(OPEN)).rejects.toBeInstanceOf(ApiError)
  })

  it('refuses to close *as an order*: a close is requestExit, not a plan', async () => {
    const api = new HttpPortfolioApi()
    for (const request of [
      { ...OPEN, intent: 'close' as const },
      { ...OPEN, side: 'SELL' as const },
    ]) {
      const error = (await api.submitOrder(request).catch((e: unknown) => e)) as ApiError
      expect(error).toBeInstanceOf(ApiError)
      expect(error.status).toBe(501)
      expect(error.problem.gap).toBe('APP-114')
    }
  })

  it('refuses to open without chain-selected contract identity', async () => {
    const error = (await new HttpPortfolioApi()
      .submitOrder({ ...OPEN, contract: undefined })
      .catch((e: unknown) => e)) as ApiError
    expect(error.status).toBe(501)
  })
})

/* ------------------------------------------------ the exit path (APP-114) -- */

const EXIT: ExitRequest = {
  positionId: '8b7a6c5d-4e3f-4a2b-9c8d-7e6f5a4b3c2d',
  silentTradeId: 'aa11bb22-cc33-4d44-8e55-ff66aa77bb88',
  symbol: 'mu',
  quantity: 3,
  idempotencyKey: 'exit-fixed-key',
}

describe('HttpPortfolioApi.requestExit', () => {
  it('sends the whole body and nothing else — extra fields are a 422 (§17)', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.post('/bkt/api/v1/executions/exits', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(EXIT_FILLED_FIXTURE, { status: 201 })
      }),
    )
    await new HttpPortfolioApi().requestExit(EXIT)
    // Two keys, exactly. No exit_price, no exit_reason, no quantity, no side:
    // bkt's ExitRequest is `extra="forbid"` and would refuse the request.
    expect(Object.keys(body).sort()).toEqual(['idempotency_key', 'silent_trade_id'])
    expect(body.silent_trade_id).toBe(EXIT.silentTradeId)
    // bkt takes idempotency in the *body*; plt takes a header (§7.7).
    expect(body.idempotency_key).toBe('exit-fixed-key')
  })

  it('renders a fill at the model’s price, not at any price the app supplied', async () => {
    const order = await new HttpPortfolioApi().requestExit(EXIT)
    expect(order.status).toBe('FILLED')
    expect(order.side).toBe('SELL')
    // 18.45 is the fill model's number off the close-time quote. Nothing in
    // the request could have influenced it.
    expect(order.price).toBe(18.45)
    expect(order.estimatedValue).toBe(5535)
    expect(order.exitReason).toBe('USER_CLOSE')
    expect(order.replayed).toBe(false)
    // plt was told, so the close is in the system of record.
    expect(order.sessionOnly).toBe(false)
  })

  it('treats NO_FILL as a successful outcome that left the position open', async () => {
    server.use(
      http.post('/bkt/api/v1/executions/exits', () =>
        HttpResponse.json(EXIT_NO_FILL_FIXTURE, { status: 201 }),
      ),
    )
    const order = await new HttpPortfolioApi().requestExit(EXIT)
    expect(order.status).toBe('NO_FILL')
    // No fill, so no price and no proceeds — never a zero, never the mark.
    expect(order.price).toBeUndefined()
    expect(order.estimatedValue).toBeUndefined()
    expect(order.reasonCode).toBe('SPIKE_NO_FILL')
    // The quantity still describes what the attempt was for.
    expect(order.quantity).toBe(3)
  })

  it('reads the 200 replay from the status, because the body’s flag stays false', async () => {
    server.use(
      // Exactly what bkt sends on a replay: `outcome_from_record(record)`
      // leaves `replayed: false` in the body, and only the code says 200.
      http.post('/bkt/api/v1/executions/exits', () =>
        HttpResponse.json({ ...EXIT_FILLED_FIXTURE, replayed: false }, { status: 200 }),
      ),
    )
    const order = await new HttpPortfolioApi().requestExit(EXIT)
    expect(order.replayed).toBe(true)
    expect(order.status).toBe('FILLED')
  })

  it.each([
    [404, 'silent-trade-not-found'],
    [409, 'silent-trade-not-open'],
    [503, 'market-data-unavailable'],
  ])('surfaces a %s as a typed ApiError rather than an outcome', async (status, slug) => {
    server.use(
      http.post('/bkt/api/v1/executions/exits', () =>
        HttpResponse.json(
          { type: `https://stratfolio.local/problems/${slug}`, status, title: slug },
          { status, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )
    const error = (await new HttpPortfolioApi()
      .requestExit(EXIT)
      .catch((e: unknown) => e)) as ApiError
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(status)
    expect(error.kind).toBe(slug)
  })

  it('keeps an unreported close in session history, since plt never heard it', async () => {
    const api = new HttpPortfolioApi()
    server.use(
      http.post('/bkt/api/v1/executions/exits', () =>
        HttpResponse.json(
          {
            ...EXIT_FILLED_FIXTURE,
            reported_to_platform: false,
            platform_error: 'platform unreachable: connection refused',
          },
          { status: 201 },
        ),
      ),
      http.get('/plt/api/v1/silent-trades', () => HttpResponse.json([])),
      http.get('/plt/api/v1/trade-plans', () => HttpResponse.json([])),
    )
    const order = await api.requestExit(EXIT)
    expect(order.sessionOnly).toBe(true)
    const history = await api.getOrders()
    expect(history.some((o) => o.id === EXIT_FILLED_FIXTURE.execution_id)).toBe(true)
  })

  it('refuses a position with no silent trade instead of inventing an id', async () => {
    const error = (await new HttpPortfolioApi()
      .requestExit({ ...EXIT, silentTradeId: undefined })
      .catch((e: unknown) => e)) as ApiError
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(501)
  })
})
