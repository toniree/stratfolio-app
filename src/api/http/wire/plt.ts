import type { WireDecimal } from '@/api/http/wire/scalars'

/**
 * service-plt wire DTOs.
 *
 * Pinned against the Java records in `service-plt/src/main/java/.../web/dto`
 * plus `application.yml`:
 * - `spring.jackson.property-naming-strategy: SNAKE_CASE` — every field below
 *   is the snake_case form of the record component.
 * - `default-property-inclusion: non_null` — a null field is **omitted from
 *   the JSON entirely**, which is why almost everything here is optional.
 *   Optional in this file means "may be absent", not "is null".
 * - `write-dates-as-timestamps: false` — `Instant`/`LocalDate` are ISO strings.
 *
 * `BigDecimal` serialises as a JSON number; the types accept `WireDecimal`
 * (number | string) anyway so one decoder covers plt and the future mnd facade.
 */

export type PltOptionType = 'CALL' | 'PUT'
export type PltPositionStatus = 'OPEN' | 'CLOSED'
export type PltTradeStatus = 'OPEN' | 'CLOSED' | 'EXPIRED'
export type PltTradePlanStatus = 'PROPOSED' | 'VALIDATED' | 'REJECTED' | 'EXECUTED' | 'CANCELLED'
export type PltDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL'
export type PltThesisSource = 'AI' | 'USER'

/** `GET /api/v1/portfolio` → `PortfolioResponse`. */
export interface PltPortfolio {
  id: string
  account_key: string
  starting_capital?: WireDecimal
  cash_balance?: WireDecimal
  realized_pnl?: WireDecimal
  /** Always 0 while positions are open — plt never marks to market. */
  unrealized_pnl?: WireDecimal
  open_positions_cost_basis?: WireDecimal
  open_positions_value?: WireDecimal
  total_equity?: WireDecimal
  peak_equity?: WireDecimal
  return_pct?: WireDecimal
  open_positions?: number
  closed_positions?: number
  open_trades?: number
  closed_trades?: number
  winning_trades?: number
  losing_trades?: number
  win_rate_pct?: WireDecimal
  updated_at?: string
}

/** `GET /api/v1/positions` → `List<PositionResponse>`. */
export interface PltPosition {
  id: string
  portfolio_id: string
  silent_trade_id?: string
  ticker: string
  occ_symbol: string
  option_type: PltOptionType
  side: string
  strike: WireDecimal
  /** ISO calendar date. */
  expiration: string
  quantity: number
  contract_multiplier: number
  entry_price: WireDecimal
  cost_basis?: WireDecimal
  /** Absent unless something outside plt has written a mark. */
  last_price?: WireDecimal
  market_value?: WireDecimal
  unrealized_pnl?: WireDecimal
  realized_pnl?: WireDecimal
  status: PltPositionStatus
  opened_at: string
  closed_at?: string
  decision_episode_id?: string
}

/** `GET /api/v1/silent-trades` → `List<SilentTradeResponse>`. */
export interface PltSilentTrade {
  id: string
  trade_plan_id: string
  ticker: string
  occ_symbol: string
  option_type: PltOptionType
  side: string
  strike: WireDecimal
  expiration: string
  contract_snapshot?: Record<string, unknown>
  quantity: number
  contract_multiplier: number
  entry_price: WireDecimal
  entry_ts: string
  entry_fill?: Record<string, unknown>
  exit_price?: WireDecimal
  exit_ts?: string
  exit_fill?: Record<string, unknown>
  fees?: WireDecimal
  cost_basis?: WireDecimal
  realized_pnl?: WireDecimal
  return_pct?: WireDecimal
  mfe?: WireDecimal
  mae?: WireDecimal
  status: PltTradeStatus
  fill_model?: string
  fill_model_config?: Record<string, unknown>
  slippage_assumptions?: Record<string, unknown>
  decision_episode_id?: string
  entry_idempotency_key?: string
  exit_idempotency_key?: string
  created_at: string
  updated_at: string
}

