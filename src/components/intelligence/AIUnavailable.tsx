import { cn } from '@/lib/cn'

/**
 * What a holding or idea looks like when there is no AI assessment.
 *
 * This is the common case in live mode, not an edge case: plt records a
 * `decision_episode_id` on a position, not an assessment, and service-ai
 * exposes no episode list (HKP-AI-1) — so most real rows genuinely have no
 * model view attached. Showing a 0/100 conviction badge, an empty thesis or a
 * neutral "HOLD" would each invent a model opinion that was never produced.
 */
export function AIUnavailable({
  className,
  detail = 'No model assessment for this position.',
}: {
  className?: string
  detail?: string
}) {
  return (
    <p className={cn('text-[10px] leading-snug text-ink-muted', className)}>
      {detail}
    </p>
  )
}

/** Inline, badge-shaped placeholder for tight rows (tables, tiles). */
export function AIUnavailableChip({ className }: { className?: string }) {
  return (
    <span
      title="No AI assessment recorded for this row."
      className={cn(
        'inline-flex items-center rounded-md border border-line bg-white/[0.03] px-1.5 py-0.5 text-[8.5px] font-bold tracking-[0.05em] text-ink-muted uppercase',
        className,
      )}
    >
      No AI
    </span>
  )
}
