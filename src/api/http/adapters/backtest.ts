import type {
  BacktestBaselinesView,
  BacktestExecutionView,
  BacktestMetricsView,
  BacktestPreset,
  BacktestRequestView,
  BacktestResultView,
  BacktestReturnsView,
  BucketRow,
  NoFillEventView,
  QueueBacktestInput,
  TradeArtifactView,
  TradeQualityView,
} from '@/api/researchTypes'
import type {
  BktBacktestMetrics,
  BktBacktestRequest,
  BktBacktestResult,
  BktBucketSummary,
  BktExecutionMetrics,
  BktNoFillEvent,
  BktTrade,
  BktTradeQuality,
} from '@/api/http/wire/bkt'
import {
  decimal,
  integer,
  instant,
  requiredDecimal,
  requiredInstant,
  requiredInteger,
  requiredText,
  text,
} from '@/api/http/wire/scalars'

/**
 * bkt backtests ↔ the research view models (APP-122).
 *
 * The one place §19 wire shapes are decoded. Three rules run through all of it:
 *
 *  - **Decimals arrive as strings** (`model_dump(mode="json")` stringifies
 *    every `Decimal`), so every money field and every ratio goes through
 *    `decimal()`, which returns `undefined` — never 0 — for a null.
 *  - **bkt sends nulls rather than omitting keys**, unlike plt. A `null`
 *    `win_rate` beside a real `trade_count` is a *withheld* statistic, and the
 *    difference between withheld and zero is the whole point of §19.4.
 *  - **Nothing is re-derived here.** `Trade.pnl`, `capture_ratio` and
 *    `holding_days` are Python properties and never cross the wire; computing
 *    them in the browser would put a float re-implementation of contract
 *    arithmetic beside bkt's own exact-Decimal metrics, free to disagree with
 *    them. The UI shows the recorded artifacts and the metrics block, and says
 *    where the pooled medians live instead.
 */

/* ------------------------------------------------------------------ request */

/** Decimal → the string form bkt expects (and ai already sends). */
function wireDecimal(value: number): string {
  return String(value)
}

/**
 * A preset plus the composer's choices → `POST /api/v1/backtests`.
 *
 * `autonomous` stays false: an explicit request may name any symbols, and
 * out-of-universe historical research is allowed by design (§10). `fill_protocol`
 * is stated rather than defaulted, so the persisted run records the protocol
 * this app asked for.
 */
export function toBacktestRequest(
  preset: BacktestPreset,
  input: QueueBacktestInput,
): BktBacktestRequest {
  const band = preset.targetDeltaRange
  return {
    symbols: input.symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean),
    start: input.start,
    end: input.end,
    params: {
      entry: {
        option_type: preset.right,
        selection: preset.selection,
        // Explicitly null under DELTA_BAND — an omitted key would default to
        // 0.30 server-side and assert a point target this request does not
        // mean (§19.2). Under NEAREST_DELTA it is the whole rule.
        target_delta: preset.targetDelta === undefined ? null : wireDecimal(preset.targetDelta),
        target_delta_range: band ? [wireDecimal(band[0]), wireDecimal(band[1])] : null,
        otm_pct: null,
        // Stated always, and required under DELTA_BAND: an unspoken liquidity
        // floor silently becoming "no floor" cannot be audited (§19.2).
        min_contract_oi: preset.minContractOi,
        min_dte: preset.minDte,
        max_dte: preset.maxDte,
        quantity: preset.quantity,
      },
      exit: {
        // Fractions of entry premium, not percent points (§7.1).
        profit_target_pct:
          preset.profitTargetPct === undefined ? null : wireDecimal(preset.profitTargetPct),
        stop_loss_pct: preset.stopLossPct === undefined ? null : wireDecimal(preset.stopLossPct),
        max_holding_days: preset.maxHoldingDays ?? null,
        force_close_dte: preset.forceCloseDte,
      },
      initial_capital: wireDecimal(input.initialCapital),
    },
    fill_protocol: 'two_quote_band',
    autonomous: false,
    include_baselines: true,
  }
}

/** The request echoed into the run detail — read-only, never a form. */
export function toBacktestRequestView(
  preset: BacktestPreset,
  input: QueueBacktestInput,
): BacktestRequestView {
  return {
    presetId: preset.id,
    presetName: preset.name,
    right: preset.right,
    selection: preset.selection,
    fidelity: preset.fidelity,
    targetDeltaRange: preset.targetDeltaRange,
    targetDelta: preset.targetDelta,
    minContractOi: preset.minContractOi,
    minDte: preset.minDte,
    maxDte: preset.maxDte,
    quantity: preset.quantity,
    profitTargetPct: preset.profitTargetPct,
    stopLossPct: preset.stopLossPct,
    maxHoldingDays: preset.maxHoldingDays,
    forceCloseDte: preset.forceCloseDte,
    symbols: input.symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean),
    start: input.start,
    end: input.end,
    initialCapital: input.initialCapital,
    fillProtocol: 'two_quote_band',
  }
}

