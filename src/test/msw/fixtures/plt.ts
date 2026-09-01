/**
 * plt wire fixtures, pinned to the real DTOs.
 *
 * Every field name here is the SNAKE_CASE serialisation of the corresponding
 * Java record field (`spring.jackson.property-naming-strategy: SNAKE_CASE`),
 * and every *absent* field is absent on purpose: plt runs
 * `default-property-inclusion: non_null`, so a null is omitted from the JSON
 * entirely rather than sent as `null` (§7.2). Fixtures that "helpfully" fill in
 * `unrealized_pnl: 0` or `last_price: 0` would test a backend that does not
 * exist — plt never marks an open position to market.
 *
 * Each is typed against the wire interface, so a fixture that drifts from the
 * pinned DTO fails the typecheck rather than quietly testing a shape plt never
 * sends.
 */
import type {
  PltActivity,
  PltPortfolio,
  PltPosition,
  PltSilentTrade,
  PltThesis,
  PltTradePlan,
} from '@/api/http/wire/plt'
import type { PltWatchlistCapacity, PltWatchlistList } from '@/api/http/wire/watchlist'
import type { BktExecutionOutcome } from '@/api/http/wire/bkt'

export const PORTFOLIO_FIXTURE: PltPortfolio = {
  id: '2f1d0c9e-3a4b-4c5d-8e9f-0a1b2c3d4e5f',
  account_key: 'paper-default',
  starting_capital: 100000.0,
  cash_balance: 74250.5,
  realized_pnl: 1840.25,
  unrealized_pnl: 0,
  open_positions_cost_basis: 25749.5,
  open_positions_value: 25749.5,
  total_equity: 100000.0,
  peak_equity: 101840.25,
  return_pct: 0.0,
  open_positions: 2,
  closed_positions: 3,
  open_trades: 2,
  closed_trades: 3,
  winning_trades: 2,
  losing_trades: 1,
  win_rate_pct: 66.67,
  updated_at: '2026-08-31T14:02:11Z',
}

/** An open long call. No `last_price` / `market_value` / `unrealized_pnl`:
 *  plt writes marks only at entry and close (`PortfolioService.java`). */
export const POSITION_OPEN_FIXTURE: PltPosition = {
  id: '8b7a6c5d-4e3f-4a2b-9c8d-7e6f5a4b3c2d',
  portfolio_id: PORTFOLIO_FIXTURE.id,
  silent_trade_id: 'aa11bb22-cc33-4d44-8e55-ff66aa77bb88',
  ticker: 'MU',
  occ_symbol: 'MU270115C00150000',
  option_type: 'CALL',
  side: 'LONG',
  strike: 150.0,
  expiration: '2027-01-15',
  quantity: 3,
  contract_multiplier: 100,
  entry_price: 16.2,
  cost_basis: 4860.0,
  realized_pnl: 0,
  status: 'OPEN',
  opened_at: '2026-08-24T13:45:02Z',
  decision_episode_id: 'e1e2e3e4-1111-4222-8333-444455556666',
}

/** A second open position that carries no decision episode at all — the common
 *  case, and the one that must render with no AI block rather than a fake one. */
export const POSITION_NO_EPISODE_FIXTURE: PltPosition = {
  id: '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5a',
  portfolio_id: PORTFOLIO_FIXTURE.id,
  silent_trade_id: 'bb22cc33-dd44-4e55-9f66-aa77bb88cc99',
  ticker: 'PLTR',
  occ_symbol: 'PLTR261120P00195000',
  option_type: 'PUT',
  side: 'LONG',
  strike: 195.0,
  expiration: '2026-11-20',
  quantity: 1,
  contract_multiplier: 100,
  entry_price: 12.4,
  cost_basis: 1240.0,
  realized_pnl: 0,
  status: 'OPEN',
  opened_at: '2026-08-28T15:10:44Z',
}

export const POSITIONS_FIXTURE: PltPosition[] = [POSITION_OPEN_FIXTURE, POSITION_NO_EPISODE_FIXTURE]

