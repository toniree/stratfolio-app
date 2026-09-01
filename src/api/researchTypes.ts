import type { Provenance } from '@/api/types'

/**
 * Research / backtests — the view models (APP-122).
 *
 * These mirror what **service-bkt actually returns** for one run
 * (`backtest/models.py::BacktestResult`, `backtest/metrics.py`, contracts §11
 * and §19) and nothing else. Three consequences worth stating up front,
 * because they shape every field below:
 *
 *  1. **Everything §19 added is optional.** A run recorded before BKT-020/021,
 *     or one submitted as `single_quote_legacy`, carries no band artifacts, no
 *     delta/ticker/exit-reason buckets and no `metrics["execution"]`. Those
 *     panels then render an explicit absence plus a legacy tag — never a zero.
 *  2. **A thin bucket is not an empty one.** bkt fails closed below five
 *     trades: it reports the real `trade_count` and nulls every ratio, with a
 *     note saying why (§19.4). `BucketRow` keeps that shape exactly, so the UI
 *     can say "insufficient data (n=3)" instead of "0% win rate" (D4).
 *  3. **The demo engine's numbers are a different quantity.** bkt reports
 *     realised P/L, win rate and a fill rate over simulated option trades; the
 *     in-browser demo engine shapes a CAGR/Sharpe/equity curve out of a PRNG.
 *     They do not belong in the same fields, so they are two optional blocks —
 *     `result` (live) and `simulated` (mock, labelled) — and a run has one.
 */

/** Which entry rule picked the contract — `EntryRule.selection` (§19.2). */
export type ContractSelectionMode = 'DELTA_BAND' | 'NEAREST_DELTA' | 'OTM_PCT'

/** `BacktestRequest.fill_protocol` (§19.1). Unknown values pass through as-is:
 *  a protocol this build has never heard of must still be shown, not hidden. */
export type FillProtocol = 'two_quote_band' | 'single_quote_legacy'

export type OptionRight = 'CALL' | 'PUT'

/**
 * One library preset — a *complete* `BacktestRequest.params` shape minus the
 * symbols and window the user chooses.
 *
 * The library is deliberately short (APP-122 / HKP-BKT-3): bkt's V1 universe is
 * long single-leg CALL/PUT, DTE ≥ 1, and a preset that cannot be expressed as
 * one is not a study this product can run. Its parameters are **read-only** —
 * they are the claim the run's evidence is about, not a form.
 */
export interface BacktestPreset {
  id: string
  name: string
  /** Where the rule comes from — a contracts section or an ai module, since
   *  every preset here mirrors something the shipping system actually does. */
  source: string
  blurb: string
  right: OptionRight
  selection: ContractSelectionMode
  /** How to describe this selection mode to a reader (§19.2): `DELTA_BAND` is
   *  the mode an ai submission uses; `NEAREST_DELTA` stays the baseline. */
  fidelity: 'strategy-faithful' | 'baseline'
  /** Inclusive |delta| band — `DELTA_BAND` only, and required there. */
  targetDeltaRange?: readonly [number, number]
  /** Point |delta| target — `NEAREST_DELTA` only, and required there. */
  targetDelta?: number
  /** Open-interest floor. Must be *stated* under `DELTA_BAND`; 0 is a fine
   *  answer, an absent one is not (§19.2). */
  minContractOi: number
  minDte: number
  maxDte: number
  quantity: number
  /** Fractions of entry premium, never percent points (§7.1 / §12.3). */
  profitTargetPct?: number
  stopLossPct?: number
  maxHoldingDays?: number
  forceCloseDte: number
}

/** What the composer collects. Everything else comes from the preset. */
export interface QueueBacktestInput {
  presetId: string
  symbols: string[]
  /** `YYYY-MM-DD`, event time (contracts §1). */
  start: string
  end: string
  initialCapital: number
}

/**
 * The request as it was sent, echoed back for the run detail.
 *
 * Shown read-only. A reader has to be able to see which contract-selection
 * rule produced these trades — a `DELTA_BAND` run and a `NEAREST_DELTA` run
 * over the same window are different studies, not two samples of one.
 */
export interface BacktestRequestView {
  presetId: string
  presetName: string
  right: OptionRight
  selection: ContractSelectionMode
  fidelity: BacktestPreset['fidelity']
  targetDeltaRange?: readonly [number, number]
  targetDelta?: number
  minContractOi: number
  minDte: number
  maxDte: number
  quantity: number
  profitTargetPct?: number
  stopLossPct?: number
  maxHoldingDays?: number
  forceCloseDte: number
  symbols: string[]
  start: string
  end: string
  initialCapital: number
  /** Requested protocol. The *result's* protocol is the authoritative one. */
  fillProtocol: FillProtocol
  entryBandFrac?: number
}