/* ------------------------------------------------------------------- result */

/**
 * One bucket row.
 *
 * `insufficient` is derived from what bkt withheld, not from a threshold this
 * file re-implements: the moment bkt nulls the ratios while reporting a count,
 * the row is "insufficient data (n=X)". Hard-coding `< 5` here would be a
 * second copy of `MIN_TRADES_PER_BUCKET` that could drift out of step with the
 * service that actually applied it.
 */
export function toBucketRow(key: string, wire: BktBucketSummary): BucketRow {
  const winRate = decimal(wire.win_rate)
  const avgPnl = decimal(wire.avg_pnl)
  const totalPnl = decimal(wire.total_pnl)
  // Required server-side (`_bucket_summary` always states it). Throwing on a
  // malformed row is the honest failure: a bucket rendered as "n=0" would read
  // as an empty bucket rather than a broken one.
  const count = requiredInteger(wire.trade_count, 'bucket.trade_count')
  return {
    key,
    tradeCount: count,
    totalPnl,
    winRate,
    avgPnl,
    note: text(wire.note ?? undefined),
    insufficient: count > 0 && winRate === undefined && avgPnl === undefined,
  }
}

function toBuckets(wire: Record<string, BktBucketSummary> | undefined): BucketRow[] {
  if (!wire) return []
  return Object.entries(wire)
    .map(([key, summary]) => toBucketRow(key, summary))
    .sort((a, b) => a.key.localeCompare(b.key))
}

function toExecutionView(wire: BktExecutionMetrics): BacktestExecutionView {
  return {
    // Verbatim: a protocol string this build does not recognise is still what
    // the run says it is, and hiding it would hide the one property a fill
    // rate belongs to (§19.1).
    fillProtocol: text(wire.fill_protocol) ?? 'unknown',
    entriesAttempted: integer(wire.entries_attempted),
    entriesFilled: integer(wire.entries_filled),
    noFillCount: integer(wire.no_fill_count),
    // `null` when nothing was attempted: a run that never found a candidate
    // did not achieve a 0% refusal rate, it has no refusal rate.
    noFillRate: decimal(wire.no_fill_rate),
    noFillByReason: Object.entries(wire.no_fill_by_reason ?? {})
      .map(([reason, value]) => ({
        reason,
        count: requiredInteger(value, `no_fill_by_reason.${reason}`),
      }))
      .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason)),
    pendingEntriesAtWindowEnd: integer(wire.pending_entries_at_window_end),
  }
}

/**
 * The pooled trade-quality block, when a result states one (§19.4).
 *
 * Read, never derived. bkt's medians are exact `Decimal` medians over the
 * pooled OOS trades; the app's job here is to carry them and their notes
 * across, including the count of trades excluded from the capture median
 * because their MFE was not positive — which is stated rather than folded in
 * as a zero.
 */
function toTradeQualityView(wire: BktTradeQuality): TradeQualityView {
  return {
    tradeCount: integer(wire.trade_count),
    medianCapture: decimal(wire.median_capture),
    captureNote: text(wire.capture_note ?? undefined),
    captureExcludedNonPositiveMfe: integer(wire.capture_excluded_non_positive_mfe),
    medianMfe: decimal(wire.median_mfe),
    medianMae: decimal(wire.median_mae),
    medianFillMinusMid: decimal(wire.median_fill_minus_mid),
    fillMinusMidNote: text(wire.fill_minus_mid_note ?? undefined),
    noFillCount: integer(wire.no_fill_count),
    noFillRate: decimal(wire.no_fill_rate),
    noFillByReason: Object.entries(wire.no_fill_by_reason ?? {})
      .map(([reason, value]) => ({
        reason,
        count: requiredInteger(value, `trade_quality.no_fill_by_reason.${reason}`),
      }))
      .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason)),
  }
}

function toMetricsView(wire: BktBacktestMetrics): BacktestMetricsView {
  return {
    tradeCount: integer(wire.trade_count),
    openTrades: integer(wire.open_trades),
    totalPnl: decimal(wire.total_pnl),
    winRate: decimal(wire.win_rate),
    lossRate: decimal(wire.loss_rate),
    avgGain: decimal(wire.avg_gain),
    avgLoss: decimal(wire.avg_loss),
    profitFactor: decimal(wire.profit_factor),
    expectancy: decimal(wire.expectancy),
    avgTimeInTradeDays: decimal(wire.avg_time_in_trade_days),
    sharpeRatio: decimal(wire.sharpe_ratio),
    sharpeNote: text(wire.sharpe_note ?? undefined),
    maxDrawdownMarked: decimal(wire.max_drawdown_marked),
    maxDrawdownRealized: decimal(wire.max_drawdown_realized),
    // Never dropped: `max_drawdown_marked` without its basis cannot tell a
    // genuine "no drawdown" from "this run could not be marked" (§11.12).
    drawdownBasis: text(wire.drawdown_basis ?? undefined),
  }
}

