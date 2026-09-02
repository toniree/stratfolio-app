import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { request } from '@/api/http/client'
import { ApiError } from '@/api/http/problem'
import {
  DECISION_EPISODE_HEADER,
  IDEMPOTENCY_HEADER,
  IDEMPOTENCY_KEY_MAX,
  IdempotencyKeyStore,
  newIdempotencyKey,
} from '@/api/http/idempotency'
import { POLICY_REJECTION_PROBLEM } from '@/test/msw/fixtures/plt'
import { server } from '@/test/msw/server'
import { useMswServer } from '@/test/msw/server'

useMswServer()

describe('http client', () => {
  it('omits empty query params instead of sending them blank', async () => {
    let seen = ''
    server.use(
      http.get('/plt/api/v1/silent-trades', ({ request: req }) => {
        seen = new URL(req.url).search
        return HttpResponse.json([])
      }),
    )
    await request('plt', '/api/v1/silent-trades', {
      query: { status: 'CLOSED', limit: 500, thesis_id: undefined, ticker: '' },
    })
    // plt validates params rather than ignoring them: `limit=` would be a 400.
    expect(seen).toBe('?status=CLOSED&limit=500')
  })

  it('sends the plt idempotency key as a header, never in the body (D6)', async () => {
    let headerValue: string | null = null
    let body: unknown = null
    server.use(
      http.post('/plt/api/v1/trade-plans', async ({ request: req }) => {
        headerValue = req.headers.get(IDEMPOTENCY_HEADER)
        body = await req.json()
        return HttpResponse.json({ id: 'x' }, { status: 201 })
      }),
    )
    await request('plt', '/api/v1/trade-plans', {
      method: 'POST',
      body: { ticker: 'MU' },
      idempotencyKey: 'open-abc',
    })
    expect(headerValue).toBe('open-abc')
    expect(body).toEqual({ ticker: 'MU' })
  })

  it('forwards the decision-episode correlation header when given one', async () => {
    let seen: string | null = null
    server.use(
      http.get('/plt/api/v1/portfolio', ({ request: req }) => {
        seen = req.headers.get(DECISION_EPISODE_HEADER)
        return HttpResponse.json({})
      }),
    )
    await request('plt', '/api/v1/portfolio', {
      decisionEpisodeId: 'e1e2e3e4-1111-4222-8333-444455556666',
    })
    expect(seen).toBe('e1e2e3e4-1111-4222-8333-444455556666')
  })

  it('turns a 422 problem+json into an ApiError carrying the rejection reasons verbatim', async () => {
    server.use(
      http.post('/plt/api/v1/trade-plans', () =>
        HttpResponse.json(POLICY_REJECTION_PROBLEM, {
          status: 422,
          headers: { 'Content-Type': 'application/problem+json' },
        }),
      ),
    )
    const error = await request('plt', '/api/v1/trade-plans', {
      method: 'POST',
      body: {},
    }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    const api = error as ApiError
    expect(api.status).toBe(422)
    expect(api.kind).toBe('policy-rejection')
    expect(api.isRejection).toBe(true)
    // §7.5: codes may repeat, and the UI shows them as sent.
    expect(api.rejectionReasons).toEqual(['DTE_LT_1', 'DTE_LT_1'])
    // A policy refusal is not something a retry can fix.
    expect(api.isRetryable).toBe(false)
    expect(api.message).toBe('Trade plan rejected by policy')
  })

  it('reports a non-JSON error body by status rather than inventing a message', async () => {
    server.use(
      http.get('/plt/api/v1/portfolio', () =>
        HttpResponse.text('<html>502 Bad Gateway</html>', { status: 502 }),
      ),
    )
    const error = (await request('plt', '/api/v1/portfolio').catch((e: unknown) => e)) as ApiError
    expect(error.status).toBe(502)
    expect(error.problem).toEqual({})
    expect(error.isRetryable).toBe(true)
  })

  it('classifies a transport failure as retryable with the same key', async () => {
    server.use(http.get('/plt/api/v1/portfolio', () => HttpResponse.error()))
    const error = (await request('plt', '/api/v1/portfolio').catch((e: unknown) => e)) as ApiError
    expect(error.isNetworkError).toBe(true)
    expect(error.status).toBe(0)
    expect(error.isRetryable).toBe(true)
  })

  it('never falls back to mock data when a live call fails', async () => {
    server.use(http.get('/plt/api/v1/positions', () => HttpResponse.json({ detail: 'x' }, { status: 500 })))
    await expect(request('plt', '/api/v1/positions')).rejects.toBeInstanceOf(ApiError)
  })
})

describe('idempotency keys (D6)', () => {
  it('reuses one key for the same logical operation across retries', () => {
    const store = new IdempotencyKeyStore()
    const first = store.keyFor('open:plan-1', 'open')
    const retry = store.keyFor('open:plan-1', 'open')
    // A timeout retry is the *same* operation: plt/bkt replay the recorded
    // outcome instead of executing twice.
    expect(retry).toBe(first)
  })

  it('mints a new key once the operation is retired after a returned outcome', () => {
    const store = new IdempotencyKeyStore()
    const first = store.keyFor('open:plan-1', 'open')
    // The user saw NO_FILL and pressed "try again" — a new operation.
    store.retireOperation('open:plan-1')
    expect(store.keyFor('open:plan-1', 'open')).not.toBe(first)
  })

  it('keeps keys within plt’s 128-character header limit', () => {
    expect(newIdempotencyKey('open').length).toBeLessThanOrEqual(IDEMPOTENCY_KEY_MAX)
    expect(newIdempotencyKey('x'.repeat(400)).length).toBe(IDEMPOTENCY_KEY_MAX)
  })

  it('gives different logical operations different keys', () => {
    const store = new IdempotencyKeyStore()
    expect(store.keyFor('open:plan-1')).not.toBe(store.keyFor('open:plan-2'))
  })
})
