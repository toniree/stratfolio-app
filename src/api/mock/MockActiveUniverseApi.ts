import type { ActiveUniverse, UniverseEntry } from '@/api/types'
import type { ActiveUniverseApi, AddUniverseSymbolInput } from '@/api/portfolioApi'
import { latency } from '@/api/mock/latency'

/**
 * In-memory ActiveUniverse for demo mode.
 *
 * Mirrors plt's real semantics rather than a simpler local list, because the
 * point of this surface is that its rules are not cosmetic: exclusion is
 * sticky and needs an explicit restore, capacity is finite and refuses adds,
 * and protected entries cannot be evicted. A mock that let you freely add and
 * remove would teach the wrong mental model and hide the exact failure modes
 * live mode has to render.
 */

const MAX_ACTIVE = 125

function entry(partial: Partial<UniverseEntry> & { symbol: string }): UniverseEntry {
  return {
    instrumentType: 'EQUITY',
    kind: 'AI_SELECTED',
    status: 'ACTIVE',
    isProtected: false,
    protectionReasons: [],
    hasOpenTrade: false,
    positionProtected: false,
    validationStatus: 'VALID',
    provenance: 'mock',
    ...partial,
  }
}

const SEED: UniverseEntry[] = [
  entry({
    symbol: 'MU',
    kind: 'AI_SELECTED',
    priorityScore: 0.81,
    isProtected: true,
    protectionReasons: ['OPEN_POSITION'],
    hasOpenTrade: true,
    positionProtected: true,
    addedAt: '2026-08-01T12:00:00Z',
    lastPromotedAt: '2026-08-24T13:00:00Z',
    lastEvaluatedAt: '2026-08-31T12:00:00Z',
    reason: 'Momentum + earnings catalyst',
  }),
  entry({
    symbol: 'NVDA',
    kind: 'AI_SELECTED',
    priorityScore: 0.77,
    addedAt: '2026-08-12T09:30:00Z',
    lastEvaluatedAt: '2026-08-31T12:00:00Z',
    reason: 'Elevated call skew into the print',
  }),
  entry({
    symbol: 'SPY',
    instrumentType: 'ETF',
    kind: 'DEFAULT_PINNED',
    isProtected: true,
    protectionReasons: ['DEFAULT_PINNED'],
    addedAt: '2026-01-01T00:00:00Z',
  }),
  entry({
    symbol: 'WMT',
    kind: 'EVENT_PROMOTED',
    priorityScore: 0.64,
    addedAt: '2026-08-18T14:00:00Z',
    lastPromotedAt: '2026-08-18T14:00:00Z',
    reason: 'Earnings within 30 days',
  }),
  entry({
    symbol: 'ARKK',
    instrumentType: 'ETF',
    kind: 'USER_PINNED',
    status: 'USER_EXCLUDED',
    addedAt: '2026-05-04T00:00:00Z',
    lastEvictedAt: '2026-08-22T11:02:00Z',
    reason: 'Not tracking this any more',
    // The interesting case: a symbol that can never produce a plan.
    validationStatus: 'UNRESOLVABLE',
  }),
]

export class MockActiveUniverseApi implements ActiveUniverseApi {
  private entries: UniverseEntry[] = SEED.map((e) => ({ ...e }))

  private find(symbol: string): UniverseEntry | undefined {
    return this.entries.find((e) => e.symbol === symbol.trim().toUpperCase())
  }

  private snapshot(): ActiveUniverse {
    const active = this.entries.filter((e) => e.status === 'ACTIVE')
    return {
      entries: this.entries.map((e) => ({ ...e })),
      capacity: {
        activeCount: active.length,
        max: MAX_ACTIVE,
        availableSlots: MAX_ACTIVE - active.length,
        protectedCount: active.filter((e) => e.isProtected).length,
        unresolvedCount: this.entries.filter((e) => e.validationStatus === 'UNRESOLVABLE').length,
      },
      provenance: 'mock',
    }
  }

  async getUniverse(): Promise<ActiveUniverse> {
    await latency(180)
    return this.snapshot()
  }

  async addSymbol(symbol: string, input: AddUniverseSymbolInput): Promise<UniverseEntry> {
    await latency(220)
    const upper = symbol.trim().toUpperCase()
    const existing = this.find(upper)
    if (existing?.status === 'USER_EXCLUDED') {
      // Same refusal plt gives (422 USER_EXCLUDED_REQUIRES_RESTORE): an add
      // must not silently undo a user's exclusion.
      throw new Error(`${upper} was excluded by you — restore it explicitly.`)
    }
    if (existing) return { ...existing }
    if (this.snapshot().capacity.availableSlots <= 0) {
      throw new Error('The active universe is at capacity with no evictable slot.')
    }
    const created = entry({
      symbol: upper,
      kind: input.source === 'USER' && input.pinned ? 'USER_PINNED' : 'AI_SELECTED',
      addedAt: new Date().toISOString(),
      reason: input.reason,
      validationStatus: 'UNVALIDATED',
    })
    this.entries.push(created)
    return { ...created }
  }

  async setPinned(symbol: string, pinned: boolean): Promise<UniverseEntry> {
    await latency(160)
    const found = this.find(symbol)
    if (!found) throw new Error(`${symbol} is not in the active universe.`)
    found.kind = pinned ? 'USER_PINNED' : 'AI_SELECTED'
    found.isProtected = pinned || found.positionProtected
    found.protectionReasons = pinned ? ['USER_PINNED'] : found.positionProtected ? ['OPEN_POSITION'] : []
    return { ...found }
  }

  async restoreSymbol(symbol: string): Promise<UniverseEntry> {
    await latency(160)
    const found = this.find(symbol)
    if (!found) throw new Error(`${symbol} is not in the active universe.`)
    found.status = 'ACTIVE'
    found.lastEvictedAt = undefined
    return { ...found }
  }

  async excludeSymbol(symbol: string, reason?: string): Promise<UniverseEntry> {
    await latency(160)
    const found = this.find(symbol)
    if (!found) throw new Error(`${symbol} is not in the active universe.`)
    found.status = 'USER_EXCLUDED'
    found.lastEvictedAt = new Date().toISOString()
    if (reason) found.reason = reason
    return { ...found }
  }
}

export const mockActiveUniverseApi = new MockActiveUniverseApi()
