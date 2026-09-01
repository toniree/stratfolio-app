import type { WireDecimal } from '@/api/http/wire/scalars'

/**
 * service-bkt wire DTOs (`api/executions.py`, `api/backtests.py`).
 *
 * bkt is FastAPI/Pydantic with plain snake_case attribute names — the wire is
 * the declared attribute, with no alias generator and, unlike plt, **no
 * non-null omission**: a null field is serialised as `null` rather than
 * dropped. `Decimal` fields may arrive as strings, which `decimal()` handles.
 *
 * The two things every caller must internalise:
 *  - a 201 means the attempt *completed*, and `status` is `FILLED` **or the
 *    equally successful `NO_FILL`** (§7.8). A `NO_FILL` leaves no silent-trade
 *    row anywhere, and bkt has no list-executions route (HKP-BKT-4), so the
 *    response is the only record of it that will ever exist.
 *  - `reported_to_platform: false` with a `platform_error` means bkt executed
 *    but could not tell plt. The trade happened; the system of record does not
 *    know. That is a recoverable state, never a success toast (D3).
 */

/** `POST /api/v1/executions` body. Idempotency lives **in the body** here —
 *  plt takes a header (§7.7). Sending an embedded `trade_plan` is a 422
 *  (`EMBEDDED_PLAN_FORBIDDEN`): bkt reads the plan from plt, never from us. */
export interface BktExecutionRequest {
  trade_plan_id: string
  decision_episode_id?: string
  /** Max 128 characters, same cap as plt's header. */
  idempotency_key?: string
}

/**
 * `POST /api/v1/executions/exits` body — **the whole body** (contracts §17).
 *
 * `extra: forbid` on bkt's `ExitRequest`, so this interface is closed on
 * purpose: an `exit_price`, an `exit_reason`, a quantity or a side here is a
 * 422, not a field the service ignores. Everything about the exit except
 * *which* trade and *which* operation is measured or assigned server-side —
 * the price from the current mnd quote through the exit fill model, the reason
 * fixed to `USER_CLOSE`, the timestamps from event time.
 *
 * `idempotency_key` is required here, unlike on the entry path.
 */
export interface BktExitRequest {
  silent_trade_id: string
  /** 1..128 characters. */
  idempotency_key: string
}

export type BktExecutionStatus = 'FILLED' | 'NO_FILL' | 'REJECTED'
export type BktExecutionAction = 'ENTRY' | 'EXIT'

export interface BktContractRef {
  occ_symbol: string
  option_type: 'CALL' | 'PUT'
  strike: WireDecimal
  /** `YYYY-MM-DD`. */
  expiration: string
  dte: number
  underlying_price: WireDecimal
}

export interface BktFillRef {
  side: string
  quantity: number
  price: WireDecimal
  notional: WireDecimal
  contract_multiplier: number
  fees?: WireDecimal | null
  /** Signed cash impact: negative for a BUY. */
  cash_effect?: WireDecimal | null
}

/** `ExecutionOutcome` — the response to both the 201 and the 200 replay. */
export interface BktExecutionOutcome {
  execution_id: string
  trade_plan_id: string
  decision_episode_id?: string | null
  status: BktExecutionStatus
  action: BktExecutionAction
  /** Absent on a REJECTED entry that never resolved a contract. */
  contract?: BktContractRef | null
  /** Absent on NO_FILL and REJECTED — there is no fill to describe. */
  fill?: BktFillRef | null
  /** e.g. `SPIKE_NO_FILL`, `ENTRY_PRICE_ABOVE_BAND`. */
  reason_code?: string | null
  /** EXIT rows only — `USER_CLOSE` for a hand close. NULL on every ENTRY. */
  exit_reason?: string | null
  fill_model?: string
  fill_model_config?: Record<string, unknown>
  determinism_hash?: string
  quote_snapshot?: Record<string, unknown> | null
  diagnostics?: Record<string, unknown>
  /** Present only for a FILLED entry that plt accepted. */
  silent_trade_id?: string | null
  reported_to_platform?: boolean
  platform_error?: string | null
  executed_at?: string | null
  business_now?: string | null
  /**
   * True when this response is a replay of a recorded outcome for the same
   * idempotency key — the retry path, not a second execution (D6).
   *
   * **Trust the HTTP status, not this flag, on the exits route.** bkt builds
   * that response with `outcome_from_record(record)`, whose `replayed`
   * parameter defaults to `false`; the 200-vs-201 code is what actually
   * distinguishes a replay there (`create_exit` sets it from
   * `UserExitResult.replayed`).
   */
  replayed?: boolean
}

/* -------------------------------------------------------------------------- */
/* Backtests — `api/backtests.py`, `backtest/models.py` (APP-122)             */
/* -------------------------------------------------------------------------- */

