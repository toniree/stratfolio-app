import type { Provenance } from '@/api/types'
import { cn } from '@/lib/cn'

/**
 * Per-panel data provenance (D10).
 *
 * This replaces the single global "everything in this build is simulated"
 * badge, which stops being true the moment one domain goes live: a build can
 * show a real plt portfolio beside mocked news, and one blanket claim then
 * mislabels both. Each panel states what its own data is.
 *
 * `live` deliberately renders nothing. Real data is the baseline, and a badge
 * on every real panel would be noise that trains people to ignore the badge
 * that matters.
 */
const LABEL: Record<Exclude<Provenance, 'live'>, { text: string; title: string; tone: string }> = {
  mock: {
    text: 'Simulated',
    title: 'Demo fixtures. Not real market or account data.',
    tone: 'border-line bg-white/[0.04] text-ink-muted',
  },
  replay: {
    text: 'Replay',
    title: 'Real recorded provider data, replayed off a fixed clock.',
    tone: 'border-brand-300/25 bg-brand-500/10 text-brand-300',
  },
  synthetic: {
    text: 'Synthetic',
    title: 'Generated server-side by the market-data service, not a real quote.',
    tone: 'border-[#f5c26b]/25 bg-[#f5c26b]/10 text-[#f5c26b]',
  },
}

/**
 * The market service's own staleness verdict, passed through untouched.
 *
 * mnd decides what "stale" means (its threshold, against event time, on its
 * clock) and the browser does not re-derive it — a second opinion computed
 * from `Date.now()` would disagree with the service in replay mode, where the
 * dataset sits at a historical instant by design. When mnd says a quote is
 * stale, the price beside this badge is still real; it is simply old, and a
 * number that is quietly old is the one people act on by mistake.
 */
export function StaleTag({ stale, className }: { stale?: boolean; className?: string }) {
  if (!stale) return null
  return (
    <span
      title="The market data service reports this quote as older than its freshness threshold."
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-[0.06em] uppercase',
        'border-[#f5c26b]/25 bg-[#f5c26b]/10 text-[#f5c26b]',
        className,
      )}
    >
      Stale
    </span>
  )
}

export function ProvenanceTag({
  provenance,
  className,
}: {
  provenance?: Provenance
  className?: string
}) {
  if (!provenance || provenance === 'live') return null
  const label = LABEL[provenance]
  return (
    <span
      title={label.title}
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-[0.06em] uppercase',
        label.tone,
        className,
      )}
    >
      {label.text}
    </span>
  )
}