/**
 * One row of a metrics bucket (`by_dte_bucket`, `by_delta_bucket`, …).
 *
 * `tradeCount` is always real. The ratios are `undefined` whenever bkt withheld
 * them, and `note` carries bkt's own reason verbatim. A UI that renders 0 for a
 * withheld ratio has converted "we will not say" into "we measured zero".
 */
export interface BucketRow {
  key: string
  tradeCount: number
  totalPnl?: number
  winRate?: number
  avgPnl?: number
  /** bkt's thin-bucket disclosure, unmodified (§19.4). */
  note?: string
  /** True when bkt withheld the statistics for this bucket. */
  insufficient: boolean
}

/** `metrics["execution"]` — the run's own account of what it refused (§19.4). */
export interface BacktestExecutionView {
  /** Verbatim, including a value this build does not know. */
  fillProtocol: string
  entriesAttempted?: number
  entriesFilled?: number
  noFillCount?: number
  /** `None` — not 0 — when nothing was attempted. Absence is preserved. */
  noFillRate?: number
  noFillByReason: { reason: string; count: number }[]
  /** Decisions on the window's last session, which had no *t+1* to fill
   *  against. Not a NO_FILL: nothing was refused, the window ended (§19.1). */
  pendingEntriesAtWindowEnd?: number
}

/**
 * One recorded entry that did not become a trade (§19.1).
 *
 * First-class here for the same reason it is first-class in bkt: "why didn't
 * this trade" is evidence, and a refusal rate is the whole difference between
 * a backtest's fill rate and the live path's.
 */
export interface NoFillEventView {
  symbol: string
  occSymbol: string
  reason: string
  decisionDate: string
  fillDate: string
  decisionPrice?: number
  fillPrice?: number
  bandMax?: number
  excess?: number
}

/**
 * The per-trade execution artifacts (§19.3), as recorded.
 *
 * No derived statistic appears here. bkt computes `pnl`, `capture_ratio` and
 * `holding_days` as Python *properties*, so `model_dump()` never puts them on
 * the wire; re-deriving them in the browser would be a second implementation of
 * arithmetic the backend owns, in float, free to disagree with the metrics
 * block rendered beside it.
 */
export interface TradeArtifactView {
  symbol: string
  occSymbol: string
  right: OptionRight
  strike?: number
  expiration?: string
  quantity: number
  entryTime: string
  entryPrice: number
  exitTime?: string
  exitPrice?: number
  exitReason?: string
  dteAtEntry?: number
  // Two-quote band artifacts — absent on a legacy run, which had no gap.
  decisionPrice?: number
  bandMax?: number
  excess?: number
  // Entry-side quote artifacts, read off the FILL session's quote.
  entryDelta?: number
  entryIv?: number
  entryMid?: number
  entryRelativeSpread?: number
  entryOpenInterest?: number
  fillMinusMid?: number
  // Excursions, in dollars, over the trade's life.
  mfe?: number
  mae?: number
  sessionsToMfe?: number
  marksTruncated?: boolean
}

/**
 * The pooled trade-quality block (contracts §19.4).
 *
 * bkt computes this for an **experiment**, over its pooled out-of-sample test
 * windows (`comparison_metrics["oos"]["trade_quality"]`) — two challengers with
 * the same expectancy are not the same challenger if one of them only fills
 * half the time. A single backtest run does not carry it, so this is optional
 * and rendered only when a result actually states it: the app never derives
 * these medians itself.
 *
 * Every figure is missing-with-a-note when its sample was empty, and the trades
 * excluded from the capture median (MFE ≤ 0 — there was no run-up to capture)
 * are **counted**, never folded in as zero.
 */
export interface TradeQualityView {
  tradeCount?: number
  medianCapture?: number
  captureNote?: string
  captureExcludedNonPositiveMfe?: number
  medianMfe?: number
  medianMae?: number
  medianFillMinusMid?: number
  fillMinusMidNote?: string
  noFillCount?: number
  noFillRate?: number
  noFillByReason: { reason: string; count: number }[]
}

/** The headline metrics block (`metrics`, contracts §11.12 + §19.4). */
export interface BacktestMetricsView {
  tradeCount?: number
  openTrades?: number
  totalPnl?: number
  winRate?: number
  lossRate?: number
  avgGain?: number
  avgLoss?: number
  profitFactor?: number
  expectancy?: number
  avgTimeInTradeDays?: number
  /** Per-trade Sharpe (V1 meaning). `sharpeNote` says why it is missing. */
  sharpeRatio?: number
  sharpeNote?: string
  maxDrawdownMarked?: number
  maxDrawdownRealized?: number
  /** `marked-equity` or `realized-equity` — never dropped: the same number
   *  under two bases is two different numbers (§11.12). */
  drawdownBasis?: string
}

