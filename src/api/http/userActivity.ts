import { request } from '@/api/http/client'
import { isLive } from '@/api/http/env'
import type { PltActivity, PltCreateActivity } from '@/api/http/wire/plt'

/**
 * Interim disposition records (APP-113).
 *
 * Three user decisions have no backend field to live in:
 *  - accepting a thesis and rejecting a thesis — plt's `Thesis` has no
 *    disposition column (HKP-PLT-3);
 *  - disabling a trade plan — plt has no update route, and although
 *    `CANCELLED` exists in the status enum, no service path sets it
 *    (HKP-PLT-4).
 *
 * Each is therefore two things: authoritative local state (the zustand
 * stores, persisted), plus an **audit row** in plt so the decision is visible
 * to anything reading the action history. The audit row is not the state — if
 * this write fails the user's decision still stands locally — but it is the
 * only durable trace that exists until the real fields land.
 *
 * The payload is schema-valid or nothing (§7.10): `action_type` must be a real
 * `ActionType` constant or plt answers 400, so every write here is
 * `USER_ACTIVITY`. A free-form type like `THESIS_REJECTED` is not an option,
 * however well it would read in the feed.
 */

/** plt types `entity_id` as a UUID. A demo id such as `idea-msft-mar` is not
 *  one, so it travels in the payload rather than getting rejected at the door. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type UserDecision =
  | 'THESIS_ACCEPTED'
  | 'THESIS_REJECTED'
  | 'PLAN_DISABLED'
  | 'PLAN_ENABLED'

export interface UserDecisionInput {
  decision: UserDecision
  /** plt entity kind, e.g. `thesis` or `trade_plan`. */
  entityType: string
  entityId: string
  /** The user's own words, when they gave a reason. */
  reason?: string
}

export function toCreateActivity(input: UserDecisionInput): PltCreateActivity {
  const isUuid = UUID.test(input.entityId)
  return {
    // The only enum constant that means "a person did something" (§7.10).
    action_type: 'USER_ACTIVITY',
    entity_type: input.entityType,
    entity_id: isUuid ? input.entityId : undefined,
    actor: 'user',
    payload: {
      // The specific decision lives in the payload precisely because
      // `ActionType` has no constant for it. Naming it here keeps the record
      // readable without sending plt a value it would refuse.
      decision: input.decision,
      ...(isUuid ? {} : { entity_ref: input.entityId }),
      ...(input.reason ? { reason: input.reason } : {}),
    },
  }
}

/**
 * Write the audit row, when there is a plt to write to.
 *
 * Returns whether it landed. Deliberately never throws: the user's decision is
 * already recorded locally, and failing the interaction because an audit row
 * did not write would make the app *less* usable than having no audit at all.
 */
export async function recordUserDecision(input: UserDecisionInput): Promise<boolean> {
  // The activity feed is plt, which is the portfolio domain's backend.
  if (!isLive('portfolio')) return false
  try {
    await request<PltActivity>('plt', '/api/v1/activity', {
      method: 'POST',
      body: toCreateActivity(input),
    })
    return true
  } catch {
    return false
  }
}