/** `GET /api/v1/trade-plans` → `List<TradePlanResponse>`. */
export interface PltTradePlan {
  id: string
  thesis_id?: string
  ticker: string
  underlying_snapshot?: Record<string, unknown>
  /** Deliberately a free string on the wire so bad values reach PolicyGate. */
  option_type?: string
  side?: string
  leg_count?: number
  legs?: Record<string, unknown>[]
  expiration?: string
  dte?: number
  strike?: WireDecimal
  target_entry_min?: WireDecimal
  target_entry_max?: WireDecimal
  quantity?: number
  capital_allocation?: WireDecimal
  expected_holding_period?: string
  profit_taking_conditions?: string[]
  loss_conditions?: string[]
  exit_criteria?: string[]
  /** Fraction, not percent points (§7.1). Absent on legacy plans. */
  profit_target_pct?: WireDecimal
  /** Fraction, not percent points (§7.1). Absent on legacy plans. */
  stop_loss_pct?: WireDecimal
  max_holding_days?: number
  dte_floor?: number
  /** 0..1 fraction (§7.4). */
  confidence?: WireDecimal
  reasoning?: string
  decision_inputs?: Record<string, unknown>
  risk_profile?: string
  execution_mode?: string
  model_version?: string
  policy_version?: string
  strategy_version?: string
  status: PltTradePlanStatus
  /** RejectionReason codes; may repeat (§7.5). */
  rejection_reasons?: string[]
  rejection_details?: { code?: string; field?: string; message?: string }[]
  decision_episode_id?: string
  created_at: string
  updated_at: string
  occ_symbol_expected?: string
}

/**
 * plt `ActionType` — the complete enum, newest roster.
 *
 * This is a strict superset of the app's activity kinds and grows on plt's
 * schedule, so the adapter maps what it knows and degrades the rest to
 * `other` rather than dropping rows from an audit trail (§7.10).
 */
export type PltActionType =
  | 'THESIS_CREATED'
  | 'TRADE_PLAN_VALIDATED'
  | 'TRADE_PLAN_REJECTED'
  | 'TRADE_PLAN_EXECUTED'
  | 'SILENT_TRADE_OPENED'
  | 'SILENT_TRADE_CLOSED'
  | 'POSITION_OPENED'
  | 'POSITION_CLOSED'
  | 'PORTFOLIO_UPDATED'
  | 'CONFIG_UPDATED'
  | 'USER_ACTIVITY'
  | 'WATCHLIST_ADDED'
  | 'WATCHLIST_RESTORED'
  | 'WATCHLIST_EXCLUDED'
  | 'WATCHLIST_EVICTED'
  | 'WATCHLIST_PINNED'
  | 'WATCHLIST_UNPINNED'
  | 'WATCHLIST_UPDATED'
  | 'WATCHLIST_VALIDATION_CHANGED'
  | 'WATCHLIST_SEEDED'
  | 'CANDIDATE_RECORDED'
  | 'CANDIDATE_PROMOTED'
  | 'CANDIDATE_REJECTED'
  | 'CANDIDATE_EXPIRED'

/** `GET /api/v1/activity` → `List<ActivityResponse>`. */
export interface PltActivity {
  id: string
  ts: string
  actor?: string
  /** Wire field is `action_type`, not `type` (§7.10). */
  action_type: string
  entity_type: string
  entity_id?: string
  payload?: Record<string, unknown>
  decision_episode_id?: string
}

/** `POST /api/v1/activity` → `CreateActivityRequest`. */
export interface PltCreateActivity {
  /** Must be a valid `ActionType`; a free-form string is a 400 (§7.10). */
  action_type: PltActionType
  entity_type: string
  entity_id?: string
  payload?: Record<string, unknown>
  actor?: string
}

/** `GET /api/v1/theses` → `List<ThesisResponse>`. Read in Wave B (APP-111). */
export interface PltThesis {
  id: string
  ticker: string
  direction: PltDirection
  rationale: string
  evidence?: Record<string, unknown>
  features?: Record<string, unknown>
  /** 0..1 fraction (§7.4). */
  confidence?: WireDecimal
  expected_catalyst?: string
  time_horizon?: string
  invalidation_conditions?: string[]
  model_version?: string
  prompt_version?: string
  strategy_version?: string
  tool_versions?: Record<string, unknown>
  source: PltThesisSource
  decision_episode_id?: string
  created_at: string
}

/** plt caps every list endpoint at `limit=500` with no cursor (HKP-PLT-8).
 *  An out-of-range value is a 400, not a clamp — so the app sends the cap. */
export const PLT_LIST_LIMIT_MAX = 500