/**
 * `params.entry` — `EntryRule`.
 *
 * `extra="forbid"` on bkt's model, so every key here is a real field and a typo
 * is a 422 rather than a value the service ignores. The mode/parameter rule is
 * symmetric and enforced (§19.2): `DELTA_BAND` requires `target_delta_range`
 * **and** a stated `min_contract_oi`; `NEAREST_DELTA` requires `target_delta`;
 * `OTM_PCT` requires `otm_pct`.
 *
 * `target_delta` is sent as an explicit `null` under `DELTA_BAND`, never
 * omitted: an absent key defaults to `0.30` server-side and would assert a
 * point target the request does not mean.
 *
 * Decimals cross as **strings** — the convention `profit_target_pct` and
 * `initial_capital` already use on this endpoint, and what
 * `model_dump(mode="json")` produces on the way back.
 */
export interface BktEntryRuleRequest {
  option_type: 'CALL' | 'PUT'
  selection: 'DELTA_BAND' | 'NEAREST_DELTA' | 'OTM_PCT'
  target_delta: string | null
  target_delta_range?: [string, string] | null
  otm_pct?: string | null
  min_contract_oi?: number
  min_dte: number
  max_dte: number
  quantity: number
}

/** `params.exit` — `ExitRuleParams`. The pct fields are **fractions** of entry
 *  premium (§7.1/§12.3): `"1.0"` is +100%, not +1%. */
export interface BktExitRuleRequest {
  profit_target_pct?: string | null
  stop_loss_pct?: string | null
  max_holding_days?: number | null
  force_close_dte?: number
}

export interface BktBacktestParamsRequest {
  entry: BktEntryRuleRequest
  exit: BktExitRuleRequest
  /** The capital base every ratio in `metrics["v2"]` is measured against. */
  initial_capital: string
}

/** `POST /api/v1/backtests` body — `BacktestRequest`. */
export interface BktBacktestRequest {
  symbols: string[]
  /** Event-time `YYYY-MM-DD` (contracts §1). */
  start: string
  end: string
  params: BktBacktestParamsRequest
  /** Defaults to `two_quote_band` server-side; sent explicitly so the run
   *  records which protocol was *asked for*, not which default applied. */
  fill_protocol?: 'two_quote_band' | 'single_quote_legacy'
  /** `true` restricts symbols to plt's ActiveUniverse (§10). The research desk
   *  is explicit out-of-universe research by design, so this stays false. */
  autonomous?: boolean
  include_baselines?: boolean
  baseline_mc_n?: number
}

/** `POST /api/v1/backtests` → **202**. The shape of a submission; the run has
 *  already finished synchronously by the time it arrives (§7.6). */
export interface BktBacktestSubmitted {
  id: string
  status: string
}

/**
 * `GET /api/v1/backtests/{id}` — `BacktestRunResponse`.
 *
 * `result` is the whole `BacktestResult` (`model_dump(mode="json")`), and it is
 * `null` unless `status == "COMPLETED"`. `dataset_ref` at *this* level is the
 * dataset id string, not the manifest — the manifest is `result.dataset_ref`.
 */
export interface BktBacktestRun {
  id: string
  status: string
  strategy_version_id?: string | null
  engine_id?: string | null
  fill_model?: string | null
  dataset_ref?: string | null
  error?: string | null
  result?: BktBacktestResult | null
}

/**
 * `Trade` (§19.3).
 *
 * Every §19 artifact is optional, because bkt records missing as missing: a
 * `single_quote_legacy` run has no band fields (there was no decision→fill
 * gap), and a provider serving no greeks leaves `entry_delta` null rather than
 * a 0 that would read as "delta zero".
 *
 * **`pnl`, `capture_ratio` and `holding_days` are absent by design.** They are
 * Python `@property`s on bkt's model, so `model_dump()` never serialises them.
 * The app does not re-derive them (see `adapters/backtest.ts`).
 */
export interface BktTrade {
  symbol: string
  contract: {
    occ_symbol: string
    option_type: 'CALL' | 'PUT'
    strike: WireDecimal
    expiration: string
  }
  quantity: number
  contract_multiplier?: number
  entry_time: string
  entry_price: WireDecimal
  entry_fees?: WireDecimal | null
  entry_fill_model?: string
  exit_time?: string | null
  exit_price?: WireDecimal | null
  exit_fees?: WireDecimal | null
  exit_reason?: string | null
  // Two-quote band artifacts (§19.1/§19.3).
  decision_price?: WireDecimal | null
  fill_price?: WireDecimal | null
  band_max?: WireDecimal | null
  /** `fill_price - band_max`; the plan's `fill_minus_band` IS this column. */
  excess?: WireDecimal | null
  // Entry-side quote artifacts, read off the FILL session's quote.
  entry_delta?: WireDecimal | null
  entry_iv?: WireDecimal | null
  entry_bid?: WireDecimal | null
  entry_ask?: WireDecimal | null
  entry_mid?: WireDecimal | null
  entry_relative_spread?: WireDecimal | null
  entry_open_interest?: number | null
  fill_minus_mid?: WireDecimal | null
  // Exit-side quote artifacts.
  exit_delta?: WireDecimal | null
  exit_iv?: WireDecimal | null
  exit_bid?: WireDecimal | null
  exit_ask?: WireDecimal | null
  exit_mid?: WireDecimal | null
  exit_relative_spread?: WireDecimal | null
  exit_open_interest?: number | null
  mfe?: WireDecimal | null
  mae?: WireDecimal | null
  marks?: WireDecimal[]
  marks_truncated?: boolean
  mfe_session_index?: number | null
  mae_session_index?: number | null
  sessions_to_mfe?: number | null
  dte_at_entry?: number
}

