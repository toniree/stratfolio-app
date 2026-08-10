/**
 * The Planner mark: a stopwatch whose hand sweeps. Shared by the home section
 * heading and the plan detail page so the section and its detail view carry
 * the same badge. Animation lives in index.css (`.plan-stopwatch-hand`).
 */
export function PlanStopwatchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className ?? 'h-[15px] w-[15px] shrink-0 text-brand-300/80'}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7.4 2.2h5.2M10 2.2v2.2M14.8 5.2l1.3-1.3M15.4 4.6l1.1 1.1" />
      <circle cx="10" cy="11.5" r="6.1" />
      <g className="plan-stopwatch-hand origin-[10px_11.5px]">
        <path d="M10 11.5V7.4" />
        <path d="M10 11.5l2.2 1.4" />
      </g>
      <circle cx="10" cy="11.5" r="0.65" fill="currentColor" stroke="none" />
    </svg>
  )
}
