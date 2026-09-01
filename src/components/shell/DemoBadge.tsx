import { Radio } from 'lucide-react'
import { hasLiveDomain } from '@/api/http/env'

/**
 * The build-wide demo badge (D10).
 *
 * It used to claim, unconditionally, that "all prices, positions and AI output
 * in this build are simulated". That is true of a mock-only build and false of
 * every mixed one: a build can serve a real plt portfolio beside mocked news,
 * and one blanket claim then mislabels both — it understates the real data and
 * lets the simulated data hide behind a badge nobody reads twice.
 *
 * So it renders only while *every* domain is mocked. Once any domain is live,
 * provenance moves to the panels themselves (`ProvenanceTag`), which can say
 * which half is which.
 */
export function DemoBadge() {
  if (hasLiveDomain()) return null

  return (
    <span
      className="hidden items-center gap-1.5 rounded-full border border-line bg-white/[0.05] px-2.5 py-1 text-[10.5px] font-bold tracking-[0.04em] text-ink-soft lg:inline-flex"
      title="Every domain in this build is served by in-browser demo fixtures. No prices, positions or AI output are real."
    >
      <Radio size={11} className="text-brand-300" />
      <span className="uppercase">Demo</span>
      <span className="hidden text-ink-muted xl:inline">· Simulated</span>
    </span>
  )
}