export const SILENT_TRADE_OPEN_FIXTURE: PltSilentTrade = {
  // Ties this trade to POSITION_OPEN_FIXTURE.silent_trade_id.
  id: 'aa11bb22-cc33-4d44-8e55-ff66aa77bb88',
  trade_plan_id: '99887766-5544-4332-8211-000fedcba987',
  ticker: 'MU',
  occ_symbol: 'MU270115C00150000',
  option_type: 'CALL',
  side: 'LONG',
  strike: 150.0,
  expiration: '2027-01-15',
  quantity: 3,
  contract_multiplier: 100,
  entry_price: 16.2,
  entry_ts: '2026-08-24T13:45:02Z',
  fees: 0.0,
  cost_basis: 4860.0,
  status: 'OPEN',
  fill_model: 'MIDPOINT_WITH_SLIPPAGE',
  decision_episode_id: 'e1e2e3e4-1111-4222-8333-444455556666',
  entry_idempotency_key: 'open-6c1f5f2a-2f36-4c31-9c0f-8b7f9d2a1e44',
  created_at: '2026-08-24T13:45:02Z',
  updated_at: '2026-08-24T13:45:02Z',
}

export const SILENT_TRADE_CLOSED_FIXTURE: PltSilentTrade = {
  id: 'cc33dd44-ee55-4f66-8a77-bb88cc99dd00',
  trade_plan_id: '11223344-5566-4778-899a-bbccddeeff00',
  ticker: 'WMT',
  occ_symbol: 'WMT260918C00105000',
  option_type: 'CALL',
  side: 'LONG',
  strike: 105.0,
  expiration: '2026-09-18',
  quantity: 2,
  contract_multiplier: 100,
  entry_price: 7.1,
  entry_ts: '2026-07-02T14:31:00Z',
  exit_price: 8.7,
  exit_ts: '2026-08-14T18:02:19Z',
  fees: 0.0,
  cost_basis: 1420.0,
  realized_pnl: 320.0,
  return_pct: 0.2253,
  status: 'CLOSED',
  created_at: '2026-07-02T14:31:00Z',
  updated_at: '2026-08-14T18:02:19Z',
}

export const SILENT_TRADES_FIXTURE: PltSilentTrade[] = [SILENT_TRADE_CLOSED_FIXTURE, SILENT_TRADE_OPEN_FIXTURE]

/** A validated plan that has not executed — a pending intent in order history. */
export const TRADE_PLAN_VALIDATED_FIXTURE: PltTradePlan = {
  id: 'aabbccdd-eeff-4011-8223-344556677889',
  thesis_id: '77665544-3322-4110-8fee-ddccbbaa9988',
  ticker: 'NVDA',
  option_type: 'CALL',
  side: 'LONG',
  leg_count: 1,
  expiration: '2026-12-18',
  dte: 109,
  strike: 190.0,
  target_entry_min: 15.0,
  target_entry_max: 16.5,
  quantity: 4,
  capital_allocation: 6400.0,
  // Fractions, not percent points (§7.1): 0.35 is +35%, 0.5 is −50%.
  profit_target_pct: 0.35,
  stop_loss_pct: 0.5,
  max_holding_days: 45,
  dte_floor: 21,
  // 0..1 on the wire; the app renders 0–100 conviction (§7.4).
  confidence: 0.72,
  risk_profile: 'moderate',
  execution_mode: 'silent',
  status: 'VALIDATED',
  created_at: '2026-08-30T17:20:00Z',
  updated_at: '2026-08-30T17:20:00Z',
  occ_symbol_expected: 'NVDA261218C00190000',
}

