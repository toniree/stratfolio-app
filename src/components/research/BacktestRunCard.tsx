import { useState } from 'react'
import { Bot, ChevronDown, TimerReset, TriangleAlert, UserRound } from 'lucide-react'
import type { BacktestExecutionView, BacktestRunView } from '@/api/researchTypes'
import { cn } from '@/lib/cn'
import { MISSING, formatMoney, relativeTime } from '@/lib/format'
import { ProvenanceTag } from '@/components/shared/ProvenanceTag'
import { Sparkline } from '@/components/charts/Sparkline'
import { BucketTable } from '@/components/research/BucketTable'
import { ExecutionEvidence } from '@/components/research/ExecutionEvidence'
import { RunDisclosures } from '@/components/research/RunDisclosures'
import { RunParameters } from '@/components/research/RunParameters'
import { TradeArtifacts } from '@/components/research/TradeArtifacts'
import {
  SELECTION_LABEL,
  count,
  decimals,
  ratioPercent,
  signedMoney,
  signedRatioPercent,
} from '@/components/research/researchFormat'

/**
 * One backtest run (APP-122).
 *
 * A run carries exactly one body of evidence and the card renders the one it
 * has: `result` is what service-bkt returned — realised P/L, a win rate over
 * closed trades, the §19 execution and bucket evidence — and `simulated` is the
 * demo engine's shaped CAGR/Sharpe/equity curve, which exists only in mock mode
 * and is labelled `Simulated`. They are never mixed, because they are not the
 * same quantities: bkt's `total_pnl` is dollars over simulated option trades,
 * not a portfolio return, and the demo curve is not a measurement at all.
 */
