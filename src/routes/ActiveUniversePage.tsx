import { useMemo, useState } from 'react'
import { Pin, PinOff, RotateCcw, X } from 'lucide-react'
import type { UniverseEntry } from '@/api/types'
import {
  useActiveUniverse,
  useAddUniverseSymbol,
  useExcludeUniverseSymbol,
  useRestoreUniverseSymbol,
  useSetUniversePinned,
} from '@/hooks/queries'
import {
  UNIVERSE_KIND_LABEL,
  UNIVERSE_VALIDATION_LABEL,
} from '@/api/http/adapters/universe'
import { PageHeader } from '@/components/shared/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { SymbolIcon } from '@/components/shared/SymbolIcon'
import { StaticPill } from '@/components/shared/Pill'
import { ProvenanceTag } from '@/components/shared/ProvenanceTag'
import { relativeTime } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * The ActiveUniverse — the symbols the decision engine actually works on.
 *
 * Deliberately *not* the terminal watchlist. The tape in `Watchlist.tsx` is a
 * local ticker rail; this is plt's system of record for the AI's universe,
 * with real capacity limits, protection rules, AI promotion and symbol
 * validation. Casual add/remove on the tape must never touch this, and this
 * page never writes to the tape.
 */
export function ActiveUniversePage() {
  const { data: universe, isLoading, error } = useActiveUniverse()
  const addSymbol = useAddUniverseSymbol()
  const setPinned = useSetUniversePinned()
  const restore = useRestoreUniverseSymbol()
  const exclude = useExcludeUniverseSymbol()
  const [draft, setDraft] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const { active, excluded } = useMemo(() => {
    const entries = universe?.entries ?? []
    return {
      active: entries
        .filter((e) => e.status === 'ACTIVE')
        .sort((a, b) => (b.priorityScore ?? -1) - (a.priorityScore ?? -1)),
      excluded: entries.filter((e) => e.status === 'USER_EXCLUDED'),
    }
  }, [universe])

  const run = async (work: Promise<unknown>) => {
    setActionError(null)
    try {
      await work
    } catch (cause) {
      // plt refuses adds at capacity (409) and refuses re-adding an excluded
      // symbol (422). The refusal is the product behaviour, so it is shown
      // rather than swallowed.
      setActionError(cause instanceof Error ? cause.message : 'The request was refused.')
    }
  }

  const submitAdd = async (event: React.FormEvent) => {
    event.preventDefault()
    const symbol = draft.trim().toUpperCase()
    if (!symbol) return
    await run(addSymbol.mutateAsync({ symbol, input: { source: 'USER', pinned: true } }))
    setDraft('')
  }

  const capacity = universe?.capacity

  return (
    <div className="space-y-4">
      <PageHeader
        backTo="/app/profile"
        title="Active universe"
        mobileTitle="UNIVERSE"
        subtitle="The symbols the decision engine evaluates. Separate from your terminal watchlist."
        mobileSubtitle="The symbols the decision engine evaluates."
      />

      {error ? (
        <section className="card p-4">
          <p className="text-[13px] text-down">
            Could not load the active universe: {(error as Error).message}
          </p>
        </section>
      ) : null}

      <section className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[13px] font-bold tracking-[0.07em] text-ink-muted uppercase">
            Capacity
          </h2>
          {universe ? <ProvenanceTag provenance={universe.provenance} /> : null}
        </div>
        {isLoading || !capacity ? (
          <Skeleton className="mt-3 h-[52px] rounded-xl" />
        ) : (
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Active" value={`${capacity.activeCount} / ${capacity.max}`} />
            <Stat label="Free slots" value={String(capacity.availableSlots)} />
            <Stat label="Protected" value={String(capacity.protectedCount)} />
            <Stat
              label="Unresolvable"
              value={String(capacity.unresolvedCount)}
              tone={capacity.unresolvedCount > 0 ? 'down' : undefined}
            />
          </dl>
        )}
        <p className="mt-3 text-[11.5px] leading-relaxed text-ink-muted">
          Protected entries cannot be evicted to make room — an open position protects its symbol.
          An unresolvable symbol stays in the universe but can never produce a plan.
        </p>
      </section>

      <section className="card p-4">
        <h2 className="text-[13px] font-bold tracking-[0.07em] text-ink-muted uppercase">
          Add a symbol
        </h2>
        <form className="mt-3 flex gap-2" onSubmit={submitAdd}>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ticker"
            aria-label="Symbol to add to the active universe"
            className="liquid-control h-10 min-w-0 flex-1 rounded-xl px-3 text-[13px] font-semibold text-ink uppercase outline-none"
          />
          <Button type="submit" disabled={!draft.trim() || addSymbol.isPending}>
            {addSymbol.isPending ? 'Adding…' : 'Add & pin'}
          </Button>
        </form>
        <p className="mt-2 text-[11.5px] leading-relaxed text-ink-muted">
          Adding here changes what the model looks at. It does not touch your terminal watchlist.
        </p>
        {actionError ? (
          <p className="mt-2 rounded-xl bg-down-soft px-3 py-2 text-[12px] font-semibold text-down">
            {actionError}
          </p>
        ) : null}
      </section>

      <section className="card p-4">
        <h2 className="text-[13px] font-bold tracking-[0.07em] text-ink-muted uppercase">
          In the universe
        </h2>
        {isLoading ? (
          <div className="mt-3 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[62px] rounded-xl" />
            ))}
          </div>
        ) : active.length === 0 ? (
          <p className="mt-3 text-[13px] text-ink-muted">No symbols are active.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {active.map((entry) => (
              <EntryRow
                key={entry.symbol}
                entry={entry}
                busy={setPinned.isPending || exclude.isPending}
                onTogglePin={() =>
                  run(
                    setPinned.mutateAsync({
                      symbol: entry.symbol,
                      pinned: entry.kind !== 'USER_PINNED',
                    }),
                  )
                }
                onExclude={() => run(exclude.mutateAsync({ symbol: entry.symbol }))}
              />
            ))}
          </ul>
        )}
      </section>

      {excluded.length > 0 ? (
        <section className="card p-4">
          <h2 className="text-[13px] font-bold tracking-[0.07em] text-ink-muted uppercase">
            Excluded by you
          </h2>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-muted">
            The platform keeps these rather than deleting them, so an AI promotion cannot silently
            put a symbol you dropped back into the universe. Restoring is an explicit action.
          </p>
          <ul className="mt-3 space-y-2">
            {excluded.map((entry) => (
              <li
                key={entry.symbol}
                className="flex items-center gap-2.5 rounded-xl border border-line bg-white/[0.02] px-3 py-2.5"
              >
                <SymbolIcon symbol={entry.symbol} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-extrabold text-ink">{entry.symbol}</div>
                  {entry.reason ? (
                    <div className="truncate text-[11px] text-ink-muted">{entry.reason}</div>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={restore.isPending}
                  onClick={() => run(restore.mutateAsync(entry.symbol))}
                >
                  <RotateCcw size={12} /> Restore
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function EntryRow({
  entry,
  busy,
  onTogglePin,
  onExclude,
}: {
  entry: UniverseEntry
  busy: boolean
  onTogglePin: () => void
  onExclude: () => void
}) {
  const pinned = entry.kind === 'USER_PINNED'
  return (
    <li className="flex items-center gap-2.5 rounded-xl border border-line bg-white/[0.02] px-3 py-2.5">
      <SymbolIcon symbol={entry.symbol} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[13px] font-extrabold text-ink">{entry.symbol}</span>
          <StaticPill tone="neutral">{UNIVERSE_KIND_LABEL[entry.kind]}</StaticPill>
          {entry.validationStatus === 'VALID' ? null : (
            <StaticPill tone={entry.validationStatus === 'UNRESOLVABLE' ? 'negative' : 'neutral'}>
              {UNIVERSE_VALIDATION_LABEL[entry.validationStatus]}
            </StaticPill>
          )}
          {entry.hasOpenTrade ? <StaticPill tone="positive">Open trade</StaticPill> : null}
        </div>
        <div className="mt-0.5 truncate text-[11px] text-ink-muted">
          {/* Absent, not zero: an unscored symbol has not been evaluated yet. */}
          {entry.priorityScore === undefined
            ? 'Not yet scored'
            : `Priority ${entry.priorityScore.toFixed(2)}`}
          {entry.lastEvaluatedAt ? ` · evaluated ${relativeTime(entry.lastEvaluatedAt)}` : ''}
          {entry.reason ? ` · ${entry.reason}` : ''}
        </div>
      </div>
      <button
        type="button"
        aria-label={pinned ? `Unpin ${entry.symbol}` : `Pin ${entry.symbol}`}
        disabled={busy}
        onClick={onTogglePin}
        className={cn(
          'grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line transition-colors',
          pinned ? 'bg-brand-500/15 text-brand-300' : 'text-ink-muted hover:text-ink',
        )}
      >
        {pinned ? <PinOff size={13} /> : <Pin size={13} />}
      </button>
      <button
        type="button"
        aria-label={`Exclude ${entry.symbol}`}
        // Protection is a server rule, surfaced here so the button explains
        // itself rather than failing on click.
        disabled={busy || entry.isProtected}
        title={
          entry.isProtected
            ? `Protected: ${entry.protectionReasons.join(', ') || 'cannot be evicted'}`
            : undefined
        }
        onClick={onExclude}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line text-ink-muted transition-colors hover:text-down disabled:opacity-40"
      >
        <X size={13} />
      </button>
    </li>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'down' }) {
  return (
    <div className="rounded-xl border border-line bg-white/[0.02] px-3 py-2.5">
      <dt className="text-[9.5px] font-bold tracking-[0.07em] text-ink-muted uppercase">{label}</dt>
      <dd className={cn('num mt-1 text-[15px] font-extrabold', tone === 'down' ? 'text-down' : 'text-ink')}>
        {value}
      </dd>
    </div>
  )
}
