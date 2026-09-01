import { CheckCircle2, Circle, HelpCircle } from 'lucide-react'
import type { CriterionState } from '@/api/newsTypes'
import { cn } from '@/lib/cn'

/**
 * The three-state criterion marker.
 *
 * `unknown` gets its own glyph on purpose. Rendering an unevaluated condition
 * as a hollow "unmet" circle is a claim the app cannot support: nothing in the
 * backend evaluates entry criteria (HKP-XSV-1), so "we have not checked" and
 * "we checked and it is false" must not look the same.
 */
export function CriterionIcon({ state, size = 12 }: { state: CriterionState; size?: number }) {
  if (state === 'met') {
    return (
      <CheckCircle2
        size={size}
        strokeWidth={2.4}
        className="mt-px shrink-0 text-up"
        aria-label="Met"
      />
    )
  }
  if (state === 'unmet') {
    return (
      <Circle
        size={size}
        strokeWidth={2}
        className="mt-px shrink-0 text-ink-muted/70"
        aria-label="Not met"
      />
    )
  }
  return (
    <HelpCircle
      size={size}
      strokeWidth={2}
      className="mt-px shrink-0 text-ink-muted/50"
      aria-label="Not evaluated"
    />
  )
}

export function criterionTextClass(state: CriterionState): string {
  return cn(
    state === 'met' && 'text-white/90',
    state === 'unmet' && 'text-white/65',
    state === 'unknown' && 'text-white/50',
  )
}

export const CRITERION_UNKNOWN_NOTE =
  'Nothing evaluates these conditions yet — they are recorded with the plan, not monitored.'