export function BacktestRunCard({ run }: { run: BacktestRunView }) {
  const [open, setOpen] = useState(false)
  const result = run.result

  return (
    <article className="card p-3.5 sm:p-4">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span
          className={cn(
            'grid h-7 w-7 shrink-0 place-items-center rounded-lg',
            run.createdBy === 'ai' ? 'bg-brand-500/15 text-brand-300' : 'bg-white/[0.06] text-ink-soft',
          )}
          title={run.createdBy === 'ai' ? 'AI-generated study' : 'Your study'}
        >
          {run.createdBy === 'ai' ? <Bot size={14} /> : <UserRound size={14} />}
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-[13px] leading-tight font-bold text-ink">{run.name}</h3>
          <p className="num mt-0.5 truncate text-[10px] text-ink-muted">
            {run.request.symbols.join(' · ')} · {run.request.start} → {run.request.end} ·{' '}
            {formatMoney(run.request.initialCapital, { whole: true })} base
          </p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <ProvenanceTag provenance={run.provenance} />
          <span
            className="rounded-full border border-brand-300/35 px-2 py-0.5 text-[9px] font-extrabold tracking-[0.05em] text-brand-200 uppercase"
            title={SELECTION_LABEL[run.request.selection] ?? run.request.selection}
          >
            {run.request.fidelity === 'strategy-faithful' ? 'Strategy-faithful' : 'Baseline'}
          </span>
          {/* A legacy run's fill rate is not comparable with a two-quote run's,
              and bkt refuses to pool them — so the card says which it is. */}
          {result?.legacy ? (
            <span
              className="rounded-full border border-[#f5c26b]/40 px-2 py-0.5 text-[9px] font-extrabold tracking-[0.05em] text-[#f5c26b] uppercase"
              title={`Legacy protocol: ${result.fillProtocol ?? 'unstated'}. Decision and fill share one quote, so realized entries are overstated relative to a two-quote run (§19.1).`}
            >
              Legacy protocol
            </span>
          ) : null}
        </div>
      </div>

      {run.status === 'running' ? (
        <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-line bg-white/[0.03] px-3 py-2.5">
          <TimerReset size={14} className="animate-spin text-brand-300 [animation-duration:2.2s]" />
          <span className="text-[11px] font-semibold text-ink-soft">
            Running — the engine walks the window inside the request; the desk holds until it
            answers.
          </span>
        </div>
      ) : run.status === 'failed' ? (
        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-down/30 bg-down/[0.07] px-3 py-2.5">
          <TriangleAlert size={14} className="mt-0.5 shrink-0 text-down" />
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-ink">This run did not complete</p>
            {/* The service's own words: "something went wrong" is not evidence. */}
            <p className="mt-0.5 text-[10.5px] leading-relaxed break-words text-ink-soft">
              {run.error ?? 'bkt recorded no reason.'}
            </p>
            <p className="num mt-1 text-[9.5px] text-ink-muted">run {run.id}</p>
          </div>
        </div>
      ) : result ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-5">
            <Metric label="Trades" value={count(result.metrics.tradeCount)} />
            <Metric
              label="Win rate"
              value={ratioPercent(result.metrics.winRate, 0)}
              tone={result.metrics.winRate !== undefined && result.metrics.winRate >= 0.5 ? 'up' : undefined}
            />
            <Metric
              label="Total P/L"
              value={signedMoney(result.metrics.totalPnl)}
              tone={
                result.metrics.totalPnl === undefined
                  ? undefined
                  : result.metrics.totalPnl >= 0
                    ? 'up'
                    : 'down'
              }
            />
            <Metric label="Expectancy" value={signedMoney(result.metrics.expectancy)} />
            <Metric
              label="Max drawdown"
              value={signedMoney(result.metrics.maxDrawdownMarked ?? result.metrics.maxDrawdownRealized)}
              tone="down"
              // The basis travels with the number: a marked drawdown and a
              // realised fold are different measurements (§11.12).
              hint={
                result.metrics.drawdownBasis
                  ? `basis: ${result.metrics.drawdownBasis}`
                  : 'bkt did not state a drawdown basis for this run.'
              }
            />
          </div>

          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-5">
            <Metric
              label="CAGR (v2)"
              value={signedRatioPercent(result.returns?.cagr)}
              hint={result.returns?.cagrNote ?? result.returns?.note}
            />
            <Metric
              label="Sharpe (ann.)"
              value={decimals(result.returns?.sharpeAnnualized)}
              hint={
                result.returns?.sharpeNote ??
                result.returns?.note ??
                (result.returns?.sharpeBasis
                  ? `${result.returns.sharpeBasis}, ${result.returns.nDays ?? '?'} sessions`
                  : undefined)
              }
            />
            <Metric
              label="Sharpe (per trade)"
              value={decimals(result.metrics.sharpeRatio)}
              hint={result.metrics.sharpeNote}
            />
            <Metric
              label="Fill rate"
              value={fillRate(result.execution)}
              hint={
                result.execution
                  ? 'entries_filled ÷ entries_attempted, from the run’s own execution block.'
                  : 'This run records no execution block (pre-BKT-020).'
              }
            />
            <span className="num hidden self-end text-right text-[9px] text-ink-muted sm:block">
              {relativeTime(run.startedAt)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-line bg-white/[0.03] px-2.5 py-1.5 text-[10.5px] font-bold text-ink-soft transition-colors hover:text-ink"
          >
            <ChevronDown size={13} className={cn('transition-transform', open && 'rotate-180')} />
            {open ? 'Hide evidence' : 'Evidence — execution, buckets, artifacts'}
          </button>

          {open ? (
            <div className="mt-2.5 space-y-2.5">
              <RunParameters request={run.request} />

              <ExecutionEvidence
                execution={result.execution}
                noFillEvents={result.noFillEvents}
                pendingEntriesAtWindowEnd={result.pendingEntriesAtWindowEnd}
              />

              <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                <BucketTable
                  title="By delta bucket"
                  caption="|Δ| at entry · unknown is a real bucket"
                  rows={result.buckets.byDelta}
                  unavailable={result.bucketsUnavailable}
                />
                <BucketTable title="By ticker" rows={result.buckets.byTicker} unavailable={result.bucketsUnavailable} />
                <BucketTable
                  title="By exit reason"
                  rows={result.buckets.byExitReason}
                  unavailable={result.bucketsUnavailable}
                />
                <BucketTable
                  title="By DTE bucket"
                  caption="unthresholded — pre-§19 meaning preserved"
                  rows={result.buckets.byDte}
                />
              </div>

              <TradeArtifacts trades={result.trades} tradeQuality={result.tradeQuality} />

              {result.baselines ? <Baselines baselines={result.baselines} /> : null}

              <RunDisclosures disclosures={result.disclosures} />

              <p className="num text-[9px] text-ink-muted">
                engine {result.engineId ?? MISSING} v{result.engineVersion ?? MISSING}
                {result.datasetRef?.provider ? ` · ${result.datasetRef.provider}` : ''}
                {result.datasetRef?.datasetId ? ` · ${result.datasetRef.datasetId}` : ''}
                {result.datasetRef?.mixedProvenance ? ' · mixed provenance' : ''}
                {result.datasetRef?.requestHash
                  ? ` · request ${result.datasetRef.requestHash.slice(0, 12)}`
                  : ''}
              </p>
            </div>
          ) : null}
        </>
      ) : run.simulated ? (
        <SimulatedSummary run={run} />
      ) : (
        <p className="mt-3 text-[10.5px] text-ink-muted">
          This run reports no result body. Nothing is inferred from its absence.
        </p>
      )}
    </article>
  )
}

