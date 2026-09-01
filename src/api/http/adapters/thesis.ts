import type { ThesisEvidenceEntry, ThesisView } from '@/api/types'
import type { PltThesis } from '@/api/http/wire/plt'
import { decimal, instant, requiredInstant, requiredText, stringList, text } from '@/api/http/wire/scalars'

/**
 * plt `ThesisResponse` → `ThesisView` (APP-111).
 *
 * The whole contract of this file is *subtraction*. `ThesisResponse` has no
 * price, no entry band, no target band, no recommendation and no upside
 * percentage, so nothing here may produce one — the screens that used to show
 * them are reading a demo `Idea`, which live mode does not have (§3.2, §6).
 *
 * The two conversions that are easy to get wrong and are deliberately *not*
 * done here:
 *  - `confidence` stays the 0..1 fraction plt sent (§7.4). Multiplying by 100
 *    in an adapter is how a 0.72 confidence becomes a "7200" somewhere else.
 *  - `time_horizon` stays the ISO-8601 duration plt sent. `formatHorizon()`
 *    turns `P14D` into "14 days" at render, and echoes anything unparseable.
 */

/** Keys we never surface as evidence rows: they are provenance plumbing that
 *  already has its own place in the view model, not model evidence. */
const EVIDENCE_PLUMBING = new Set(['model_version', 'prompt_version', 'strategy_version'])

function evidenceValue(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'string') return text(value)
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : undefined
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  // Nested structures are model output too, so they are shown compactly rather
  // than dropped — but never re-interpreted into a claim the model never made.
  try {
    const json = JSON.stringify(value)
    return json === undefined ? undefined : json
  } catch {
    return undefined
  }
}

/** Turn a key such as `iv_rank` or `earningsDate` into a readable label. */
function evidenceLabel(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
  return spaced.length === 0 ? key : spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/**
 * Flatten plt's free-form `evidence` map into renderable rows.
 *
 * plt types this as `Map<String, Object>` with no schema at all, so the adapter
 * promises only what the model actually sent: one row per top-level key, in
 * wire order, with unrenderable values dropped rather than shown as "null".
 */
export function toEvidenceEntries(
  evidence: Record<string, unknown> | undefined,
): ThesisEvidenceEntry[] | undefined {
  if (!evidence || typeof evidence !== 'object') return undefined
  const entries: ThesisEvidenceEntry[] = []
  for (const [key, raw] of Object.entries(evidence)) {
    if (EVIDENCE_PLUMBING.has(key)) continue
    const value = evidenceValue(raw)
    if (value === undefined) continue
    entries.push({ label: evidenceLabel(key), value })
  }
  return entries.length > 0 ? entries : undefined
}

export function toThesisView(wire: PltThesis): ThesisView {
  return {
    id: requiredText(wire.id, 'thesis.id'),
    symbol: requiredText(wire.ticker, 'thesis.ticker').toUpperCase(),
    direction: wire.direction,
    rationale: requiredText(wire.rationale, 'thesis.rationale'),
    // Fractional on purpose — see the file comment.
    confidence: decimal(wire.confidence),
    evidence: toEvidenceEntries(wire.evidence),
    invalidationConditions: stringList(wire.invalidation_conditions),
    expectedCatalyst: text(wire.expected_catalyst),
    horizon: text(wire.time_horizon),
    source: wire.source === 'USER' ? 'user' : 'ai',
    modelVersion: text(wire.model_version),
    promptVersion: text(wire.prompt_version),
    strategyVersion: text(wire.strategy_version),
    episodeId: text(wire.decision_episode_id),
    createdAt: requiredInstant(wire.created_at, 'thesis.created_at'),
    provenance: 'live',
    // `idea` is deliberately never set here: there is no live source for the
    // prices and targets it carries.
  }
}

/** Newest first — plt's list endpoint has no ordering guarantee in its
 *  contract, and a feed that reshuffles between polls reads as broken. */
export function sortThesesNewestFirst(theses: ThesisView[]): ThesisView[] {
  return theses
    .slice()
    .sort((a, b) => (instant(b.createdAt) ?? '').localeCompare(instant(a.createdAt) ?? ''))
}