/** `metrics["v2"]` — the return-based suite (BKT-010), or its refusal note. */
export interface BacktestReturnsView {
  note?: string
  nDays?: number
  totalReturn?: number
  cagr?: number
  cagrNote?: string
  sharpeAnnualized?: number
  /** Lineage travels with the number, including when the number is missing. */
  sharpeBasis?: string
  sharpeNote?: string
  sortinoAnnualized?: number
  sortinoNote?: string
  maxDrawdownMarkedPct?: number
  calmar?: number
  calmarNote?: string
  exposure?: number
  turnover?: number
  initialCapital?: number
  firstSession?: string
  lastSession?: string
}

/** `metrics["baselines"]` — what the run must be compared against (BKT-012). */
export interface BacktestBaselinesView {
  note?: string
  noTradeTotalPnl?: number
  buyAndHold?: { totalReturn?: number; cagr?: number; cagrNote?: string; maxDrawdownPct?: number; note?: string }
  randomEntry?: {
    n?: number
    entries?: number
    totalPnlP05?: number
    totalPnlP50?: number
    totalPnlP95?: number
    /** Fraction of the null draws the strategy beat. */
    strategyTotalPnlPercentile?: number
    note?: string
  }
}

/**
 * Disclosures the backend states about its own evidence.
 *
 * Rendered **verbatim** wherever they appear. `entryGate` and
 * `gateParamsUnevaluated` do not exist on a backtest run today — they belong to
 * ai's promotion records (§19.6) and to the Wave-2 decision tape (§20), whose
 * gate may read `"TAPE"`. They are carried here so that the day a run does
 * arrive with them, the UI shows what the backend said rather than softening a
 * standing "the gate parameters remain UNEVALUATED" into silence.
 */
export interface BacktestDisclosuresView {
  fillProtocol: string
  entryGate?: string
  gateParamsUnevaluated?: string[]
}

export interface BacktestResultView {
  engineId?: string
  engineVersion?: string
  /** The protocol that actually produced these trades (§19.1). */
  fillProtocol?: string
  /** True when the run predates §19 or ran `single_quote_legacy`: its fill
   *  rate is not comparable with a two-quote run's, and it says so. */
  legacy: boolean
  datasetRef?: {
    provider?: string
    datasetId?: string
    requestHash?: string
    mixedProvenance?: boolean
    symbols?: string[]
  }
  metrics: BacktestMetricsView
  returns?: BacktestReturnsView
  baselines?: BacktestBaselinesView
  execution?: BacktestExecutionView
  /** Present only when the result states one — an experiment surface, or a
   *  future run that carries the block. Never computed client-side. */
  tradeQuality?: TradeQualityView
  buckets: {
    byDte: BucketRow[]
    byOptionType: BucketRow[]
    byDelta: BucketRow[]
    byTicker: BucketRow[]
    byExitReason: BucketRow[]
  }
  /** True when the §19.4 buckets are absent altogether (a pre-BKT-021 run),
   *  as opposed to present and empty (a run with no closed trades). */
  bucketsUnavailable: boolean
  trades: TradeArtifactView[]
  noFillEvents: NoFillEventView[]
  pendingEntriesAtWindowEnd?: number
  disclosures: BacktestDisclosuresView
}

/** The demo engine's summary — mock mode only, and labelled as such (§6). */
export interface SimulatedBacktestSummary {
  cagr: number
  sharpe: number
  sortino: number
  maxDrawdown: number
  winRate: number
  profitFactor: number
  trades: number
  vsSpy: number
  equity: number[]
  note: string
}

export type BacktestRunStatus = 'running' | 'done' | 'failed'

/**
 * What one poll of a queued run answers.
 *
 * Separate from `BacktestRunView` because bkt's `GET /api/v1/backtests/{id}`
 * does **not** echo the request: `BacktestRunResponse` carries the status, the
 * engine identity and the result, and nothing about the params that produced
 * it. The preset and window are therefore retained client-side and joined onto
 * this — which is also why the submission's id matters even when the poll then
 * fails: the id exists only in the POST response.
 */
export interface BacktestRunProgress {
  id: string
  status: BacktestRunStatus
  /** bkt's raw status string (`PENDING`/`RUNNING`/`COMPLETED`/`FAILED`). */
  backendStatus?: string
  result?: BacktestResultView
  simulated?: SimulatedBacktestSummary
  error?: string
}

export interface BacktestRunView {
  id: string
  name: string
  status: BacktestRunStatus
  /** Per-run provenance (D10): `live` for a bkt run, `mock` for the demo
   *  engine. The card labels itself from this, not from a global flag. */
  provenance: Provenance
  createdBy: 'ai' | 'user'
  startedAt: string
  request: BacktestRequestView
  /** bkt's real result. Present once the run is COMPLETED. */
  result?: BacktestResultView
  /** The demo engine's output. Mock mode only. */
  simulated?: SimulatedBacktestSummary
  /** bkt's own failure text for a FAILED run, passed through. */
  error?: string
}