function num(bag: Record<string, unknown>, key: string): number | undefined {
  const value = bag[key]
  return typeof value === 'number' || typeof value === 'string' ? decimal(value) : undefined
}

function str(bag: Record<string, unknown>, key: string): string | undefined {
  const value = bag[key]
  return typeof value === 'string' ? text(value) : undefined
}

function toReturnsView(wire: Record<string, unknown>): BacktestReturnsView {
  // `sharpe_v2_note` is an object carrying the ratio's lineage — basis, day
  // count, annualisation factor — because "Sharpe 1.8" means nothing without
  // it. Flattened here, never dropped.
  const lineage = (wire.sharpe_v2_note ?? {}) as Record<string, unknown>
  return {
    note: str(wire, 'note'),
    nDays: num(wire, 'n_days'),
    totalReturn: num(wire, 'total_return'),
    cagr: num(wire, 'cagr'),
    cagrNote: str(wire, 'cagr_note'),
    sharpeAnnualized: num(wire, 'sharpe_annualized'),
    sharpeBasis: str(lineage, 'basis'),
    sharpeNote: str(lineage, 'note'),
    sortinoAnnualized: num(wire, 'sortino_annualized'),
    sortinoNote: str(wire, 'sortino_note'),
    maxDrawdownMarkedPct: num(wire, 'max_drawdown_marked_pct'),
    calmar: num(wire, 'calmar'),
    calmarNote: str(wire, 'calmar_note'),
    exposure: num(wire, 'exposure'),
    turnover: num(wire, 'turnover'),
    initialCapital: num(wire, 'initial_capital'),
    firstSession: str(wire, 'first_session'),
    lastSession: str(wire, 'last_session'),
  }
}

function toBaselinesView(wire: Record<string, unknown>): BacktestBaselinesView {
  const noTrade = (wire.no_trade ?? {}) as Record<string, unknown>
  const buyHold = (wire.buy_and_hold ?? {}) as Record<string, unknown>
  const random = (wire.random_entry ?? {}) as Record<string, unknown>
  return {
    note: str(wire, 'note'),
    noTradeTotalPnl: num(noTrade, 'total_pnl'),
    buyAndHold: {
      totalReturn: num(buyHold, 'total_return'),
      cagr: num(buyHold, 'cagr'),
      cagrNote: str(buyHold, 'cagr_note'),
      maxDrawdownPct: num(buyHold, 'max_drawdown_pct'),
      note: str(buyHold, 'note'),
    },
    randomEntry: {
      n: num(random, 'n'),
      entries: num(random, 'entries'),
      totalPnlP05: num(random, 'total_pnl_p05'),
      totalPnlP50: num(random, 'total_pnl_p50'),
      totalPnlP95: num(random, 'total_pnl_p95'),
      strategyTotalPnlPercentile: num(random, 'strategy_total_pnl_percentile'),
      note: str(random, 'note'),
    },
  }
}

export function toTradeArtifact(wire: BktTrade): TradeArtifactView {
  return {
    symbol: requiredText(wire.symbol, 'trade.symbol').toUpperCase(),
    occSymbol: requiredText(wire.contract?.occ_symbol, 'trade.contract.occ_symbol'),
    right: wire.contract?.option_type === 'PUT' ? 'PUT' : 'CALL',
    strike: decimal(wire.contract?.strike),
    expiration: text(wire.contract?.expiration),
    quantity: requiredInteger(wire.quantity, 'trade.quantity'),
    entryTime: requiredInstant(wire.entry_time, 'trade.entry_time'),
    // Never 0: a substituted entry price renders a free position, and every
    // artifact beside it (fill − mid, excess) would be measured against it.
    entryPrice: requiredDecimal(wire.entry_price, 'trade.entry_price'),
    exitTime: instant(wire.exit_time ?? undefined),
    exitPrice: decimal(wire.exit_price),
    exitReason: text(wire.exit_reason ?? undefined),
    dteAtEntry: integer(wire.dte_at_entry),
    decisionPrice: decimal(wire.decision_price),
    bandMax: decimal(wire.band_max),
    excess: decimal(wire.excess),
    entryDelta: decimal(wire.entry_delta),
    entryIv: decimal(wire.entry_iv),
    entryMid: decimal(wire.entry_mid),
    entryRelativeSpread: decimal(wire.entry_relative_spread),
    entryOpenInterest: integer(wire.entry_open_interest ?? undefined),
    fillMinusMid: decimal(wire.fill_minus_mid),
    mfe: decimal(wire.mfe),
    mae: decimal(wire.mae),
    sessionsToMfe: integer(wire.sessions_to_mfe ?? undefined),
    marksTruncated: wire.marks_truncated === true,
  }
}

