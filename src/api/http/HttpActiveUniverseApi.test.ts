import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { HttpActiveUniverseApi } from '@/api/http/HttpActiveUniverseApi'
import { toActiveUniverse, toUniverseEntry } from '@/api/http/adapters/universe'
import { ApiError } from '@/api/http/problem'
import {
  WATCHLIST_CONFLICT_PROBLEM,
  WATCHLIST_FIXTURE,
  WATCHLIST_REJECTION_PROBLEM,
} from '@/test/msw/fixtures/plt'
import { server, useMswServer } from '@/test/msw/server'

useMswServer()

describe('ActiveUniverse adapter', () => {
  const universe = toActiveUniverse(WATCHLIST_FIXTURE)

  it('reads the `protected` wire key onto an unreserved field name', () => {
    // plt annotates the Java field `@JsonProperty("protected")` because it
    // cannot be named `protected`; the wire key really is `protected`.
    expect(universe.entries[0].isProtected).toBe(true)
    expect(universe.entries[0].protectionReasons).toEqual(['OPEN_POSITION'])
  })

  it('leaves an unscored symbol without a priority score, not at zero', () => {
    const spy = universe.entries.find((e) => e.symbol === 'SPY')
    // A default-pinned ETF the engine has not evaluated has no score.
    // Rendering 0 would read as "ranked lowest", a different claim.
    expect(spy?.priorityScore).toBeUndefined()
    expect(universe.entries[0].priorityScore).toBe(0.81)
  })

  it('carries the capacity block from the list response', () => {
    expect(universe.capacity).toEqual({
      activeCount: 2,
      max: 125,
      availableSlots: 123,
      protectedCount: 2,
      unresolvedCount: 1,
    })
  })

  it('preserves the exclusion and validation states that gate the AI', () => {
    const arkk = universe.entries.find((e) => e.symbol === 'ARKK')
    expect(arkk?.status).toBe('USER_EXCLUDED')
    // A symbol that sits in the universe and can never produce a plan.
    expect(arkk?.validationStatus).toBe('UNRESOLVABLE')
  })

  it('defaults absent protection reasons to an empty list, not undefined', () => {
    const entry = toUniverseEntry({
      symbol: 'AMD',
      instrument_type: 'EQUITY',
      kind: 'AI_SELECTED',
      status: 'ACTIVE',
      protected: false,
      has_open_trade: false,
      position_protected: false,
      validation_status: 'UNVALIDATED',
    })
    expect(entry.protectionReasons).toEqual([])
    expect(entry.addedAt).toBeUndefined()
  })
})

describe('HttpActiveUniverseApi', () => {
  it('fetches the universe in a single call — the list carries capacity', async () => {
    const calls: string[] = []
    server.use(
      http.get('/plt/api/v1/watchlist', ({ request }) => {
        calls.push(new URL(request.url).pathname)
        return HttpResponse.json(WATCHLIST_FIXTURE)
      }),
    )
    const universe = await new HttpActiveUniverseApi().getUniverse()
    expect(calls).toEqual(['/plt/api/v1/watchlist'])
    expect(universe.provenance).toBe('live')
    expect(universe.entries).toHaveLength(3)
  })

  it('sends `pinned` only for a USER add — plt ignores it for other sources', async () => {
    const bodies: unknown[] = []
    server.use(
      http.post('/plt/api/v1/watchlist/:symbol', async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json(WATCHLIST_FIXTURE.entries[1], { status: 201 })
      }),
    )
    const api = new HttpActiveUniverseApi()
    await api.addSymbol('amd', { source: 'USER', pinned: true, reason: 'watching' })
    await api.addSymbol('amd', { source: 'AI', pinned: true })
    expect(bodies[0]).toEqual({ source: 'USER', pinned: true, reason: 'watching' })
    // `pinned` dropped: sending it would misrepresent what was asked for.
    expect(bodies[1]).toEqual({ source: 'AI' })
  })

  it('upper-cases and URL-encodes the symbol path segment', async () => {
    let path = ''
    server.use(
      http.post('/plt/api/v1/watchlist/:symbol', ({ request }) => {
        path = new URL(request.url).pathname
        return HttpResponse.json(WATCHLIST_FIXTURE.entries[1], { status: 201 })
      }),
    )
    await new HttpActiveUniverseApi().addSymbol('  amd ', { source: 'USER' })
    expect(path).toBe('/plt/api/v1/watchlist/AMD')
  })

  it('expresses pin and restore as PATCH bodies', async () => {
    const bodies: unknown[] = []
    server.use(
      http.patch('/plt/api/v1/watchlist/:symbol', async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json(WATCHLIST_FIXTURE.entries[0])
      }),
    )
    const api = new HttpActiveUniverseApi()
    await api.setPinned('MU', true)
    await api.restoreSymbol('ARKK')
    expect(bodies).toEqual([{ pinned: true }, { restore: true }])
  })

  it('excludes via DELETE with the reason as a query param, and no body', async () => {
    let seen: { reason: string | null; hasBody: boolean } | null = null
    server.use(
      http.delete('/plt/api/v1/watchlist/:symbol', async ({ request }) => {
        seen = {
          reason: new URL(request.url).searchParams.get('reason'),
          hasBody: (await request.text()).length > 0,
        }
        return HttpResponse.json({ ...WATCHLIST_FIXTURE.entries[0], status: 'USER_EXCLUDED' })
      }),
    )
    const entry = await new HttpActiveUniverseApi().excludeSymbol('MU', 'no longer tracking')
    expect(seen).toEqual({ reason: 'no longer tracking', hasBody: false })
    // Soft-exclude: plt returns the surviving entry rather than deleting it.
    expect(entry.status).toBe('USER_EXCLUDED')
  })

  it('surfaces an at-capacity refusal instead of pretending the add worked', async () => {
    server.use(
      http.post('/plt/api/v1/watchlist/:symbol', () =>
        HttpResponse.json(WATCHLIST_CONFLICT_PROBLEM, {
          status: 409,
          headers: { 'Content-Type': 'application/problem+json' },
        }),
      ),
    )
    const error = (await new HttpActiveUniverseApi()
      .addSymbol('AMD', { source: 'USER' })
      .catch((e: unknown) => e)) as ApiError
    expect(error).toBeInstanceOf(ApiError)
    expect(error.isConflict).toBe(true)
    expect(error.problem.errors?.[0]?.code).toBe('AT_CAPACITY_NO_EVICTABLE_SLOT')
  })

  it('surfaces the sticky-exclusion refusal so a re-add cannot undo it silently', async () => {
    server.use(
      http.post('/plt/api/v1/watchlist/:symbol', () =>
        HttpResponse.json(WATCHLIST_REJECTION_PROBLEM, {
          status: 422,
          headers: { 'Content-Type': 'application/problem+json' },
        }),
      ),
    )
    const error = (await new HttpActiveUniverseApi()
      .addSymbol('ARKK', { source: 'AI' })
      .catch((e: unknown) => e)) as ApiError
    expect(error.rejectionReasons).toEqual(['USER_EXCLUDED_REQUIRES_RESTORE'])
  })
})
