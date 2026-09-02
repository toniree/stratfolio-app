import type { BucketRow } from '@/api/researchTypes'
import { MISSING } from '@/lib/format'
import { ratioPercent, signedMoney } from '@/components/research/researchFormat'

/**
 * One metrics bucket table — `by_dte_bucket`, `by_delta_bucket`, `by_ticker`,
 * `by_exit_reason` (contracts §19.4).
 *
 * The whole point of this component is the thin-bucket row. bkt **fails
 * closed** below five trades: it reports the bucket's real `trade_count` and
 * nulls `total_pnl`, `win_rate` and `avg_pnl`, with a note saying why. A win
 * rate over two trades is noise wearing a percentage sign, and a bucket table
 * is precisely where such a number gets read as a finding — so a withheld
 * statistic renders as **"insufficient data (n=3)"** across the stat columns,
 * never as 0%, never as an empty cell that reads as zero, and never as a row
 * quietly dropped to make the table look tidy (D4).
 *
 * `unknown` is a real bucket, not a gap: trades whose entry delta was never
 * recorded are counted under that name rather than omitted, because a
 * bucketing that drops rows lies about its own sample size.
 */
export function BucketTable({
  title,
  caption,
  rows,
  unavailable,
  unavailableNote,
}: {
  title: string
  caption?: string
  rows: BucketRow[]
  /** True when the backend did not report this bucketing at all (a pre-§19
   *  run) — a different statement from "reported, and empty". */
  unavailable?: boolean
  unavailableNote?: string
}) {
  return (
    <section className="rounded-xl border border-line bg-white/[0.02]">
      <header className="flex items-baseline gap-2 border-b border-line px-3 py-2">
        <h4 className="text-[10px] font-extrabold tracking-[0.06em] text-ink-soft uppercase">
          {title}
        </h4>
        {caption ? <span className="text-[9px] text-ink-muted">{caption}</span> : null}
      </header>

      {unavailable ? (
        <p className="px-3 py-3 text-[10px] leading-relaxed text-ink-muted">
          {unavailableNote ??
            'This run does not report this bucketing — it predates the §19.4 buckets. Nothing is inferred from its absence.'}
        </p>
      ) : rows.length === 0 ? (
        <p className="px-3 py-3 text-[10px] text-ink-muted">
          No closed trades fell into any bucket.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[340px] text-left">
            <thead>
              <tr className="text-[8.5px] font-extrabold tracking-[0.06em] text-ink-muted uppercase">
                <th className="px-3 py-1.5">Bucket</th>
                <th className="px-3 py-1.5 text-right">Trades</th>
                <th className="px-3 py-1.5 text-right">Win rate</th>
                <th className="px-3 py-1.5 text-right">Avg P/L</th>
                <th className="px-3 py-1.5 text-right">Total P/L</th>
              </tr>
            </thead>
            <tbody className="num text-[10.5px]">
              {rows.map((row) => (
                <tr key={row.key} className="border-t border-line/60">
                  <td className="px-3 py-1.5 font-bold text-ink">{row.key}</td>
                  <td className="px-3 py-1.5 text-right text-ink-soft">{row.tradeCount}</td>
                  {row.insufficient ? (
                    <td
                      colSpan={3}
                      // bkt's own reason, verbatim, on hover — the UI states
                      // the withholding, it does not reword the rule.
                      title={row.note}
                      className="px-3 py-1.5 text-right text-[10px] font-semibold text-ink-muted"
                    >
                      insufficient data (n={row.tradeCount})
                    </td>
                  ) : (
                    <>
                      <td className="px-3 py-1.5 text-right text-ink-soft">
                        {ratioPercent(row.winRate, 0)}
                      </td>
                      <td className="px-3 py-1.5 text-right text-ink-soft">
                        {row.avgPnl === undefined ? MISSING : signedMoney(row.avgPnl)}
                      </td>
                      <td
                        className={
                          row.totalPnl === undefined
                            ? 'px-3 py-1.5 text-right text-ink-muted'
                            : `px-3 py-1.5 text-right font-bold ${row.totalPnl >= 0 ? 'text-up' : 'text-down'}`
                        }
                      >
                        {signedMoney(row.totalPnl)}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