/** A rejected plan. `rejection_reasons` may repeat a code (§7.5). */
export const TRADE_PLAN_REJECTED_FIXTURE: PltTradePlan = {
  id: '55667788-99aa-4bbc-8dde-112233445566',
  ticker: 'COIN',
  option_type: 'PUT',
  side: 'LONG',
  leg_count: 1,
  expiration: '2026-09-01',
  dte: 0,
  strike: 240.0,
  quantity: 1,
  capital_allocation: 2180.0,
  status: 'REJECTED',
  rejection_reasons: ['DTE_LT_1', 'DTE_LT_1', 'INSUFFICIENT_CASH'],
  rejection_details: [
    { code: 'DTE_LT_1', field: 'expiration', message: 'DTE must be at least 1' },
    { code: 'INSUFFICIENT_CASH', message: 'Cost basis exceeds available cash' },
  ],
  created_at: '2026-08-31T09:14:00Z',
  updated_at: '2026-08-31T09:14:00Z',
}

/** A legacy plan: the structured-exit fields are absent entirely, not zero. */
export const TRADE_PLAN_LEGACY_FIXTURE: PltTradePlan = {
  id: 'deadbeef-0000-4111-8222-333344445555',
  ticker: 'AMD',
  option_type: 'CALL',
  side: 'LONG',
  leg_count: 1,
  expiration: '2026-10-16',
  dte: 46,
  strike: 175.0,
  quantity: 2,
  capital_allocation: 2400.0,
  status: 'EXECUTED',
  created_at: '2026-06-11T13:00:00Z',
  updated_at: '2026-06-20T13:00:00Z',
}

export const TRADE_PLANS_FIXTURE: PltTradePlan[] = [
  TRADE_PLAN_REJECTED_FIXTURE,
  TRADE_PLAN_VALIDATED_FIXTURE,
  TRADE_PLAN_LEGACY_FIXTURE,
]

/**
 * A full `ThesisResponse`.
 *
 * `confidence` is the 0..1 fraction plt sends and `time_horizon` is an
 * ISO-8601 duration — both stay in those units through the view model and are
 * only formatted at render (§7.4). Note what is *not* here and cannot be
 * invented downstream: no price, no entry band, no target band, no
 * recommendation, no expected upside.
 */
export const THESIS_FIXTURE: PltThesis = {
  id: '77665544-3322-4110-8fee-ddccbbaa9988',
  ticker: 'nvda',
  direction: 'BULLISH',
  rationale: 'Datacentre backlog covers three quarters of consensus revenue.',
  evidence: {
    iv_rank: 41.2,
    earnings_date: '2026-11-18',
    analystRevisions: 'net positive',
    passes_screen: true,
    peers: ['AMD', 'AVGO'],
    // Provenance plumbing that the view model surfaces on its own fields.
    model_version: 'gpt-mock-1',
  },
  features: { rsi_14: 61.4 },
  confidence: 0.72,
  expected_catalyst: 'Q3 print, 18 November',
  time_horizon: 'P14D',
  invalidation_conditions: ['Close below the 50-day', 'Guidance cut at the print'],
  model_version: 'gpt-mock-1',
  prompt_version: 'thesis-v3',
  strategy_version: 'strategy-v2',
  source: 'AI',
  decision_episode_id: 'e1e2e3e4-1111-4222-8333-444455556666',
  created_at: '2026-08-30T16:00:00Z',
}

/** The sparse case, and the common one: plt omits every nullable field rather
 *  than sending `null`, so the adapter must leave them `undefined` (§7.2). */
export const THESIS_SPARSE_FIXTURE: PltThesis = {
  id: '11112222-3333-4444-8555-666677778888',
  ticker: 'COIN',
  direction: 'BEARISH',
  rationale: 'Volumes are rolling over into a fee-compression cycle.',
  source: 'USER',
  created_at: '2026-08-31T08:30:00Z',
}

export const THESES_FIXTURE: PltThesis[] = [THESIS_SPARSE_FIXTURE, THESIS_FIXTURE]

