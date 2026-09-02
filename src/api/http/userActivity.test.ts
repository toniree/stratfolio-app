import { describe, expect, it } from 'vitest'
import { toCreateActivity } from '@/api/http/userActivity'
import type { PltActionType } from '@/api/http/wire/plt'

/** The complete plt `ActionType` roster, as the enum defines it. */
const ACTION_TYPES: PltActionType[] = [
  'THESIS_CREATED',
  'TRADE_PLAN_VALIDATED',
  'TRADE_PLAN_REJECTED',
  'TRADE_PLAN_EXECUTED',
  'SILENT_TRADE_OPENED',
  'SILENT_TRADE_CLOSED',
  'POSITION_OPENED',
  'POSITION_CLOSED',
  'PORTFOLIO_UPDATED',
  'CONFIG_UPDATED',
  'USER_ACTIVITY',
  'WATCHLIST_ADDED',
  'WATCHLIST_RESTORED',
  'WATCHLIST_EXCLUDED',
  'WATCHLIST_EVICTED',
  'WATCHLIST_PINNED',
  'WATCHLIST_UNPINNED',
  'WATCHLIST_UPDATED',
  'WATCHLIST_VALIDATION_CHANGED',
  'WATCHLIST_SEEDED',
  'CANDIDATE_RECORDED',
  'CANDIDATE_PROMOTED',
  'CANDIDATE_REJECTED',
  'CANDIDATE_EXPIRED',
]

describe('toCreateActivity — schema-valid or nothing (§7.10)', () => {
  it('always uses a real ActionType constant', () => {
    for (const decision of ['THESIS_ACCEPTED', 'THESIS_REJECTED', 'PLAN_DISABLED'] as const) {
      const body = toCreateActivity({
        decision,
        entityType: 'thesis',
        entityId: '77665544-3322-4110-8fee-ddccbbaa9988',
      })
      // `THESIS_REJECTED` would read better in the feed and is a 400: plt
      // validates `action_type` against the enum.
      expect(ACTION_TYPES).toContain(body.action_type)
      expect(body.action_type).toBe('USER_ACTIVITY')
      // The specific decision lives in the payload, which is free-form.
      expect(body.payload?.decision).toBe(decision)
    }
  })

  it('sends entity_id only when it is a UUID, as plt types it', () => {
    const live = toCreateActivity({
      decision: 'THESIS_ACCEPTED',
      entityType: 'thesis',
      entityId: '77665544-3322-4110-8fee-ddccbbaa9988',
    })
    expect(live.entity_id).toBe('77665544-3322-4110-8fee-ddccbbaa9988')
    expect(live.payload).not.toHaveProperty('entity_ref')

    // A demo id is not a UUID; sending it would be rejected at the door, so it
    // travels in the payload instead of costing the whole write.
    const demo = toCreateActivity({
      decision: 'THESIS_REJECTED',
      entityType: 'thesis',
      entityId: 'idea-msft-mar',
    })
    expect(demo.entity_id).toBeUndefined()
    expect(demo.payload?.entity_ref).toBe('idea-msft-mar')
  })

  it('carries entity_type and actor, and omits an absent reason', () => {
    const body = toCreateActivity({
      decision: 'PLAN_DISABLED',
      entityType: 'trade_plan',
      entityId: 'aabbccdd-eeff-4011-8223-344556677889',
    })
    expect(body.entity_type).toBe('trade_plan')
    expect(body.actor).toBe('user')
    expect(body.payload).not.toHaveProperty('reason')

    const withReason = toCreateActivity({
      decision: 'PLAN_DISABLED',
      entityType: 'trade_plan',
      entityId: 'aabbccdd-eeff-4011-8223-344556677889',
      reason: 'thesis went stale',
    })
    expect(withReason.payload?.reason).toBe('thesis went stale')
  })
})
