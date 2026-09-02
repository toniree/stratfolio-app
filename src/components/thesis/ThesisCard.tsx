import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { formatConfidence, formatHorizon, relativeTime } from '@/lib/format'
import type { ThesisView } from '@/api/types'
import { SymbolIcon } from '@/components/shared/SymbolIcon'
import { TileShell } from '@/components/shared/TileShell'
import { ProvenanceTag } from '@/components/shared/ProvenanceTag'
import { ThesisTileFooter } from '@/components/thesis/ThesisTileFooter'

/**
 * A thesis, rendered as the platform records it (APP-111).
 *
 * Every element on this card maps to one field of plt's `ThesisResponse`:
 * direction, rationale, confidence, evidence, invalidation conditions,
 * expected catalyst and time horizon. There is deliberately no price, no entry
 * band, no target band, no expected-upside figure and no BUY/HOLD chip — plt
 * records none of those against a thesis, and the alternative to leaving them
 * out is inventing them (§3.2, §6).
 *
 * `RecTile` and `IdeaCard` still render the demo book's fully-specified idea;
 * a caller reaches this card when `ThesisView.idea` is absent, which is the
 * data saying so rather than the component asking what mode it is in.
 */
export function ThesisCard({ thesis, className }: { thesis: ThesisView; className?: string }) {
  const navigate = useNavigate()
  return (
    <TileShell
      className={cn('trade-thesis-tile', className)}
      accent="ai"
      onActivate={() => navigate(`/app/thesis/${thesis.id}`)}
      ariaLabel={`${thesis.symbol} thesis details`}
    >
      <ThesisHeader thesis={thesis} />
      <ThesisBody thesis={thesis} className="mt-3" />
      {/* Accept/reject is a disposition record, not a derived trade plan: plt
          has no disposition field (HKP-PLT-3), so the decision is local state
          plus a schema-valid activity row (APP-113). */}
      <ThesisTileFooter thesis={thesis} />
    </TileShell>
  )
}

/** Identity row: ticker, direction, confidence and how old the thesis is. */
export function ThesisHeader({ thesis }: { thesis: ThesisView }) {
  return (
    <div className="flex items-start gap-2.5">
      <SymbolIcon symbol={thesis.symbol} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-[17px] leading-none font-extrabold tracking-[-0.02em] text-ink">
            {thesis.symbol}
          </span>
          <DirectionChip direction={thesis.direction} />
          <span className="text-[9.5px] font-bold tracking-[0.06em] text-ink-muted uppercase">
            {thesis.source === 'user' ? 'User thesis' : 'Model thesis'}
          </span>
          <ProvenanceTag provenance={thesis.provenance} />
        </div>
        <p className="mt-1 text-[11px] text-ink-muted">
          {relativeTime(thesis.createdAt)}
          {thesis.horizon ? ` · horizon ${formatHorizon(thesis.horizon)}` : ''}
        </p>
      </div>
      {/* Confidence is a 0..1 fraction all the way from the wire; this is the
          render site that turns it into a percentage (§7.4). It is **not** the
          0–100 conviction score `AIAssessment` carries, so it is not labelled
          as one. */}
      <div className="shrink-0 text-right">
        {thesis.confidence === undefined ? (
          <span className="text-[10px] text-ink-muted">No confidence</span>
        ) : (
          <>
            <div className="num text-[16px] leading-none font-extrabold tracking-[-0.02em] text-ink">
              {formatConfidence(thesis.confidence)}
            </div>
            <div className="mt-0.5 text-[8.5px] font-bold tracking-[0.06em] text-ink-muted uppercase">
              Confidence
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** Rationale, catalyst, evidence and invalidation conditions. */
export function ThesisBody({
  thesis,
  className,
  full,
}: {
  thesis: ThesisView
  className?: string
  /** Detail view: no line clamp on the rationale, all evidence rows shown. */
  full?: boolean
}) {
  const evidence = full ? thesis.evidence : thesis.evidence?.slice(0, 4)
  return (
    <div className={cn('space-y-3', className)}>
      <p
        className={cn(
          'text-[12.5px] leading-relaxed text-ink-soft',
          full ? undefined : 'line-clamp-4',
        )}
      >
        {thesis.rationale}
      </p>

      {thesis.expectedCatalyst ? (
        <Section label="Expected catalyst">
          <p className="text-[12px] leading-relaxed text-ink-soft">{thesis.expectedCatalyst}</p>
        </Section>
      ) : null}

      {evidence && evidence.length > 0 ? (
        <Section label="Evidence">
          <dl className="space-y-1">
            {evidence.map((entry) => (
              <div key={entry.label} className="flex items-baseline justify-between gap-3">
                <dt className="shrink-0 text-[10.5px] font-semibold text-ink-muted">
                  {entry.label}
                </dt>
                <dd className="num min-w-0 truncate text-right text-[11.5px] text-ink-soft">
                  {entry.value}
                </dd>
              </div>
            ))}
          </dl>
          {!full && thesis.evidence && thesis.evidence.length > evidence.length ? (
            <p className="mt-1 text-[10.5px] text-ink-muted">
              +{thesis.evidence.length - evidence.length} more
            </p>
          ) : null}
        </Section>
      ) : null}

      {thesis.invalidationConditions && thesis.invalidationConditions.length > 0 ? (
        <Section label="Invalidation conditions">
          <ul className="space-y-1">
            {thesis.invalidationConditions.map((condition) => (
              <li
                key={condition}
                className="flex gap-1.5 text-[12px] leading-relaxed text-ink-soft"
              >
                <span aria-hidden>·</span>
                <span>{condition}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* Nothing here claims an entry price, a target or a recommendation:
          plt's thesis record has no such field (§3.2). */}
      <p className="text-[10.5px] leading-snug text-ink-muted">
        Thesis only — no entry, target or sizing is recorded against it.
      </p>
    </div>
  )
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-t border-line pt-2">
      <p className="mb-1 text-[8.5px] font-bold tracking-[0.07em] text-ink-muted uppercase">
        {label}
      </p>
      {children}
    </div>
  )
}

const DIRECTION_TONE: Record<ThesisView['direction'], string> = {
  BULLISH: 'border-up/25 bg-up-soft text-up',
  BEARISH: 'border-down/25 bg-down-soft text-down',
  NEUTRAL: 'border-line bg-white/[0.04] text-ink-muted',
}

export function DirectionChip({ direction }: { direction: ThesisView['direction'] }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[8.5px] font-bold tracking-[0.05em] uppercase',
        DIRECTION_TONE[direction],
      )}
    >
      {direction}
    </span>
  )
}