export const ACTIVITY_FIXTURE: PltActivity[] = [
  {
    id: 'f0e1d2c3-b4a5-4968-8778-695a4b3c2d1e',
    ts: '2026-08-30T17:20:00Z',
    actor: 'service-ai',
    action_type: 'TRADE_PLAN_VALIDATED',
    entity_type: 'trade_plan',
    entity_id: TRADE_PLAN_VALIDATED_FIXTURE.id,
    payload: { ticker: 'NVDA', status: 'VALIDATED' },
    decision_episode_id: 'e1e2e3e4-1111-4222-8333-444455556666',
  },
  {
    id: '0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d',
    ts: '2026-08-24T13:45:02Z',
    action_type: 'SILENT_TRADE_OPENED',
    entity_type: 'silent_trade',
    entity_id: SILENT_TRADE_OPEN_FIXTURE.id,
    payload: { ticker: 'MU', quantity: 3 },
  },
  {
    id: '1b2c3d4e-5f6a-4b7c-8d8e-9f0a1b2c3d4e',
    ts: '2026-08-22T11:02:00Z',
    action_type: 'WATCHLIST_VALIDATION_CHANGED',
    entity_type: 'watchlist_entry',
    payload: { symbol: 'ARKK', new_status: 'UNRESOLVABLE' },
  },
  {
    // No payload at all — `detail` must stay absent, not become "".
    id: '2c3d4e5f-6a7b-4c8d-8e9f-0a1b2c3d4e5f',
    ts: '2026-08-21T09:00:00Z',
    action_type: 'PORTFOLIO_UPDATED',
    entity_type: 'portfolio',
  },
]

export const WATCHLIST_FIXTURE: PltWatchlistList = {
  entries: [
    {
      symbol: 'MU',
      instrument_type: 'EQUITY',
      kind: 'AI_SELECTED',
      status: 'ACTIVE',
      priority_score: 0.81,
      protected: true,
      protection_reasons: ['OPEN_POSITION'],
      has_open_trade: true,
      position_protected: true,
      added_at: '2026-08-01T12:00:00Z',
      last_promoted_at: '2026-08-24T13:00:00Z',
      last_evaluated_at: '2026-08-31T12:00:00Z',
      reason: 'Momentum + earnings catalyst',
      validation_status: 'VALID',
    },
    {
      symbol: 'SPY',
      instrument_type: 'ETF',
      kind: 'DEFAULT_PINNED',
      status: 'ACTIVE',
      protected: true,
      protection_reasons: ['DEFAULT_PINNED'],
      has_open_trade: false,
      position_protected: false,
      added_at: '2026-01-01T00:00:00Z',
      validation_status: 'VALID',
    },
    {
      symbol: 'ARKK',
      instrument_type: 'ETF',
      kind: 'USER_PINNED',
      status: 'USER_EXCLUDED',
      protected: false,
      protection_reasons: [],
      has_open_trade: false,
      position_protected: false,
      added_at: '2026-05-04T00:00:00Z',
      last_evicted_at: '2026-08-22T11:02:00Z',
      reason: 'Not tracking this any more',
      validation_status: 'UNRESOLVABLE',
    },
  ],
  active_count: 2,
  max: 125,
  available_slots: 123,
  protected_count: 2,
  unresolved_count: 1,
}

export const WATCHLIST_CAPACITY_FIXTURE: PltWatchlistCapacity = {
  active_count: 2,
  max: 125,
  available_slots: 123,
  protected_count: 2,
  unresolved_count: 1,
}

/** plt's RFC 7807 body for a PolicyGate refusal (422 `policy-rejection`). */
export const POLICY_REJECTION_PROBLEM = {
  type: 'https://stratfolio.local/problems/policy-rejection',
  title: 'Trade plan rejected',
  status: 422,
  detail: 'Trade plan rejected by policy',
  instance: '/api/v1/trade-plans',
  rejection_reasons: ['DTE_LT_1', 'DTE_LT_1'],
  errors: [{ code: 'DTE_LT_1', field: 'expiration', message: 'DTE must be at least 1' }],
  trade_plan_id: TRADE_PLAN_REJECTED_FIXTURE.id,
  status_of_record: 'REJECTED',
}