/**
 * The demo engine's own summary (mock mode).
 *
 * Kept visually distinct and labelled: these are a PRNG's numbers, shaped from
 * the preset's id, and they are not comparable with a bkt run's — which is why
 * they never share a field with one.
 */
function SimulatedSummary({ run }: { run: BacktestRunView }) {
  const simulated = run.simulated
  if (!simulated) return null
  return (
    <>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-[repeat(4,minmax(0,1fr))_120px] sm:items-center">
        <Metric
          label="CAGR"
          value={signedRatioPercent(simulated.cagr)}
          tone={simulated.cagr >= 0 ? 'up' : 'down'}
        />
        <Metric label="Sharpe" value={simulated.sharpe.toFixed(2)} />
        <Metric label="Max DD" value={`−${(simulated.maxDrawdown * 100).toFixed(1)}%`} tone="down" />
        <Metric label="Win rate" value={ratioPercent(simulated.winRate, 0)} />
        <div className="col-span-2 sm:col-span-1">
          <Sparkline
            data={simulated.equity}
            width={120}
            height={34}
            tone={simulated.cagr >= 0 ? 'up' : 'down'}
            filled
            className="w-full"
          />
        </div>
        <Metric label="Sortino" value={simulated.sortino.toFixed(2)} />
        <Metric label="Profit factor" value={simulated.profitFactor.toFixed(2)} />
        <Metric label="Trades" value={String(simulated.trades)} />
        <Metric label="vs SPY" value={signedRatioPercent(simulated.vsSpy)} />
        <span className="num hidden text-right text-[9px] text-ink-muted sm:block">
          {relativeTime(run.startedAt)}
        </span>
      </div>
      <p className="mt-2.5 rounded-xl border border-line bg-white/[0.03] px-3 py-2 text-[10.5px] leading-relaxed text-ink-soft">
        <span className="font-extrabold text-ink-muted">Demo engine · </span>
        {simulated.note}
      </p>
    </>
  )
}

function Baselines({
  baselines,
}: {
  baselines: NonNullable<BacktestRunView['result']>['baselines']
}) {
  if (!baselines) return null
  const random = baselines.randomEntry
  return (
    <section className="rounded-xl border border-line bg-white/[0.02] px-3 py-2.5">
      <h4 className="text-[10px] font-extrabold tracking-[0.06em] text-ink-soft uppercase">
        Baselines
      </h4>
      {baselines.note ? (
        <p className="mt-1 text-[10px] text-ink-muted">{baselines.note}</p>
      ) : null}
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
        <Metric label="No trade" value={signedMoney(baselines.noTradeTotalPnl)} />
        <Metric
          label="Buy & hold"
          value={signedRatioPercent(baselines.buyAndHold?.totalReturn)}
          hint={baselines.buyAndHold?.note ?? baselines.buyAndHold?.cagrNote}
        />
        <Metric
          label="Random entry · p50"
          value={signedMoney(random?.totalPnlP50)}
          hint={random?.note ?? (random?.n ? `${random.n} draws, ${random.entries ?? '?'} entries each` : undefined)}
        />
        <Metric
          label="Strategy percentile"
          value={ratioPercent(random?.strategyTotalPnlPercentile, 0)}
          hint="Share of the random-entry draws this run's total P/L beat."
        />
      </div>
    </section>
  )
}

/**
 * `entries_filled ÷ entries_attempted`, or nothing.
 *
 * Both halves have to be present and the denominator non-zero: a run that
 * attempted no entry has no fill rate, and rendering one as 100% (or 0%) would
 * be the client inventing the very number §19.4 is careful never to state.
 */
function fillRate(execution: BacktestExecutionView | undefined): string {
  if (!execution) return MISSING
  const { entriesAttempted, entriesFilled } = execution
  if (entriesAttempted === undefined || entriesFilled === undefined || entriesAttempted === 0) {
    return MISSING
  }
  return ratioPercent(entriesFilled / entriesAttempted, 0)
}

function Metric({
  label,
  value,
  tone,
  hint,
}: {
  label: string
  value: string
  tone?: 'up' | 'down'
  hint?: string
}) {
  return (
    <div className="min-w-0" title={hint}>
      <div className="text-[8.5px] font-extrabold tracking-[0.07em] text-ink-muted uppercase">
        {label}
      </div>
      <div
        className={cn(
          'num mt-0.5 truncate text-[13px] font-extrabold',
          tone === 'up' ? 'text-up' : tone === 'down' ? 'text-down' : 'text-ink',
        )}
      >
        {value}
      </div>
    </div>
  )
}
