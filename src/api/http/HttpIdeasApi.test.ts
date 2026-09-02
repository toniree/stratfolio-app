import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { HttpIdeasApi } from '@/api/http/HttpIdeasApi'
import { PLT_LIST_LIMIT_MAX } from '@/api/http/wire/plt'
import { THESIS_FIXTURE } from '@/test/msw/fixtures/plt'
import { server, useMswServer } from '@/test/msw/server'

useMswServer()

describe('HttpIdeasApi', () => {
  it('asks plt for the list cap, because there is no cursor to page with', async () => {
    let limit: string | null = null
    server.use(
      http.get('/plt/api/v1/theses', ({ request }) => {
        limit = new URL(request.url).searchParams.get('limit')
        return HttpResponse.json([THESIS_FIXTURE])
      }),
    )
    await new HttpIdeasApi().getTheses()
    expect(limit).toBe(String(PLT_LIST_LIMIT_MAX))
  })

  it('reads plt’s bare array (not a paged envelope) newest-first', async () => {
    const theses = await new HttpIdeasApi().getTheses()
    expect(theses.map((t) => t.symbol)).toEqual(['COIN', 'NVDA'])
    expect(theses[1].confidence).toBe(0.72)
    expect(theses.every((t) => t.provenance === 'live')).toBe(true)
    // No live source exists for the demo enrichment; it must stay absent.
    expect(theses.every((t) => t.idea === undefined)).toBe(true)
  })

  it('fetches one thesis by id', async () => {
    const thesis = await new HttpIdeasApi().getThesis(THESIS_FIXTURE.id)
    expect(thesis?.symbol).toBe('NVDA')
    expect(thesis?.rationale).toBe(THESIS_FIXTURE.rationale)
  })

  it('treats a 404 as "not found", not as an error banner', async () => {
    const thesis = await new HttpIdeasApi().getThesis('00000000-0000-4000-8000-000000000000')
    expect(thesis).toBeUndefined()
  })

  it('propagates a real failure rather than degrading to an empty feed', async () => {
    server.use(
      http.get('/plt/api/v1/theses', () =>
        HttpResponse.json(
          { type: 'about:blank', title: 'Internal Server Error', status: 500 },
          { status: 500, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )
    await expect(new HttpIdeasApi().getTheses()).rejects.toThrow()
  })
})