/** Watchlist capacity conflict (409). */
export const WATCHLIST_CONFLICT_PROBLEM = {
  type: 'https://stratfolio.local/problems/conflict',
  title: 'Conflict',
  status: 409,
  detail: 'Active universe is at capacity with no evictable slot',
  errors: [{ code: 'AT_CAPACITY_NO_EVICTABLE_SLOT', message: 'No evictable slot' }],
}

/** Watchlist 422 (`universe-rejection`). */
export const WATCHLIST_REJECTION_PROBLEM = {
  type: 'https://stratfolio.local/problems/universe-rejection',
  title: 'Universe rejection',
  status: 422,
  detail: 'Symbol was excluded by the user and must be restored explicitly',
  rejection_reasons: ['USER_EXCLUDED_REQUIRES_RESTORE'],
  symbol: 'ARKK',
}

/* ------------------------------------------------------------------ bkt ---- */

/**
 * A `FILLED` `ExecutionOutcome` that plt recorded.
 *
 * Unlike plt, bkt (Pydantic) sends nulls rather than omitting them, and its
 * `Decimal` fields may arrive as strings — both are represented here so the
 * adapter is tested against the encoding bkt actually produces.
 */
export const EXECUTION_FILLED_FIXTURE: BktExecutionOutcome = {
  execution_id: 'ex000001-0000-4000-8000-000000000001',
  trade_plan_id: TRADE_PLAN_VALIDATED_FIXTURE.id,
  decision_episode_id: null,
  status: 'FILLED',
  action: 'ENTRY',
  contract: {
    occ_symbol: 'NVDA261218C00190000',
    option_type: 'CALL',
    strike: '190.00',
    expiration: '2026-12-18',
    dte: 109,
    underlying_price: '178.40',
  },
  fill: {
    side: 'BUY',
    quantity: 4,
    price: '15.80',
    notional: '6320.00',
    contract_multiplier: 100,
    fees: '0.00',
    cash_effect: '-6320.00',
  },
  reason_code: null,
  fill_model: 'MIDPOINT_WITH_SLIPPAGE',
  determinism_hash: 'f00dcafe',
  silent_trade_id: 'aa11bb22-cc33-4d44-8e55-ff66aa77bb88',
  reported_to_platform: true,
  platform_error: null,
  executed_at: '2026-08-31T15:04:05Z',
  replayed: false,
}

/** A `NO_FILL`: HTTP 201, no fill, no silent trade, and nothing durable
 *  anywhere — the outcome that only exists in this response (§7.8). */
export const EXECUTION_NO_FILL_FIXTURE: BktExecutionOutcome = {
  execution_id: 'ex000002-0000-4000-8000-000000000002',
  trade_plan_id: TRADE_PLAN_VALIDATED_FIXTURE.id,
  status: 'NO_FILL',
  action: 'ENTRY',
  contract: EXECUTION_FILLED_FIXTURE.contract,
  fill: null,
  reason_code: 'ENTRY_PRICE_ABOVE_BAND',
  silent_trade_id: null,
  reported_to_platform: false,
  platform_error: null,
  executed_at: '2026-08-31T15:06:11Z',
  replayed: false,
}

/** Filled, but bkt could not tell plt. The trade happened; the system of
 *  record does not know (D3) — recoverable, never a success toast. */
export const EXECUTION_PLATFORM_ERROR_FIXTURE: BktExecutionOutcome = {
  ...EXECUTION_FILLED_FIXTURE,
  execution_id: 'ex000003-0000-4000-8000-000000000003',
  silent_trade_id: null,
  reported_to_platform: false,
  platform_error: 'platform unreachable: connection refused',
}

/** bkt's own 422, distinct from plt's: the plan reached bkt and was refused. */
export const BKT_REJECTION_PROBLEM = {
  type: 'https://stratfolio.local/problems/trade-plan-rejected',
  title: 'Trade plan rejected',
  status: 422,
  detail: 'Trade plan rejected',
  rejection_reasons: ['CONTRACT_NOT_FOUND'],
}
