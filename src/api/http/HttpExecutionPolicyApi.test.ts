import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { HttpExecutionPolicyApi } from '@/api/http/HttpExecutionPolicyApi'
import { POLICY_KEY } from '@/api/http/adapters/executionPolicy'
import { ApiError } from '@/api/http/problem'
import { CONFIG_ENTRIES_FIXTURE, CONFIG_VALUE_INVALID_PROBLEM } from '@/test/msw/fixtures/plt'
import { server, useMswServer } from '@/test/msw/server'

useMswServer()

describe('HttpExecutionPolicyApi', () => {
  it('reads the policy from the config list', async () => {
    const policy = await new HttpExecutionPolicyApi().getPolicy()
    expect(policy.aiTradingEnabled).toBe(true)
    expect(policy.approvalMode).toBe('approve')
    expect(policy.tradingWindow).toBe('rth')
  })

  it('writes one key at a time, as a typed JSON value', async () => {
    const puts: { path: string; body: unknown }[] = []
    server.use(
      http.put('/plt/api/v1/config/:key', async ({ params, request }) => {
        const body = (await request.json()) as Record<string, unknown>
        puts.push({ path: String(params.key), body })
        return HttpResponse.json({ key: String(params.key), value: body.value })
      }),
    )
    const api = new HttpExecutionPolicyApi()
    await api.setAiTradingEnabled(false)
    await api.setApprovalMode('approve')
    await api.setTradingWindow('extended')

    expect(puts.map((p) => p.path)).toEqual([
      POLICY_KEY.aiTradingEnabled,
      POLICY_KEY.approvalMode,
      POLICY_KEY.tradingWindow,
    ])
    // A real boolean: plt's validation refuses anything else, and its resolver
    // reads a stored string as unparseable and therefore disabled.
    expect(puts[0].body).toEqual({ value: false })
    // `approve` is `approve_each` on the wire.
    expect(puts[1].body).toEqual({ value: 'approve_each' })
    expect(puts[2].body).toEqual({ value: 'extended' })
  })

  it('surfaces plt’s 422 so the optimistic update can roll back', async () => {
    server.use(
      http.put('/plt/api/v1/config/:key', () =>
        HttpResponse.json(CONFIG_VALUE_INVALID_PROBLEM, {
          status: 422,
          headers: { 'Content-Type': 'application/problem+json' },
        }),
      ),
    )
    const error = (await new HttpExecutionPolicyApi()
      .setTradingWindow('rth')
      .catch((e: unknown) => e)) as ApiError
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(422)
    expect(error.rejectionReasons).toEqual(['CONFIG_VALUE_INVALID'])
    expect(error.problem.config_key).toBe(POLICY_KEY.tradingWindow)
  })

  it('never writes on read: opening the settings screen changes nothing', async () => {
    let writes = 0
    server.use(
      http.put('/plt/api/v1/config/:key', () => {
        writes += 1
        return HttpResponse.json({})
      }),
      http.get('/plt/api/v1/config', () => HttpResponse.json(CONFIG_ENTRIES_FIXTURE)),
    )
    await new HttpExecutionPolicyApi().getPolicy()
    // Pushing this browser's remembered preferences into plt on open would
    // overwrite an operator's server-side choice.
    expect(writes).toBe(0)
  })
})
