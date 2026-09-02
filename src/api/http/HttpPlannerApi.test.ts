import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { HttpPlannerApi } from '@/api/http/HttpPlannerApi'
import { ApiError } from '@/api/http/problem'
import {
  TRADE_PLAN_VALIDATED_FIXTURE,
  POLICY_REJECTION_PROBLEM,
} from '@/test/msw/fixtures/plt'
import { server, useMswServer } from '@/test/msw/server'
import type { CreatePlannerIdeaInput } from '@/api/newsTypes'

useMswServer()

const INPUT: CreatePlannerIdeaInput = {
  symbol: 'NVDA',
  direction: 'LONG',
  title: 'user plan',
  notes: 'watching the print',
  entryLow: 15,
  entryHigh: 16.5,
  targetLow: 0,
  targetHigh: 0,
  stop: 0,
  horizon: '',
  quantity: 4,
  contract: {
    occSymbol: 'NVDA261218C00190000',
    right: 'CALL',
    strike: 190,
    expiry: '2026-12-18',
    dte: 109,
    mid: 15.8,
  },
}

describe('HttpPlannerApi', () => {
  it('joins theses with one list request, not one per plan', async () => {
    let thesisCalls = 0
    server.use(
      http.get('/plt/api/v1/theses', () => {
        thesisCalls += 1
        return HttpResponse.json([])
      }),
    )
    const plans = await new HttpPlannerApi().getIdeas()
    expect(plans.length).toBeGreaterThan(1)
    // The N+1 the plan rules out: a by-id fetch per plan.
    expect(thesisCalls).toBe(1)
  })

  it('maps the full status enum off the live list', async () => {
    const plans = await new HttpPlannerApi().getIdeas()
    expect(new Set(plans.map((p) => p.status))).toEqual(
      new Set(['rejected', 'validated', 'executed']),
    )
    expect(plans.every((p) => p.provenance === 'live')).toBe(true)
  })

  it('creates a plan through the real endpoint with pinned policy inputs', async () => {
    let body: Record<string, unknown> = {}
    let header: string | null = null
    server.use(
      http.post('/plt/api/v1/trade-plans', async ({ request }) => {
        header = request.headers.get('Idempotency-Key')
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(TRADE_PLAN_VALIDATED_FIXTURE, { status: 201 })
      }),
    )
    const plan = await new HttpPlannerApi().createIdea(INPUT)
    expect(header).toBeTruthy()
    expect(body.execution_mode).toBe('SILENT')
    expect(body.risk_profile).toBe('HIGH_REWARD_HIGH_RISK')
    expect(body.strike).toBe(190)
    expect(plan.status).toBe('validated')
  })

  it('surfaces a PolicyGate refusal rather than saving a local plan instead', async () => {
    server.use(
      http.post('/plt/api/v1/trade-plans', () =>
        HttpResponse.json(POLICY_REJECTION_PROBLEM, {
          status: 422,
          headers: { 'Content-Type': 'application/problem+json' },
        }),
      ),
    )
    const error = (await new HttpPlannerApi()
      .createIdea(INPUT)
      .catch((e: unknown) => e)) as ApiError
    expect(error).toBeInstanceOf(ApiError)
    expect(error.rejectionReasons).toEqual(['DTE_LT_1', 'DTE_LT_1'])
  })

  it('refuses to create a plan with no contract to validate', async () => {
    const error = (await new HttpPlannerApi()
      .createIdea({ ...INPUT, contract: undefined })
      .catch((e: unknown) => e)) as ApiError
    expect(error.status).toBe(501)
  })

  it.each([
    ['updateIdea', () => new HttpPlannerApi().updateIdea('id', {})],
    ['deleteIdea', () => new HttpPlannerApi().deleteIdea('id')],
  ])('%s refuses rather than faking a plan plt does not have', async (_name, call) => {
    const error = (await call().catch((e: unknown) => e)) as ApiError
    expect(error.status).toBe(501)
    expect(error.problem.gap).toBe('HKP-PLT-4')
  })
})