export function toNoFillEvent(wire: BktNoFillEvent): NoFillEventView {
  return {
    symbol: requiredText(wire.symbol, 'no_fill.symbol').toUpperCase(),
    occSymbol: requiredText(wire.occ_symbol, 'no_fill.occ_symbol'),
    // The reason code verbatim — `ENTRY_PRICE_ABOVE_BAND` is a different fact
    // from `SPREAD_TOO_WIDE`, and collapsing them to "no fill" throws away the
    // evidence the event exists to carry.
    reason: requiredText(wire.reason, 'no_fill.reason'),
    decisionDate: requiredText(wire.decision_date, 'no_fill.decision_date'),
    fillDate: requiredText(wire.fill_date, 'no_fill.fill_date'),
    decisionPrice: decimal(wire.decision_price),
    fillPrice: decimal(wire.fill_price),
    bandMax: decimal(wire.band_max),
    excess: decimal(wire.excess),
  }
}

/**
 * `BacktestResult` → the view model.
 *
 * `legacy` is true for a `single_quote_legacy` run **and** for a result that
 * names no protocol at all: bkt's model defaults the field to
 * `single_quote_legacy`, so an absent value means "not two-quote", never
 * "unknown, assume the good one". A legacy run's fill rate is not comparable
 * with a two-quote run's, and the card says so rather than pooling them.
 */
export function toBacktestResultView(wire: BktBacktestResult): BacktestResultView {
  const metrics = wire.metrics ?? {}
  const protocol = text(wire.fill_protocol) ?? text(metrics.execution?.fill_protocol)
  const legacy = protocol !== 'two_quote_band'
  const executionWire = metrics.execution
  const v2 = metrics.v2
  const baselines = metrics.baselines

  const byDelta = toBuckets(metrics.by_delta_bucket)
  const byTicker = toBuckets(metrics.by_ticker)
  const byExitReason = toBuckets(metrics.by_exit_reason)

  return {
    engineId: text(wire.engine_id),
    engineVersion: text(wire.engine_version),
    fillProtocol: protocol,
    legacy,
    datasetRef: wire.dataset_ref
      ? {
          provider: text(wire.dataset_ref.provider),
          datasetId: text(wire.dataset_ref.dataset_id),
          requestHash: text(wire.dataset_ref.request_hash),
          mixedProvenance: wire.dataset_ref.mixed_provenance === true,
          symbols: wire.dataset_ref.symbols,
        }
      : undefined,
    metrics: toMetricsView(metrics),
    returns: v2 ? toReturnsView(v2) : undefined,
    baselines: baselines ? toBaselinesView(baselines) : undefined,
    execution: executionWire ? toExecutionView(executionWire) : undefined,
    // Only when the result states one: this is an experiment-surface block,
    // and an absent one is not a run whose medians are all zero.
    tradeQuality: metrics.trade_quality ? toTradeQualityView(metrics.trade_quality) : undefined,
    buckets: {
      byDte: toBuckets(metrics.by_dte_bucket),
      byOptionType: toBuckets(metrics.by_option_type),
      byDelta,
      byTicker,
      byExitReason,
    },
    // Absent keys, not empty ones: a pre-BKT-021 run never had these buckets,
    // which is a different statement from "this run closed no trades".
    bucketsUnavailable:
      metrics.by_delta_bucket === undefined &&
      metrics.by_ticker === undefined &&
      metrics.by_exit_reason === undefined,
    trades: (wire.trades ?? []).map(toTradeArtifact),
    noFillEvents: (wire.no_fill_events ?? []).map(toNoFillEvent),
    pendingEntriesAtWindowEnd:
      integer(wire.pending_entries_at_window_end) ??
      integer(executionWire?.pending_entries_at_window_end),
    disclosures: {
      // The protocol is a disclosure, not a detail: it is what a fill rate is
      // a property of. Stated even when it is the default.
      fillProtocol: protocol ?? 'unstated (bkt defaults to single_quote_legacy)',
      // Neither of these is emitted by a backtest run today — `entry_gate` is
      // the Wave-2 tape's (§20, where it may read "TAPE") and
      // `gate_params_unevaluated` is ai's promotion clause (§19.6/§12.5). Read
      // verbatim if a run ever carries one; never reworded, never softened.
      entryGate: text(wire.entry_gate ?? metrics.entry_gate ?? undefined),
      gateParamsUnevaluated:
        wire.gate_params_unevaluated ?? metrics.gate_params_unevaluated ?? undefined,
    },
  }
}
