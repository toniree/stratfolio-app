import { useEffect, useMemo, useState } from 'react'
import { BookMarked, FlaskConical, Play, Plus, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatMoney } from '@/lib/format'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/shared/PageHeader'
import { SymbolIcon } from '@/components/shared/SymbolIcon'
import { ProvenanceTag } from '@/components/shared/ProvenanceTag'
import { BacktestRunCard } from '@/components/research/BacktestRunCard'
import { SELECTION_LABEL } from '@/components/research/researchFormat'
import { usePlannerIdeas } from '@/hooks/queries'
import { usePrices } from '@/store/priceStore'
import { isResearchLive, useResearchStore } from '@/store/researchStore'
import {
  BACKTEST_PRESETS,
  BACKTEST_LIMITS,
  backtestRequestRefusal,
  findPreset,
  windowDays,
} from '@/api/researchPresets'
import type { BacktestPreset } from '@/api/researchTypes'
import { hashString, mulberry32 } from '@/lib/prng'

/**
 * The Research desk (APP-122).
 *
 * Live mode runs **real backtests**: the composer submits
 * `POST /bkt/api/v1/backtests` and the run detail renders what service-bkt
 * returned — its metrics, its §19 execution evidence, its buckets and its
 * per-trade artifacts. The in-browser engine that used to produce all of this
 * from a PRNG now lives behind the mock binding and labels every run it makes.
 *
 * Two things the desk states rather than hides:
 *  - **The library is short on purpose.** bkt's V1 universe is long single-leg
 *    CALL/PUT (DTE ≥ 1), so the ten-study library of covered calls, condors and
 *    cross-sectional momentum is gone: every one of those requests would have
 *    been rejected at bkt's API boundary (HKP-BKT-3).
 *  - **Live mode has no run history.** bkt exposes no list-backtests route and
 *    the run id exists only in the POST response, so the desk shows the runs
 *    queued in this session and says so.
 */
export function ResearchPage() {
  const runs = useResearchStore((s) => s.runs)
  const hydrate = useResearchStore((s) => s.hydrate)
  const hydrated = useResearchStore((s) => s.hydrated)
  const canListPastRuns = useResearchStore((s) => s.canListPastRuns)
  const submitError = useResearchStore((s) => s.submitError)
  const [composerOpen, setComposerOpen] = useState(false)
  const [preselect, setPreselect] = useState<string | null>(null)
  const [fidelityFilter, setFidelityFilter] = useState<'all' | BacktestPreset['fidelity']>('all')

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  const visible = useMemo(
    () =>
      fidelityFilter === 'all'
        ? runs
        : runs.filter((run) => run.request.fidelity === fidelityFilter),
    [runs, fidelityFilter],
  )

  const openComposer = (presetId?: string) => {
    setPreselect(presetId ?? null)
    setComposerOpen(true)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Research"
        subtitle="Backtests over the long single-leg universe — every run carries its own execution evidence."
        mobileTitle="Research"
        mobileSubtitle="Backtests · execution evidence"
        aside={
          <button
            type="button"
            onClick={() => openComposer()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-[12.5px] font-bold text-white transition-opacity hover:opacity-90"
          >
            <Plus size={15} strokeWidth={2.6} />
            New backtest
          </button>
        }
      />

      {submitError ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-down/30 bg-down/[0.07] px-3.5 py-2.5">
          <TriangleAlert size={14} className="mt-0.5 shrink-0 text-down" />
          <p className="text-[11px] leading-relaxed text-ink-soft">{submitError}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ---------------- runs ---------------- */}
        <section className="min-w-0 space-y-2.5">
          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
            {(['all', 'strategy-faithful', 'baseline'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFidelityFilter(value)}
                aria-pressed={fidelityFilter === value}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1.5 text-[10.5px] font-bold whitespace-nowrap transition-colors',
                  fidelityFilter === value
                    ? 'border-brand-300/40 bg-brand-400/[0.14] text-brand-200'
                    : 'border-line bg-white/[0.03] text-ink-muted hover:text-ink',
                )}
              >
                {value === 'all'
                  ? `All runs · ${runs.length}`
                  : value === 'strategy-faithful'
                    ? 'Strategy-faithful (DELTA_BAND)'
                    : 'Baseline (NEAREST_DELTA)'}
              </button>
            ))}
          </div>

          {!canListPastRuns ? (
            <p className="rounded-xl border border-line bg-white/[0.03] px-3.5 py-2 text-[10px] leading-relaxed text-ink-muted">
              This desk lists the runs queued in <span className="font-semibold">this session</span>.
              service-bkt has no list-backtests route, and a run id exists only in the response that
              created it — so an empty desk means "nothing queued here yet", never "no research has
              been run".
            </p>
          ) : null}

          {visible.map((run) => (
            <BacktestRunCard key={run.id} run={run} />
          ))}

          {visible.length === 0 ? (
            <div className="card px-5 py-10 text-center">
              <p className="text-[13.5px] font-bold text-ink">
                {hydrated ? 'No runs yet' : 'Loading runs…'}
              </p>
              <p className="mt-1 text-[11px] text-ink-muted">Queue one from the strategy library.</p>
            </div>
          ) : null}
        </section>

        {/* ---------------- library + silent tape ---------------- */}
        <div className="min-w-0 space-y-4">
          <section className="card overflow-hidden">
            <header className="flex items-center gap-1.5 border-b border-line px-3.5 py-2.5">
              <BookMarked size={13} className="text-brand-300" />
              <h2 className="text-[11px] font-extrabold tracking-[0.07em] text-ink-soft uppercase">
                Strategy library
              </h2>
              <span className="num ml-auto text-[9.5px] text-ink-muted">
                {BACKTEST_PRESETS.length} presets
              </span>
            </header>
            <div className="no-scrollbar max-h-[430px] overflow-y-auto p-2">
              {BACKTEST_PRESETS.map((preset) => (
                <PresetRow key={preset.id} preset={preset} onRun={() => openComposer(preset.id)} />
              ))}
            </div>
            <p className="border-t border-line px-3.5 py-2 text-[9.5px] leading-relaxed text-ink-muted">
              Long single-leg CALL/PUT only, DTE ≥ 1 — the universe the engine enforces at its own
              boundary. Preset parameters are read-only: they are the claim each run's evidence is
              about.
            </p>
          </section>

          <SilentTape />
        </div>
      </div>

      <NewBacktestModal open={composerOpen} onOpenChange={setComposerOpen} preselect={preselect} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Strategy library row                                                */
