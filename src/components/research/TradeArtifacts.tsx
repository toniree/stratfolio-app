import type { TradeArtifactView, TradeQualityView } from '@/api/researchTypes'
import { MISSING } from '@/lib/format'
import { count, decimals, money, signedMoney } from '@/components/research/researchFormat'

/** Rows shown before the table scrolls; the count is always stated in full. */
const MAX_ROWS = 40

/**
 * Per-trade execution artifacts (contracts §19.3) — the run-level trade-quality
 * evidence.
 *
 * **Why this is a table of recorded values and not a block of medians.**
 * §19.4's `trade_quality` block — median capture, median MAE/MFE, median
 * fill−mid — is computed by bkt over an *experiment's* pooled out-of-sample
 * windows (`comparison_metrics["oos"]["trade_quality"]`), and a single backtest
 * run does not carry it. Nor could this component derive it: bkt exposes `pnl`,
 * `capture_ratio` and `holding_days` as Python properties, which
 * `model_dump()` never serialises, so a browser-side "median capture" would
 * mean re-implementing contract arithmetic in floating point and printing the
 * result beside bkt's own exact-Decimal metrics — two numbers, one name, free
 * to disagree. What a run *does* record is every input to those medians, per
 * trade, and that is what this shows.
 *
 * The columns are the ones §19.3 exists for: what crossing the spread cost
 * (`fill − mid`), whether the fill respected the band derived from the decision
 * session (`excess`, negative when it landed below), how far the trade ran
 * before it closed (MFE/MAE, and how many sessions it took to get there), and
 * the entry delta the delta buckets are built from. Every one of them is
 * optional; a legacy run has no band columns because it had no decision→fill
 * gap, and a provider with no greeks leaves the delta blank rather than 0.
 */
