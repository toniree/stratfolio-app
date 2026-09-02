import type { BacktestExecutionView, NoFillEventView } from '@/api/researchTypes'
import { MISSING } from '@/lib/format'
import { count, money, ratioPercent } from '@/components/research/researchFormat'

/**
 * `metrics["execution"]` — the run's own account of what it attempted and what
 * it refused (contracts §19.4).
 *
 * This panel is the answer to "it made money" hiding "it only filled a third of
 * the time". Under the two-quote protocol an entry is a decision on session *t*
 * and a fill on *t+1*, and the band predicate that refuses a live silent entry
 * refuses this one — so a refusal is a first-class recorded event, and its rate
 * is a property of the protocol that produced it.
 *
 * Two absences are rendered as absences, not zeros:
 *  - `no_fill_rate` is `null` when nothing was attempted. A run that never
 *    found a candidate did not achieve a 0% refusal rate; it has no rate.
 *  - `pending_entries_at_window_end` counts decisions on the window's last
 *    session, which had no *t+1* to fill against. They are **not** NO_FILLs —
 *    nothing was refused, the window ended — and they are disclosed separately
 *    for exactly that reason (§19.1).
 */
export function ExecutionEvidence({
  execution,
  noFillEvents,
  pendingEntriesAtWindowEnd,
}: {
  execution?: BacktestExecutionView
  noFillEvents: NoFillEventView[]
  pendingEntriesAtWindowEnd?: number
}) {
  if (!execution) {
    return (
      <section className="rounded-xl border border-line bg-white/[0.02] px-3 py-3">
        <h4 className="text-[10px] font-extrabold tracking-[0.06em] text-ink-soft uppercase">
          Execution
        </h4>
        <p className="mt-1.5 text-[10px] leading-relaxed text-ink-muted">
          This run reports no execution block. It predates BKT-020, so its fill
          rate was never recorded — which is not the same as a run that filled
          everything it attempted.
        </p>
      </section>
    )
  }

  const pending = pendingEntriesAtWindowEnd ?? execution.pendingEntriesAtWindowEnd

  return (
    <section className="rounded-xl border border-line bg-white/[0.02]">
      <header className="flex flex-wrap items-baseline gap-2 border-b border-line px-3 py-2">
        <h4 className="text-[10px] font-extrabold tracking-[0.06em] text-ink-soft uppercase">
          Execution
        </h4>
        <span className="num text-[9px] text-ink-muted">{execution.fillProtocol}</span>
      </header>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2 px-3 py-2.5 sm:grid-cols-4">
        <Stat label="Attempted" value={count(execution.entriesAttempted)} />
        <Stat label="Filled" value={count(execution.entriesFilled)} />
        <Stat label="No fill" value={count(execution.noFillCount)} />
        <Stat
          label="No-fill rate"
          value={ratioPercent(execution.noFillRate)}
          hint={
            execution.noFillRate === undefined
              ? 'No entry was attempted, so this run has no refusal rate — bkt reports null rather than 0%.'
              : undefined
          }
        />
      </div>

      {execution.noFillByReason.length > 0 ? (
        <div className="border-t border-line/60 px-3 py-2.5">
          <div className="text-[8.5px] font-extrabold tracking-[0.06em] text-ink-muted uppercase">
            Refusals by reason
          </div>
          <ul className="mt-1.5 space-y-1">
            {execution.noFillByReason.map((row) => (
              <li key={row.reason} className="flex items-baseline gap-2">
                {/* The code verbatim: ENTRY_PRICE_ABOVE_BAND and
                    SPREAD_TOO_WIDE are different facts about the strategy. */}
                <span className="num text-[10px] font-bold text-ink">{row.reason}</span>
                <span className="num ml-auto text-[10.5px] font-extrabold text-ink-soft">
                  {row.count}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {pending !== undefined && pending > 0 ? (
        <p className="border-t border-line/60 px-3 py-2 text-[10px] leading-relaxed text-ink-muted">
          <span className="font-bold text-ink-soft">{pending}</span> decision
          {pending === 1 ? '' : 's'} fell on the window's last session and had no next session to
          fill against. Counted, never priced forward — and not a refusal.
        </p>
      ) : null}

      {noFillEvents.length > 0 ? (
        <div className="border-t border-line/60 px-3 py-2.5">
          <div className="text-[8.5px] font-extrabold tracking-[0.06em] text-ink-muted uppercase">
            Refused entries · {noFillEvents.length}
          </div>
          <div className="no-scrollbar mt-1.5 max-h-[190px] overflow-y-auto">
            <table className="w-full min-w-[380px] text-left">
              <thead>
                <tr className="text-[8.5px] font-extrabold tracking-[0.06em] text-ink-muted uppercase">
                  <th className="py-1">Contract</th>
                  <th className="py-1">Reason</th>
                  <th className="py-1 text-right">Decision</th>
                  <th className="py-1 text-right">Fill</th>
                  <th className="py-1 text-right">Band</th>
                  <th className="py-1 text-right">Excess</th>
                </tr>
              </thead>
              <tbody className="num text-[10px]">
                {noFillEvents.map((event, index) => (
                  <tr key={`${event.occSymbol}-${event.decisionDate}-${index}`} className="border-t border-line/40">
                    <td className="py-1 pr-2 font-bold text-ink">{event.occSymbol}</td>
                    <td className="py-1 pr-2 text-ink-soft">{event.reason}</td>
                    <td className="py-1 text-right text-ink-soft">{money(event.decisionPrice)}</td>
                    <td className="py-1 text-right text-ink-soft">{money(event.fillPrice)}</td>
                    <td className="py-1 text-right text-ink-soft">{money(event.bandMax)}</td>
                    <td className="py-1 text-right text-ink-soft">
                      {event.excess === undefined ? MISSING : money(event.excess)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0" title={hint}>
      <div className="text-[8.5px] font-extrabold tracking-[0.06em] text-ink-muted uppercase">
        {label}
      </div>
      <div className="num mt-0.5 truncate text-[12.5px] font-extrabold text-ink">{value}</div>
    </div>
  )
}