/** `NoFillEvent` (§19.1) — an attempted entry that produced no trade. */
export interface BktNoFillEvent {
  symbol: string
  occ_symbol: string
  reason: string
  decision_date: string
  fill_date: string
  decision_price?: WireDecimal | null
  fill_price?: WireDecimal | null
  band_max?: WireDecimal | null
  excess?: WireDecimal | null
}

/**
 * One metrics bucket summary.
 *
 * A thin bucket (fewer than five trades, §19.4) reports its real `trade_count`
 * with every ratio `null` and a `note` saying so. `by_dte_bucket` and
 * `by_option_type` keep their older unthresholded meaning and carry no note.
 */
export interface BktBucketSummary {
  trade_count: number
  total_pnl?: WireDecimal | null
  win_rate?: WireDecimal | null
  avg_pnl?: WireDecimal | null
  note?: string | null
}

/** `metrics["execution"]` (§19.4). Absent on a pre-BKT-020 run. */
export interface BktExecutionMetrics {
  fill_protocol?: string
  entries_attempted?: number
  entries_filled?: number
  no_fill_count?: number
  /** `null` — never 0 — when nothing was attempted. */
  no_fill_rate?: WireDecimal | null
  no_fill_by_reason?: Record<string, number>
  pending_entries_at_window_end?: number
}

/**
 * The OOS trade-quality block (§19.4).
 *
 * bkt computes this for **experiments** — `comparison_metrics["oos"]
 * ["trade_quality"]`, pooled over the test windows — not for a single
 * backtest run. It is typed here (and read if a run ever carries one) so the
 * panel is ready for an experiment surface; the research desk renders the
 * per-trade artifacts instead of re-deriving these medians in the browser.
 */
export interface BktTradeQuality {
  trade_count?: number
  median_capture?: WireDecimal | null
  capture_note?: string | null
  capture_excluded_non_positive_mfe?: number
  median_mfe?: WireDecimal | null
  median_mae?: WireDecimal | null
  median_fill_minus_mid?: WireDecimal | null
  fill_minus_mid_note?: string | null
  no_fill_count?: number
  no_fill_rate?: WireDecimal | null
  no_fill_by_reason?: Record<string, number>
}

/**
 * `BacktestResult.metrics` — a `dict[str, Any]` on the wire.
 *
 * Every key is optional here on purpose: `metrics` is assembled by
 * `compute_metrics` plus whatever the run attached (`v2`, `execution`,
 * `baselines`), and a run recorded before a given key existed simply does not
 * carry it. Absence is rendered as absence.
 */
export interface BktBacktestMetrics {
  trade_count?: number
  open_trades?: number
  total_pnl?: WireDecimal | null
  win_rate?: WireDecimal | null
  loss_rate?: WireDecimal | null
  avg_gain?: WireDecimal | null
  avg_loss?: WireDecimal | null
  profit_factor?: WireDecimal | null
  expectancy?: WireDecimal | null
  avg_time_in_trade_days?: WireDecimal | null
  sharpe_ratio?: WireDecimal | null
  sharpe_note?: string | null
  max_drawdown_marked?: WireDecimal | null
  max_drawdown_realized?: WireDecimal | null
  drawdown_basis?: string | null
  by_dte_bucket?: Record<string, BktBucketSummary>
  by_option_type?: Record<string, BktBucketSummary>
  // BKT-021 (§19.4) — absent on a pre-§19 run.
  by_delta_bucket?: Record<string, BktBucketSummary>
  by_ticker?: Record<string, BktBucketSummary>
  by_exit_reason?: Record<string, BktBucketSummary>
  execution?: BktExecutionMetrics
  v2?: Record<string, unknown>
  baselines?: Record<string, unknown>
  trade_quality?: BktTradeQuality
  /** Wave-2 decision-tape disclosures (§20), and ai's promotion clause
   *  (§19.6). Neither is emitted by a backtest run today; both are read
   *  verbatim if one ever is, never softened into silence. */
  entry_gate?: string | null
  gate_params_unevaluated?: string[] | null
}

/** `BacktestResult` — the whole persisted result. */
export interface BktBacktestResult {
  trades?: BktTrade[]
  no_fill_events?: BktNoFillEvent[]
  metrics?: BktBacktestMetrics
  dataset_ref?: {
    provider?: string
    dataset_id?: string
    seed?: number
    symbols?: string[]
    start?: string
    end?: string
    request_hash?: string
    mixed_provenance?: boolean
    symbol_provenance?: Record<string, { provider?: string; dataset_id?: string; seed?: number }>
  }
  engine_id?: string
  engine_version?: string
  /** Defaults to `single_quote_legacy` on bkt's model, so an ABSENT value and
   *  an explicit legacy value mean the same thing: not a two-quote run. */
  fill_protocol?: string
  pending_entries_at_window_end?: number
  entry_gate?: string | null
  gate_params_unevaluated?: string[] | null
}
