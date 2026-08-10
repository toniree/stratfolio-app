/**
 * The Trade Theses mark: a sparkle whose outline traces itself with a small
 * glint alongside it. Shared by the home carousel heading and the thesis page
 * so the section and its detail view carry the same badge.
 *
 * Animation lives in index.css (`.thesis-sparkle-trace`, `.thesis-sparkle-glint`).
 */
export function ThesisSparklesIcon({ className }: { className?: string }) {
  const mainSparkle =
    'M8 1.5c.35 3.75 2.75 6.15 6.5 6.5C10.75 8.35 8.35 10.75 8 14.5 7.65 10.75 5.25 8.35 1.5 8 5.25 7.65 7.65 5.25 8 1.5Z'
  return (
    <svg
      viewBox="0 0 16 16"
      className={className ?? 'h-[15px] w-[15px] text-brand-300/80 sm:h-4 sm:w-4'}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={mainSparkle} opacity="0.5" />
      <path className="thesis-sparkle-trace" d={mainSparkle} />
      <path d="M12.7 1.35v2.3M11.55 2.5h2.3" opacity="0.48" />
      <path className="thesis-sparkle-glint" d="M12.7 1.35v2.3M11.55 2.5h2.3" />
    </svg>
  )
}
