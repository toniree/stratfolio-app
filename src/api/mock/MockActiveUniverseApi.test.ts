import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { MockActiveUniverseApi } from '@/api/mock/MockActiveUniverseApi'

const ROOT = join(import.meta.dirname, '..', '..')

describe('MockActiveUniverseApi', () => {
  let api: MockActiveUniverseApi

  beforeEach(() => {
    api = new MockActiveUniverseApi()
  })

  it('mirrors plt’s sticky exclusion rather than allowing a silent re-add', async () => {
    // ARKK ships excluded. plt answers a plain add with 422
    // USER_EXCLUDED_REQUIRES_RESTORE so an AI promotion cannot undo a user's
    // decision; the mock must teach the same rule.
    await expect(api.addSymbol('ARKK', { source: 'AI' })).rejects.toThrow(/restore/i)
    const restored = await api.restoreSymbol('ARKK')
    expect(restored.status).toBe('ACTIVE')
  })

  it('reports capacity that moves with membership', async () => {
    const before = await api.getUniverse()
    await api.addSymbol('AMD', { source: 'USER', pinned: true })
    const after = await api.getUniverse()
    expect(after.capacity.activeCount).toBe(before.capacity.activeCount + 1)
    expect(after.capacity.availableSlots).toBe(before.capacity.availableSlots - 1)
  })

  it('excludes softly — the entry survives with its reason recorded', async () => {
    const entry = await api.excludeSymbol('NVDA', 'thesis invalidated')
    expect(entry.status).toBe('USER_EXCLUDED')
    expect(entry.reason).toBe('thesis invalidated')
    const universe = await api.getUniverse()
    expect(universe.entries.some((e) => e.symbol === 'NVDA')).toBe(true)
  })

  it('marks a new symbol unvalidated rather than assuming it resolves', async () => {
    const created = await api.addSymbol('ZZZZ', { source: 'USER', pinned: true })
    expect(created.validationStatus).toBe('UNVALIDATED')
    // And no invented priority score — nothing has evaluated it.
    expect(created.priorityScore).toBeUndefined()
  })

  it('tags everything it returns as mock data', async () => {
    const universe = await api.getUniverse()
    expect(universe.provenance).toBe('mock')
    expect(universe.entries.every((e) => e.provenance === 'mock')).toBe(true)
  })
})

/**
 * The §3.8 separation, asserted structurally.
 *
 * The terminal tape and the ActiveUniverse were conflated in the original
 * plan. They are different products: adding a ticker to the tape is a viewing
 * choice; adding one to the universe changes what the decision engine works
 * on. If `Watchlist.tsx` ever reaches for the universe API, a casual add would
 * silently enrol a symbol in the AI's universe — and plt's ~125-symbol
 * default-pinned universe would flood a cosmetic rail.
 */
describe('terminal tape stays local (§3.8)', () => {
  it('Watchlist.tsx never touches the ActiveUniverse API or plt', () => {
    const source = readFileSync(join(ROOT, 'components/terminal/Watchlist.tsx'), 'utf8')
    expect(source).not.toMatch(/activeUniverseApi/)
    expect(source).not.toMatch(/ActiveUniverse/)
    expect(source).not.toMatch(/watchlist\/|api\/v1/)
    expect(source).not.toMatch(/useAddUniverseSymbol|useExcludeUniverseSymbol/)
  })

  it('the terminal store holds only local state', () => {
    const source = readFileSync(join(ROOT, 'store/terminalStore.ts'), 'utf8')
    expect(source).not.toMatch(/@\/api\/http/)
    expect(source).not.toMatch(/activeUniverseApi/)
  })
})