export function TradeArtifacts({
  trades,
  tradeQuality,
}: {
  trades: TradeArtifactView[]
  /** bkt's own pooled block, when the result carries one. */
  tradeQuality?: TradeQualityView
}) {
  return (
    <section className="rounded-xl border border-line bg-white/[0.02]">
      <header className="flex flex-wrap items-baseline gap-2 border-b border-line px-3 py-2">
        <h4 className="text-[10px] font-extrabold tracking-[0.06em] text-ink-soft uppercase">
          Trade quality · per-trade artifacts
        </h4>
        <span className="num text-[9px] text-ink-muted">{trades.length} trades</span>
      </header>

      {tradeQuality ? <PooledQuality quality={tradeQuality} /> : null}

      {trades.length === 0 ? (
        <p className="px-3 py-3 text-[10px] text-ink-muted">
          This run recorded no trades. Check the execution panel — entries may have been attempted
          and refused.
        </p>
      ) : (
        <>
          <div className="no-scrollbar max-h-[280px] overflow-auto">
            <table className="w-full min-w-[620px] text-left">
              <thead className="sticky top-0 bg-[#0b0d12]">
                <tr className="text-[8.5px] font-extrabold tracking-[0.06em] text-ink-muted uppercase">
                  <th className="px-3 py-1.5">Contract</th>
                  <th className="px-3 py-1.5 text-right">|Δ| entry</th>
                  <th className="px-3 py-1.5 text-right">Fill</th>
                  <th className="px-3 py-1.5 text-right">Fill − mid</th>
                  <th className="px-3 py-1.5 text-right">Excess vs band</th>
                  <th className="px-3 py-1.5 text-right">MFE</th>
                  <th className="px-3 py-1.5 text-right">MAE</th>
                  <th className="px-3 py-1.5 text-right">Sessions→MFE</th>
                  <th className="px-3 py-1.5">Exit</th>
                </tr>
              </thead>
              <tbody className="num text-[10px]">
                {trades.slice(0, MAX_ROWS).map((trade, index) => (
                  <tr key={`${trade.occSymbol}-${trade.entryTime}-${index}`} className="border-t border-line/50">
                    <td className="px-3 py-1.5 font-bold text-ink">{trade.occSymbol}</td>
                    <td className="px-3 py-1.5 text-right text-ink-soft">
                      {decimals(trade.entryDelta)}
                    </td>
                    <td className="px-3 py-1.5 text-right text-ink-soft">{money(trade.entryPrice)}</td>
                    <td className="px-3 py-1.5 text-right text-ink-soft">
                      {trade.fillMinusMid === undefined ? MISSING : signedMoney(trade.fillMinusMid)}
                    </td>
                    <td className="px-3 py-1.5 text-right text-ink-soft">
                      {trade.excess === undefined ? MISSING : signedMoney(trade.excess)}
                    </td>
                    <td className="px-3 py-1.5 text-right text-up">{signedMoney(trade.mfe)}</td>
                    <td className="px-3 py-1.5 text-right text-down">{signedMoney(trade.mae)}</td>
                    <td className="px-3 py-1.5 text-right text-ink-soft">
                      {count(trade.sessionsToMfe)}
                    </td>
                    <td className="px-3 py-1.5 text-ink-soft">{trade.exitReason ?? 'open'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {trades.length > MAX_ROWS ? (
            <p className="border-t border-line/60 px-3 py-1.5 text-[9.5px] text-ink-muted">
              Showing the first {MAX_ROWS} of {trades.length} trades.
            </p>
          ) : null}
        </>
      )}

      {tradeQuality ? null : (
        <p className="border-t border-line/60 px-3 py-2 text-[9.5px] leading-relaxed text-ink-muted">
          Pooled medians — median capture (realised P/L ÷ MFE), median MAE/MFE and median fill − mid
          — are reported by bkt for an <span className="font-semibold">experiment</span>, over its
          pooled out-of-sample windows (contracts §19.4). A single run carries the artifacts above,
          not the medians, and the app does not compute them here.
        </p>
      )}
    </section>
  )
}

/**
 * bkt's pooled block, rendered as bkt states it.
 *
 * Every figure is missing-with-a-note when its sample was empty — "no closed
 * trade had a positive MFE: there was no run-up to capture" is a finding, and a
 * 0.00 median capture in its place would be a different one. The trades
 * excluded from the capture median are shown as a count, never folded in.
 */
function PooledQuality({ quality }: { quality: TradeQualityView }) {
  return (
    <div className="border-b border-line/60 px-3 py-2.5">
      <div className="text-[8.5px] font-extrabold tracking-[0.06em] text-ink-muted uppercase">
        Pooled trade quality · out-of-sample
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
        <Figure
          label="Median capture"
          value={decimals(quality.medianCapture)}
          note={quality.captureNote}
        />
        <Figure label="Median MFE" value={signedMoney(quality.medianMfe)} />
        <Figure label="Median MAE" value={signedMoney(quality.medianMae)} />
        <Figure
          label="Median fill − mid"
          value={signedMoney(quality.medianFillMinusMid)}
          note={quality.fillMinusMidNote}
        />
      </div>
      {quality.captureExcludedNonPositiveMfe !== undefined &&
      quality.captureExcludedNonPositiveMfe > 0 ? (
        <p className="mt-1.5 text-[9.5px] leading-relaxed text-ink-muted">
          {quality.captureExcludedNonPositiveMfe} closed trade
          {quality.captureExcludedNonPositiveMfe === 1 ? '' : 's'} had no positive MFE and{' '}
          {quality.captureExcludedNonPositiveMfe === 1 ? 'is' : 'are'} excluded from the capture
          median — counted, not folded in as zero.
        </p>
      ) : null}
    </div>
  )
}

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="min-w-0" title={note}>
      <div className="text-[8.5px] font-extrabold tracking-[0.06em] text-ink-muted uppercase">
        {label}
      </div>
      <div className="num mt-0.5 truncate text-[12px] font-extrabold text-ink">{value}</div>
      {note ? <p className="mt-0.5 text-[9px] leading-snug text-ink-muted">{note}</p> : null}
    </div>
  )
}
