import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { HttpResearchApi } from '@/api/http/HttpResearchApi'
import { ApiError } from '@/api/http/problem'
import {
  BACKTEST_COMPLETED_FIXTURE,
  BACKTEST_FAILED_ID,
  BACKTEST_ID,
  BACKTEST_LEGACY_ID,
  BACKTEST_REJECTED_PROBLEM,
} from '@/test/msw/fixtures/bkt'
import { server, useMswServer } from '@/test/msw/server'

useMswServer()

const INPUT = {
  presetId: 'long-call-delta-band',
  symbols: ['SPY', 'AAPL'],
  start: '2024-01-02',
  end: '2024-06-28',
  initialCapital: 100_000,
}

describe('HttpResearchApi (APP-122)', () => {
  it('cannot list past runs, and says so instead of answering with an empty history', async () => {
    const api = new HttpResearchApi()
    // bkt defines POST and GET-by-id and nothing else, so an empty list is not
    // a claim about how much research has been done.
    expect(api.canListPastRuns).toBe(false)
    expect(await api.getRuns()).toEqual([])
  })

  it('posts the §19 request body and returns the run id from the 202', async () => {
    const bodies: unknown[] = []
    server.use(
      http.post('/bkt/api/v1/backtests', async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json({ id: BACKTEST_ID, status: 'PENDING' }, { status: 202 })
      }),
    )
    const { id } = await new HttpResearchApi().submitRun(INPUT)
    expect(id).toBe(BACKTEST_ID)
    expect(bodies).toHaveLength(1)
    const body = bodies[0] as Record<string, unknown>
    expect(body.symbols).toEqual(['SPY', 'AAPL'])
    expect(body.fill_protocol).toBe('two_quote_band')
    expect((body.params as Record<string, unknown>).initial_capital).toBe('100000')
  })

  it('polls immediately: the 202 is already a finished run (§7.6)', async () => {
    let gets = 0
    server.use(
      http.get('/bkt/api/v1/backtests/:id', () => {
        gets += 1
        return HttpResponse.json(BACKTEST_COMPLETED_FIXTURE)
      }),
    )
    const progress = await new HttpResearchApi().getRun(BACKTEST_ID)
    // One read. A loop that slept first would be waiting for a state change
    // that happened inside the POST.
    expect(gets).toBe(1)
    expect(progress?.status).toBe('done')
    expect(progress?.backendStatus).toBe('COMPLETED')
    expect(progress?.result?.execution?.entriesFilled).toBe(2)
  })

  it('surfaces a FAILED run with bkt’s own reason', async () => {
    const progress = await new HttpResearchApi().getRun(BACKTEST_FAILED_ID)
    expect(progress?.status).toBe('failed')
    expect(progress?.error).toBe('market data unavailable for SPY on 2024-03-05')
    expect(progress?.result).toBeUndefined()
  })

  it('renders a legacy run with its protocol, not as a two-quote run', async () => {
    const progress = await new HttpResearchApi().getRun(BACKTEST_LEGACY_ID)
    expect(progress?.result?.legacy).toBe(true)
    expect(progress?.result?.disclosures.fillProtocol).toBe('single_quote_legacy')
    expect(progress?.result?.bucketsUnavailable).toBe(true)
  })

  it('answers undefined for a run bkt has never heard of', async () => {
    const progress = await new HttpResearchApi().getRun('018f6b1e-0000-7000-8000-0000000000ff')
    expect(progress).toBeUndefined()
  })

  it('surfaces a 422 rejection rather than a run that sits “running” forever', async () => {
    server.use(
      http.post('/bkt/api/v1/backtests', () =>
        HttpResponse.json(BACKTEST_REJECTED_PROBLEM, {
          status: 422,
          headers: { 'Content-Type': 'application/problem+json' },
        }),
      ),
    )
    const error = (await new HttpResearchApi()
      .submitRun(INPUT)
      .catch((e: unknown) => e)) as ApiError
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(422)
    expect(error.rejectionReasons).toEqual(['SYMBOL_DAY_LIMIT_EXCEEDED'])
  })

  it('refuses a preset the library does not define rather than guessing one', async () => {
    await expect(
      new HttpResearchApi().submitRun({ ...INPUT, presetId: 'iron-condor-45' }),
    ).rejects.toThrow(/Unknown backtest preset/)
  })

  it('reports COMPLETED-with-no-body as an error, not as a run with zero trades', async () => {
    server.use(
      http.get('/bkt/api/v1/backtests/:id', () =>
        HttpResponse.json({ id: BACKTEST_ID, status: 'COMPLETED', result: null }),
      ),
    )
    const progress = await new HttpResearchApi().getRun(BACKTEST_ID)
    expect(progress?.result).toBeUndefined()
    expect(progress?.error).toMatch(/no result body/)
  })
})
