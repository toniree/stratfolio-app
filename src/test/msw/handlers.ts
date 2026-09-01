import { HttpResponse, http } from 'msw'
import {
  ACTIVITY_FIXTURE,
  EXECUTION_FILLED_FIXTURE,
  EXIT_FILLED_FIXTURE,
  PORTFOLIO_FIXTURE,
  POSITIONS_FIXTURE,
  SILENT_TRADES_FIXTURE,
  THESES_FIXTURE,
  TRADE_PLANS_FIXTURE,
  TRADE_PLAN_VALIDATED_FIXTURE,
  WATCHLIST_CAPACITY_FIXTURE,
  WATCHLIST_FIXTURE,
} from '@/test/msw/fixtures/plt'

/**
 * Default happy-path handlers for the plt routes Wave A consumes.
 *
 * They mirror plt's real query contract — `status` filtering, the `limit`
 * cap, newest-first ordering — because an adapter that only ever sees an
 * unfiltered list will happily ship a bug where it forgets to ask for
 * `status=CLOSED` and silently charts open trades.
 *
 * Individual tests override these with `server.use(...)` for error and edge
 * cases rather than mutating the defaults.
 */

const PLT = '/plt/api/v1'
const BKT = '/bkt/api/v1'

function problem(status: number, body: Record<string, unknown>) {
  return HttpResponse.json(body, {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  })
}

export const pltHandlers = [
  http.get(`${PLT}/portfolio`, () => HttpResponse.json(PORTFOLIO_FIXTURE)),

  http.get(`${PLT}/positions`, ({ request }) => {
    const status = new URL(request.url).searchParams.get('status')
    const rows = status ? POSITIONS_FIXTURE.filter((p) => p.status === status) : POSITIONS_FIXTURE
    return HttpResponse.json(rows)
  }),

  http.get(`${PLT}/silent-trades`, ({ request }) => {
    const params = new URL(request.url).searchParams
    const status = params.get('status')
    const limit = Number(params.get('limit') ?? 100)
    if (!Number.isFinite(limit) || limit < 1 || limit > 500) {
      return problem(400, {
        type: 'https://stratfolio.local/problems/validation-error',
        title: 'Validation error',
        status: 400,
        errors: [{ code: 'PARAMETER_INVALID', field: 'limit', message: 'must be between 1 and 500' }],
      })
    }
    const rows = status ? SILENT_TRADES_FIXTURE.filter((t) => t.status === status) : SILENT_TRADES_FIXTURE
    return HttpResponse.json(rows.slice(0, limit))
  }),

  http.get(`${PLT}/trade-plans`, ({ request }) => {
    const status = new URL(request.url).searchParams.get('status')
    const rows = status ? TRADE_PLANS_FIXTURE.filter((p) => p.status === status) : TRADE_PLANS_FIXTURE
    return HttpResponse.json(rows)
  }),

  http.get(`${PLT}/theses`, ({ request }) => {
    const params = new URL(request.url).searchParams
    const ticker = params.get('ticker')
    const limit = Number(params.get('limit') ?? 50)
    const rows = ticker
      ? THESES_FIXTURE.filter((t) => t.ticker.toUpperCase() === ticker.toUpperCase())
      : THESES_FIXTURE
    return HttpResponse.json(rows.slice(0, limit))
  }),

  http.get(`${PLT}/theses/:id`, ({ params }) => {
    const row = THESES_FIXTURE.find((t) => t.id === params.id)
    return row
      ? HttpResponse.json(row)
      : problem(404, {
          type: 'https://stratfolio.local/problems/not-found',
          title: 'Not found',
          status: 404,
          detail: `No thesis ${String(params.id)}`,
        })
  }),

  http.get(`${PLT}/activity`, ({ request }) => {
    const limit = Number(new URL(request.url).searchParams.get('limit') ?? 100)
    return HttpResponse.json(ACTIVITY_FIXTURE.slice(0, limit))
  }),

  http.get(`${PLT}/watchlist`, () => HttpResponse.json(WATCHLIST_FIXTURE)),
  http.get(`${PLT}/watchlist/capacity`, () => HttpResponse.json(WATCHLIST_CAPACITY_FIXTURE)),

  http.post(`${PLT}/watchlist/:symbol`, async ({ params }) => {
    const entry = WATCHLIST_FIXTURE.entries.find((e) => e.symbol === params.symbol)
    return HttpResponse.json(
      entry ?? { ...WATCHLIST_FIXTURE.entries[1], symbol: String(params.symbol) },
      { status: entry ? 200 : 201 },
    )
  }),

  http.patch(`${PLT}/watchlist/:symbol`, async ({ params, request }) => {
    const body = (await request.json().catch(() => null)) as
      | { pinned?: boolean; restore?: boolean }
      | null
    const entry =
      WATCHLIST_FIXTURE.entries.find((e) => e.symbol === params.symbol) ??
      WATCHLIST_FIXTURE.entries[1]
    return HttpResponse.json({
      ...entry,
      symbol: String(params.symbol),
      kind: body?.pinned ? 'USER_PINNED' : entry.kind,
      status: body?.restore ? 'ACTIVE' : entry.status,
    })
  }),

  http.delete(`${PLT}/watchlist/:symbol`, ({ params }) => {
    const entry =
      WATCHLIST_FIXTURE.entries.find((e) => e.symbol === params.symbol) ??
      WATCHLIST_FIXTURE.entries[1]
    return HttpResponse.json({ ...entry, symbol: String(params.symbol), status: 'USER_EXCLUDED' })
  }),
]

/**
 * The write path (APP-112): plt validates a plan, bkt executes it.
 *
 * The defaults are the happy path — a VALIDATED plan and a FILLED execution.
 * Rejections, NO_FILLs and platform errors are per-test `server.use(...)`
 * overrides, because each of them is a *different* assertion about how the
 * ticket must render, not a variation on one.
 */
export const bktHandlers = [
  http.post(`${PLT}/trade-plans`, () =>
    HttpResponse.json(TRADE_PLAN_VALIDATED_FIXTURE, { status: 201 }),
  ),

  http.post(`${BKT}/executions`, () =>
    HttpResponse.json(EXECUTION_FILLED_FIXTURE, { status: 201 }),
  ),

  // The user's own exit (APP-114, §17). The default is a fill; NO_FILL, the
  // 200 replay and the 404/409/503 refusals are per-test overrides for the
  // same reason as above — each is a different assertion, not a variation.
  http.post(`${BKT}/executions/exits`, () =>
    HttpResponse.json(EXIT_FILLED_FIXTURE, { status: 201 }),
  ),
]

export const handlers = [...pltHandlers, ...bktHandlers]

export { problem as problemResponse }