/* ------------------------------------------------------------------ */

function PresetRow({ preset, onRun }: { preset: BacktestPreset; onRun: () => void }) {
  return (
    <div className="group rounded-xl px-2 py-2 transition-colors hover:bg-white/[0.04]">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 text-[11.5px] leading-tight font-bold text-ink">
          {preset.name}
        </span>
        <button
          type="button"
          onClick={onRun}
          aria-label={`Run ${preset.name} backtest`}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-lg border border-brand-300/35 bg-brand-400/[0.1] text-brand-300 opacity-70 transition-all group-hover:opacity-100 hover:bg-brand-400/[0.2]"
        >
          <Play size={11} />
        </button>
      </div>
      <p className="num mt-0.5 text-[9px] font-semibold text-brand-300/80">
        {SELECTION_LABEL[preset.selection] ?? preset.selection}
      </p>
      <p className="mt-1 text-[10px] leading-snug text-ink-muted">{preset.blurb}</p>
      <p className="mt-1 text-[9px] text-ink-muted/80">{preset.source}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Silent tape — demo surface only                                     */
/* ------------------------------------------------------------------ */

/**
 * The shadow tape.
 *
 * It invents an entry price and a P/L per plan from a hash of the plan id, so
 * it renders **only in demo mode** and only over demo plans, labelled
 * `Simulated` (plan §6). In live mode nothing here is shown at all: bkt's real
 * silent trades are the portfolio's, not a research fixture, and a fabricated
 * tape beside real backtest evidence is precisely the confusion D4 exists to
 * prevent.
 */
function SilentTape() {
  const { data: plans } = usePlannerIdeas()
  const prices = usePrices()
  const live = isResearchLive()

  const fills = useMemo(() => {
    if (live) return []
    return (plans ?? [])
      .filter((plan) => plan.provenance === 'mock' || plan.provenance === undefined)
      .slice(0, 5)
      .map((plan) => {
        const rand = mulberry32(hashString(`silent:${plan.id}`))
        const quote = prices[plan.symbol]
        const daysAgo = 1 + Math.floor(rand() * 9)
        const entryDrift = 0.88 + rand() * 0.18
        const pl = quote
          ? ((quote.price * (0.96 + rand() * 0.1)) / (quote.price * entryDrift) - 1) *
            (2.2 + rand() * 2.5)
          : 0
        return {
          id: plan.id,
          symbol: plan.symbol,
          detail: plan.contractDetail ?? plan.title,
          daysAgo,
          pl,
        }
      })
  }, [live, plans, prices])

  if (live) return null

  return (
    <section className="card overflow-hidden">
      <header className="flex items-center gap-1.5 border-b border-line px-3.5 py-2.5">
        <FlaskConical size={13} className="text-[#f5c26b]" />
        <h2 className="text-[11px] font-extrabold tracking-[0.07em] text-ink-soft uppercase">
          Silent tape
        </h2>
        <ProvenanceTag provenance="mock" className="ml-auto" />
      </header>
      <div className="p-2">
        {fills.map((fill) => (
          <div
            key={fill.id}
            className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-white/[0.035]"
          >
            <SymbolIcon symbol={fill.symbol} size="xs" />
            <div className="min-w-0 flex-1">
              <div className="num truncate text-[10.5px] font-bold text-ink">
                {fill.symbol} · {fill.detail}
              </div>
              <div className="text-[9px] text-ink-muted">
                shadow-opened {fill.daysAgo}d ago · demo fixture
              </div>
            </div>
            <span
              className={cn(
                'num shrink-0 text-[11px] font-extrabold',
                fill.pl >= 0 ? 'text-up' : 'text-down',
              )}
            >
              {`${fill.pl >= 0 ? '+' : '−'}${Math.abs(fill.pl * 100).toFixed(1)}%`}
            </span>
          </div>
        ))}
        {fills.length === 0 ? (
          <p className="px-2 py-5 text-center text-[10px] text-ink-muted">
            The shadow tape is a demo surface and renders only over demo plans.
          </p>
        ) : null}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* New backtest composer                                               */
/* ------------------------------------------------------------------ */

const CAPITAL_CHOICES = [25_000, 100_000, 250_000]

/** A default window inside bkt's caps: 180 days ending yesterday. */
function defaultWindow(now = Date.now()): { start: string; end: string } {
  const end = new Date(now - 86_400_000)
  const start = new Date(end.getTime() - 179 * 86_400_000)
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

function NewBacktestModal({
  open,
  onOpenChange,
  preselect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  preselect: string | null
}) {
  const queueRun = useResearchStore((s) => s.queueRun)
  const [presetId, setPresetId] = useState(BACKTEST_PRESETS[0].id)
  const [symbolText, setSymbolText] = useState('SPY, AAPL, MSFT')
  const [window, setWindow] = useState(() => defaultWindow())
  const [capital, setCapital] = useState(100_000)
  const [submitting, setSubmitting] = useState(false)

  // Sync the picker whenever the dialog opens with a library preselection.
  const [lastPreselect, setLastPreselect] = useState<string | null>(null)
  if (open && preselect && preselect !== lastPreselect) {
    setLastPreselect(preselect)
    setPresetId(preselect)
  }
  if (!open && lastPreselect) setLastPreselect(null)

  const preset = findPreset(presetId)
  const symbols = symbolText
    .split(',')
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean)
  // The same arithmetic bkt's `validate_request` applies, so the desk refuses
  // what the service would refuse — and says which cap it hit, rather than
  // surfacing a bare 422 code after the round trip.
  const refusal = backtestRequestRefusal({ symbols, start: window.start, end: window.end })
  const days = windowDays(window.start, window.end)

  const submit = async () => {
    if (refusal || !preset) return
    setSubmitting(true)
    try {
      await queueRun({
        presetId,
        symbols,
        start: window.start,
        end: window.end,
        initialCapital: capital,
      })
    } finally {
      setSubmitting(false)
      onOpenChange(false)
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="New backtest"
      description="Pick a preset, name the symbols and the window, and the engine walks it. The preset's selection rules are fixed — they are what the run's evidence is about."
      footer={
        <button
          type="button"
          onClick={() => void submit()}
          disabled={Boolean(refusal) || submitting}
          className="w-full rounded-xl bg-brand-500 px-4 py-2.5 text-[13px] font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? 'Running…' : 'Queue backtest'}
        </button>
      }
    >
      <div className="space-y-3.5">
        <Field label="Preset">
          <div className="no-scrollbar max-h-[190px] space-y-1 overflow-y-auto pr-0.5">
            {BACKTEST_PRESETS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPresetId(item.id)}
                aria-pressed={item.id === presetId}
                className={cn(
                  'block w-full rounded-xl border px-3 py-2 text-left transition-colors',
                  item.id === presetId
                    ? 'border-brand-300/40 bg-brand-400/[0.12]'
                    : 'border-line bg-white/[0.02] hover:bg-white/[0.05]',
                )}
              >
                <span className="block text-[12px] font-bold text-ink">{item.name}</span>
                <span className="num mt-0.5 block text-[9px] font-semibold text-brand-300/80">
                  {SELECTION_LABEL[item.selection] ?? item.selection}
                </span>
              </button>
            ))}
          </div>
        </Field>

        <Field label="Symbols">
          <input
            value={symbolText}
            onChange={(event) => setSymbolText(event.target.value)}
            aria-label="Symbols"
            placeholder="SPY, AAPL, MSFT"
            className="num w-full rounded-xl border border-line bg-black/20 px-3 py-2 text-[12px] text-ink outline-none focus:border-brand-300/40"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start">
            <input
              type="date"
              value={window.start}
              onChange={(event) => setWindow((w) => ({ ...w, start: event.target.value }))}
              aria-label="Start date"
              className="num w-full rounded-xl border border-line bg-black/20 px-3 py-2 text-[12px] text-ink outline-none focus:border-brand-300/40"
            />
          </Field>
          <Field label="End">
            <input
              type="date"
              value={window.end}
              onChange={(event) => setWindow((w) => ({ ...w, end: event.target.value }))}
              aria-label="End date"
              className="num w-full rounded-xl border border-line bg-black/20 px-3 py-2 text-[12px] text-ink outline-none focus:border-brand-300/40"
            />
          </Field>
        </div>

        <Field label="Capital base">
          <div className="flex rounded-xl border border-line bg-black/20 p-0.5">
            {CAPITAL_CHOICES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setCapital(value)}
                aria-pressed={capital === value}
                className={cn(
                  'num flex-1 rounded-lg py-1.5 text-[10.5px] font-bold transition-colors',
                  capital === value ? 'bg-brand-500/25 text-brand-200' : 'text-ink-muted hover:text-ink',
                )}
              >
                {formatMoney(value, { whole: true })}
              </button>
            ))}
          </div>
        </Field>

        {preset ? (
          <div className="rounded-xl border border-line bg-white/[0.03] px-3 py-2 text-[10px] leading-relaxed text-ink-muted">
            <p className="num font-semibold text-ink-soft">
              {preset.right} ·{' '}
              {preset.targetDeltaRange
                ? `|Δ| ${preset.targetDeltaRange[0].toFixed(2)}–${preset.targetDeltaRange[1].toFixed(2)}`
                : `|Δ| ${preset.targetDelta?.toFixed(2) ?? '—'}`}{' '}
              · min OI {preset.minContractOi} · DTE {preset.minDte}–{preset.maxDte} · qty{' '}
              {preset.quantity}
            </p>
            <p className="mt-1">{preset.blurb}</p>
          </div>
        ) : null}

        {refusal ? (
          <p className="rounded-xl border border-down/30 bg-down/[0.07] px-3 py-2 text-[10px] leading-relaxed text-ink-soft">
            {refusal}
          </p>
        ) : (
          <p className="text-[9.5px] leading-relaxed text-ink-muted">
            {symbols.length} symbol{symbols.length === 1 ? '' : 's'} × {days} days ={' '}
            {symbols.length * (days ?? 0)} symbol-days. The engine runs the whole walk inside the
            request and caps it at {BACKTEST_LIMITS.maxSymbolDays}.
          </p>
        )}
      </div>
    </Modal>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[9.5px] font-extrabold tracking-[0.08em] text-ink-muted uppercase">
        {label}
      </div>
      {children}
    </div>
  )
}
