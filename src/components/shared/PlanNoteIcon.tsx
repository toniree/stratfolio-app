/**
 * Notepad and pencil whose last rule writes itself on a loop — the shared mark
 * for "turn this into a plan".
 *
 * Hand-authored rather than a Lucide glyph because the animated stroke has to be
 * its own path (see `.plan-note-line` in index.css). The pencil's tip lands at
 * the right end of that rule so it reads as the thing drawing it, and it sits
 * clear of the pad's right edge — overlapping strokes turn to mush at this size.
 */
export function PlanNoteIcon({ size = 19 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="4.8"
        y="2.4"
        width="11.8"
        height="16.2"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M7.7 7.6h6.4M7.7 11.2h6.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        className="plan-note-line"
        d="M7.7 14.8h6.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M19.7 9.6l1.4 1.4-3.6 3.6-1.9.5.5-1.9z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M18.3 11l1.4 1.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.65"
      />
    </svg>
  )
}
