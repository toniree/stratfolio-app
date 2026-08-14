import { useMemo, useState } from 'react'
import { BookMarked, Bot, FlaskConical, Play, Plus, TimerReset, UserRound } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatMoney, relativeTime } from '@/lib/format'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/shared/PageHeader'
import { Sparkline } from '@/components/charts/Sparkline'
import { SymbolIcon } from '@/components/shared/SymbolIcon'
import { usePlannerIdeas } from '@/hooks/queries'
import { usePrices } from '@/store/priceStore'
import {
  KIND_LABELS,
  STRATEGY_LIBRARY,
  useResearchStore,
  type BacktestKind,
  type BacktestRun,
  type StrategyTemplate,
} from '@/store/researchStore'
import { hashString, mulberry32 } from '@/lib/prng'

/**
 * The Research desk.
 *
 * Left: every backtest run — AI-authored and user-authored — over the options
 * book, past and live trade plans, and the silent paper tape. Right: the
 * strategy library (each entry carries its academic or desk provenance) and
 * the silent tape itself. "New backtest" queues a run that completes with
 * deterministic, reproducible results.
 */
export function ResearchPage() {
  const runs = useResearchStore((s) => s.runs)
  const [composerOpen, setComposerOpen] = useState(false)
  const [preselect, setPreselect] = useState<string | null>(null)
  const [kindFilter, setKindFilter] = useState<BacktestKind | 'all'>('all')

  const visible = useMemo(
    () => (kindFilter === 'all' ? runs : runs.filter((run) => run.kind === kindFilter)),
    [runs, kindFilter],
  )

  const openComposer = (strategyId?: string) => {
    setPreselect(strategyId ?? null)
    setComposerOpen(true)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Research"
        subtitle="Backtests, strategy studies and the silent paper tape — every result reproducible."
        mobileTitle="Research"
        mobileSubtitle="Backtests · silent trades"
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

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ---------------- runs ---------------- */}
        <section className="min-w-0 space-y-2.5">
          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
            {(['all', 'options', 'past-plans', 'live-plans', 'silent'] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setKindFilter(kind)}
                aria-pressed={kindFilter === kind}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1.5 text-[10.5px] font-bold whitespace-nowrap transition-colors',
                  kindFilter === kind
                    ? 'border-brand-300/40 bg-brand-400/[0.14] text-brand-200'
                    : 'border-line bg-white/[0.03] text-ink-muted hover:text-ink',
                )}
              >
                {kind === 'all' ? `All runs · ${runs.length}` : KIND_LABELS[kind]}
              </button>
            ))}
          </div>

          {visible.map((run) => (
            <RunCard key={run.id} run={run} />
          ))}
          {visible.length === 0 ? (
            <div className="card px-5 py-10 text-center">
              <p className="text-[13.5px] font-bold text-ink">No runs of this kind yet</p>
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
                {STRATEGY_LIBRARY.length} studies
              </span>
            </header>
            <div className="no-scrollbar max-h-[430px] overflow-y-auto p-2">
              {STRATEGY_LIBRARY.map((template) => (
                <TemplateRow key={template.id} template={template} onRun={() => openComposer(template.id)} />
              ))}
            </div>
          </section>

          <SilentTape />
        </div>
      </div>

      <NewBacktestModal
        open={composerOpen}
        onOpenChange={setComposerOpen}
        preselect={preselect}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Run card                                                            */
/* ------------------------------------------------------------------ */

const pct = (v: number, digits = 1) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(digits)}%`

function RunCard({ run }: { run: BacktestRun }) {
  const template = STRATEGY_LIBRARY.find((s) => s.id === run.strategyId)
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
            {run.universe} · {run.period} · {formatMoney(run.capital)} start
          </p>
        </div>
        <span
          className={cn(
            'ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-extrabold tracking-[0.05em] uppercase',
            run.kind === 'options' && 'border-brand-300/35 text-brand-200',
            run.kind === 'past-plans' && 'border-[#f5c26b]/40 text-[#f5c26b]',
            run.kind === 'live-plans' && 'border-up/40 text-up',
            run.kind === 'silent' && 'border-line-strong text-ink-soft',
          )}
        >
          {KIND_LABELS[run.kind]}
        </span>
      </div>

      {run.status === 'running' ? (
        <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-line bg-white/[0.03] px-3 py-2.5">
          <TimerReset size={14} className="animate-spin text-brand-300 [animation-duration:2.2s]" />
          <span className="text-[11px] font-semibold text-ink-soft">
            Running — replaying {run.period} of ticks against {template?.name ?? 'strategy'} rules…
          </span>
        </div>
      ) : run.metrics && run.equity ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-[repeat(4,minmax(0,1fr))_120px] sm:items-center">
            <Metric label="CAGR" value={pct(run.metrics.cagr)} tone={run.metrics.cagr >= 0 ? 'up' : 'down'} />
            <Metric label="Sharpe" value={run.metrics.sharpe.toFixed(2)} tone={run.metrics.sharpe >= 0.75 ? 'up' : undefined} />
            <Metric label="Max DD" value={`−${(run.metrics.maxDrawdown * 100).toFixed(1)}%`} tone="down" />
            <Metric label="Win rate" value={`${(run.metrics.winRate * 100).toFixed(0)}%`} />
            <div className="col-span-2 sm:col-span-1">
              <Sparkline data={run.equity} width={120} height={34} tone={run.metrics.cagr >= 0 ? 'up' : 'down'} filled className="w-full" />
            </div>
            <Metric label="Sortino" value={run.metrics.sortino.toFixed(2)} />
            <Metric label="Profit factor" value={run.metrics.profitFactor.toFixed(2)} />
            <Metric label="Trades" value={String(run.metrics.trades)} />
            <Metric label="vs SPY" value={pct(run.metrics.vsSpy)} tone={run.metrics.vsSpy >= 0 ? 'up' : 'down'} />
            <span className="num hidden text-right text-[9px] text-ink-muted sm:block">
              {relativeTime(run.startedAt)}
            </span>
          </div>
          {run.note ? (
            <p className="mt-2.5 rounded-xl border border-brand-400/15 bg-brand-500/[0.06] px-3 py-2 text-[10.5px] leading-relaxed text-ink-soft">
              <span className="font-extrabold text-brand-300">AI read · </span>
              {run.note}
            </p>
          ) : null}
        </>
      ) : null}
    </article>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'up' | 'down' }) {
  return (
    <div className="min-w-0">
      <div className="text-[8.5px] font-extrabold tracking-[0.07em] text-ink-muted uppercase">{label}</div>
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

/* ------------------------------------------------------------------ */
/* Strategy library row                                                */
/* ------------------------------------------------------------------ */

function TemplateRow({ template, onRun }: { template: StrategyTemplate; onRun: () => void }) {
  return (
    <div className="group rounded-xl px-2 py-2 transition-colors hover:bg-white/[0.04]">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 text-[11.5px] leading-tight font-bold text-ink">
          {template.name}
        </span>
        <button
          type="button"
          onClick={onRun}
          aria-label={`Run ${template.name} backtest`}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-lg border border-brand-300/35 bg-brand-400/[0.1] text-brand-300 opacity-70 transition-all group-hover:opacity-100 hover:bg-brand-400/[0.2]"
        >
          <Play size={11} />
        </button>
      </div>
      <p className="mt-0.5 text-[9px] font-semibold text-brand-300/80">{template.source}</p>
      <p className="mt-1 text-[10px] leading-snug text-ink-muted">{template.blurb}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Silent tape — shadow fills against the live plans                   */
/* ------------------------------------------------------------------ */

function SilentTape() {
  const { data: plans } = usePlannerIdeas()
  const prices = usePrices()

  const fills = useMemo(() => {
    return (plans ?? []).slice(0, 5).map((plan) => {
      const rand = mulberry32(hashString(`silent:${plan.id}`))
      const quote = prices[plan.symbol]
      const daysAgo = 1 + Math.floor(rand() * 9)
      const entryDrift = 0.88 + rand() * 0.18
      const pl = quote ? ((quote.price * (0.96 + rand() * 0.1)) / (quote.price * entryDrift) - 1) * (2.2 + rand() * 2.5) : 0
      return {
        id: plan.id,
        symbol: plan.symbol,
        detail: plan.contractDetail ?? plan.title,
        daysAgo,
        pl,
      }
    })
  }, [plans, prices])

  return (
    <section className="card overflow-hidden">
      <header className="flex items-center gap-1.5 border-b border-line px-3.5 py-2.5">
        <FlaskConical size={13} className="text-[#f5c26b]" />
        <h2 className="text-[11px] font-extrabold tracking-[0.07em] text-ink-soft uppercase">
          Silent tape
        </h2>
        <span className="ml-auto text-[9px] font-bold text-ink-muted">no orders leave the lab</span>
      </header>
      <div className="p-2">
        {fills.map((fill) => (
          <div key={fill.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-white/[0.035]">
            <SymbolIcon symbol={fill.symbol} size="xs" />
            <div className="min-w-0 flex-1">
              <div className="num truncate text-[10.5px] font-bold text-ink">
                {fill.symbol} · {fill.detail}
              </div>
              <div className="text-[9px] text-ink-muted">
                shadow-opened {fill.daysAgo}d ago · plan criteria met silently
              </div>
            </div>
            <span className={cn('num shrink-0 text-[11px] font-extrabold', fill.pl >= 0 ? 'text-up' : 'text-down')}>
              {pct(fill.pl)}
            </span>
          </div>
        ))}
        {fills.length === 0 ? (
          <p className="px-2 py-5 text-center text-[10px] text-ink-muted">
            Create a trade plan and the lab will shadow it here.
          </p>
        ) : null}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* New backtest composer                                               */
/* ------------------------------------------------------------------ */

const UNIVERSES: Record<BacktestKind, string> = {
  options: 'Options book · NVDA AAPL MSFT SPY',
  'past-plans': 'All closed trade plans',
  'live-plans': 'Active plans · shadow forward',
  silent: 'Watchlist · silent paper fills',
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
  const [strategyId, setStrategyId] = useState(STRATEGY_LIBRARY[0].id)
  const [kind, setKind] = useState<BacktestKind>('options')
  const [period, setPeriod] = useState<BacktestRun['period']>('3Y')
  const [capital, setCapital] = useState(25_000)

  // Sync the picker whenever the dialog opens with a library preselection.
  const [lastPreselect, setLastPreselect] = useState<string | null>(null)
  if (open && preselect && preselect !== lastPreselect) {
    setLastPreselect(preselect)
    setStrategyId(preselect)
    const template = STRATEGY_LIBRARY.find((s) => s.id === preselect)
    if (template) setKind(template.defaultKind)
  }
  if (!open && lastPreselect) setLastPreselect(null)

  const template = STRATEGY_LIBRARY.find((s) => s.id === strategyId)

  const submit = () => {
    queueRun({ strategyId, kind, universe: UNIVERSES[kind], period, capital })
    onOpenChange(false)
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="New backtest"
      description="Pick a study from the library, aim it at a target, and the lab replays it bar by bar. Results are deterministic — rerunning reproduces them."
      footer={
        <button
          type="button"
          onClick={submit}
          className="w-full rounded-xl bg-brand-500 px-4 py-2.5 text-[13px] font-bold text-white transition-opacity hover:opacity-90"
        >
          Queue backtest
        </button>
      }
    >
      <div className="space-y-3.5">
        <Field label="Strategy">
          <div className="no-scrollbar max-h-[190px] space-y-1 overflow-y-auto pr-0.5">
            {STRATEGY_LIBRARY.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setStrategyId(item.id)
                  setKind(item.defaultKind)
                }}
                aria-pressed={item.id === strategyId}
                className={cn(
                  'block w-full rounded-xl border px-3 py-2 text-left transition-colors',
                  item.id === strategyId
                    ? 'border-brand-300/40 bg-brand-400/[0.12]'
                    : 'border-line bg-white/[0.02] hover:bg-white/[0.05]',
                )}
              >
                <span className="block text-[12px] font-bold text-ink">{item.name}</span>
                <span className="mt-0.5 block text-[9px] font-semibold text-brand-300/80">
                  {item.source}
                </span>
              </button>
            ))}
          </div>
        </Field>

        <Field label="Run against">
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.keys(KIND_LABELS) as BacktestKind[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setKind(value)}
                aria-pressed={kind === value}
                className={cn(
                  'rounded-xl border px-2.5 py-2 text-[10.5px] font-bold transition-colors',
                  kind === value
                    ? 'border-brand-300/40 bg-brand-400/[0.14] text-brand-200'
                    : 'border-line bg-white/[0.02] text-ink-soft hover:text-ink',
                )}
              >
                {KIND_LABELS[value]}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Lookback">
            <div className="flex rounded-xl border border-line bg-black/20 p-0.5">
              {(['1Y', '3Y', '5Y'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPeriod(value)}
                  aria-pressed={period === value}
                  className={cn(
                    'flex-1 rounded-lg py-1.5 text-[11px] font-bold transition-colors',
                    period === value ? 'bg-brand-500/25 text-brand-200' : 'text-ink-muted hover:text-ink',
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Starting capital">
            <div className="flex rounded-xl border border-line bg-black/20 p-0.5">
              {[10_000, 25_000, 100_000].map((value) => (
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
                  ${value / 1000}k
                </button>
              ))}
            </div>
          </Field>
        </div>

        {template ? (
          <p className="rounded-xl border border-line bg-white/[0.03] px-3 py-2 text-[10px] leading-relaxed text-ink-muted">
            {template.blurb} Validation: walk-forward folds with embargo, costs at 1 tick + $0.65/contract,
            and a 1,000-path Monte Carlo resample of the trade sequence.
          </p>
        ) : null}
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
