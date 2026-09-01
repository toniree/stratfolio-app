/** Shared domain types — the *view models* every screen renders.
 *
 *  These are deliberately not the wire DTOs. Wire shapes live in
 *  `src/api/http/wire/*` and are mapped into these by the adapters in
 *  `src/api/http/adapters/*`. The rule that governs every field here: a value
 *  the backend cannot serve is `undefined`, never a fabricated zero, a coin
 *  flip, or a placeholder string. Components render an explicit unavailable
 *  state instead.
 */

export type BrokerageId =
  | 'robinhood'
  | 'schwab'
  | 'fidelity'
  | 'etrade'
  | 'webull'
  | 'ibkr'

export interface Brokerage {
  id: BrokerageId
  name: string
  short: string
  monogram: string
  accountMask: string
  /** Tailwind-friendly hex pair for the monogram badge. */
  badgeBg: string
  badgeFg: string
}

/**
 * Where a value came from, per D10. Replaces the single global "everything is
 * simulated" badge with a per-panel claim the UI can label honestly:
 *
 * - `live`      — a real provider, right now.
 * - `replay`    — a real recorded provider stream, replayed off a fixed clock.
 * - `synthetic` — generated server-side (mnd `DATA_SOURCE_SYNTHETIC`).
 * - `mock`      — the in-browser demo fixtures.
 */
export type Provenance = 'live' | 'replay' | 'synthetic' | 'mock'

export type Recommendation = 'BUY' | 'HOLD' | 'TRIM' | 'REDUCE'

export type AssetType = 'stock' | 'option' | 'etf'
export type OptionOpeningSide = 'BUY_TO_OPEN' | 'SELL_TO_OPEN'

/**
 * The intelligence layer attached to a holding or an idea.
 *
 * Always optional on the models that carry it: the platform service records a
 * `decision_episode_id`, not an assessment, so most live rows have no AI view
 * at all until service-ai exposes episode content (HKP-AI-1).
 */
export interface AIAssessment {
  /**
   * 0–100 conviction score — the app's display domain.
   *
   * Backend confidence is a 0..1 fraction on every wire DTO (thesis, plan,
   * episode). The conversion happens exactly once, in
   * `convictionFromConfidence()`, and is covered by an adapter test. Never
   * multiply by 100 anywhere else.
   */
  conviction: number
  /** Change in conviction over the last session, in the same 0–100 domain. */
  convictionDelta: number
  recommendation: Recommendation
  /** Explicit, labeled risk/reward semantics — never a bare "risk/reward" stat. */
  upsideTarget: number
  downsideRisk: number
  riskRewardRatio: number
  horizon: string
  /** Analyst-style target band. */
  targetLow: number
  targetHigh: number
  /** "Why?" bullets shown in the expandable thesis preview. */
  thesis: string[]
  /** One-line summary of the recommendation. */
  recommendationNote: string
  updatedAt: string
  /** The decision episode this assessment was read from, when there is one. */
  episodeId?: string
}

/**
 * Structured option terms. Kept as data rather than a formatted string so the
 * UI can derive breakeven, moneyness and mark from the live underlying — a
 * tile and its details page can never disagree.
 */
export interface OptionContract {
  right: 'CALL' | 'PUT'
  strike: number
  /** ISO date of expiry. */
  expiry: string
  /** Display form, e.g. "Nov 20 '26" — derived from `expiry`, never invented. */
  expiryLabel: string
  /**
   * Extrinsic value at the money, in dollars per share, used by the in-browser
   * demo option model. Absent for live positions: real extrinsic value comes
   * from the mnd chain (Wave B0), and guessing it in the browser is exactly
   * the IV/OI fabrication §6 removes.
   */
  extrinsicBase?: number
  /** Earnings print(s) the contract is deliberately sized to span. */
  earningsDate?: string
  earningsNote?: string
}

export interface Position {
  id: string
  symbol: string
  /**
   * Company name. Optional: no live-safe symbol→name source exists
   * (HKP-MND-4) and the only names in this app live in mock seed files, which
   * live adapters must not import (D4). Render the ticker when absent.
   */
  company?: string
  assetType: AssetType
  /** e.g. "Jan 16 '26 · $180 Call" — display only; `option` carries the terms. */
  contractDetail?: string
  option?: OptionContract
  /** Opening transaction direction; older long-option records default to buy-to-open. */
  openingSide?: OptionOpeningSide
  /**
   * Demo-book brokerage attribution. Dropped from live models (D3): the
   * backend has one paper portfolio, not linked brokerage accounts
   * (HKP-PLT-6), so live positions carry no brokerage at all.
   */
  brokerageId?: BrokerageId
  quantity: number
  avgCost: number
  openedAt: string
  /** Live mark per share, when a quote source has supplied one. */
  lastPrice?: number
  /** Server-computed unrealized P&L. Absent while plt holds no mark. */
  unrealizedPnl?: number
  /** Optional private note; cards prefer this over the generated AI summary. */
  userNote?: string
  ai?: AIAssessment
  /**
   * The plt silent trade behind this position.
   *
   * The only handle bkt's exit route accepts (contracts §17): a user close is
   * `POST /executions/exits {silent_trade_id, …}` — never a position id, never
   * an OCC symbol. Absent on demo-book positions and on any live row plt did
   * not link to a trade, and where it is absent closing by hand genuinely is
   * unavailable rather than merely unimplemented.
   */
  silentTradeId?: string
  provenance?: Provenance
}

export interface PortfolioAccount {
  id: string
  name: string
  subtitle: string
  isDemo: boolean
  /**
   * The paper-account identity that replaces per-brokerage attribution in
   * live mode (plt `portfolio.account_key`).
   */
  accountKey?: string
  provenance?: Provenance
}

export interface PortfolioOutlook {
  stance: string
  headline: string
  summary: string
  score: number
  scoreLabel: string
  signals: { label: string; detail: string; tone: 'positive' | 'neutral' | 'caution' }[]
  updatedAt: string
  provenance?: Provenance
}

export interface PortfolioMeta {
  buyingPower: number
  cash: number
  /** Cost basis of all currently open positions. */
  totalDeposited: number
  provenance?: Provenance
}

export type PerformancePeriod = '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL'

export interface PerformancePoint {
  /** Unix seconds (UTC). */
  time: number
  /** Multiplier relative to the current portfolio value (last point == 1). */
  multiplier: number
  /** Absolute equity in dollars, when the series has an absolute basis. */
  value?: number
}

/**
 * A performance series and the basis it is drawn on.
 *
 * There is exactly one basis per chart (plan §3.1). A `settled-equity` series
 * is realised P&L from closed trades and must never be multiplied by the live
 * marked portfolio value; a `relative-multiplier` series is scaled against the
 * live value by construction. Mixing them produces a chart that silently
 * double-counts.
 */
export type PerformanceBasis = 'settled-equity' | 'relative-multiplier'

export interface PerformanceSeries {
  basis: PerformanceBasis
  /** Human-readable claim about what the line is, shown next to the chart. */
  label: string
  points: PerformancePoint[]
  provenance: Provenance
  /**
   * True when the source list hit plt's hard `limit=500` cap and older history
   * is therefore missing (HKP-PLT-8 — no cursor pagination exists).
   */
  truncated?: boolean
}

export type IdeaCategory = 'stocks' | 'options' | 'watchlist'

export interface Idea {
  id: string
  /** Whether the thesis originated with the model or the user. */
  source?: 'ai' | 'user'
  symbol: string
  company?: string
  assetType: AssetType
  contractDetail?: string
  option?: OptionContract
  categories: IdeaCategory[]
  forYou: boolean
  referencePrice: number
  entryLow: number
  entryHigh: number
  targetLow: number
  targetHigh: number
  expectedUpsidePct: number
  ai?: AIAssessment
  catalysts: string[]
  risks: string[]
  tags: string[]
  provenance?: Provenance
}

/* ---------------------------------------------------------------------------
 * Theses — plt `GET /api/v1/theses` (APP-111).
 * ------------------------------------------------------------------------ */

export type ThesisDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL'

/** One row of the thesis `evidence` blob, flattened for rendering.
 *  plt types `evidence` as a free-form `Map<String, Object>`, so the adapter
 *  cannot promise named fields — it promises the keys the model actually sent. */
export interface ThesisEvidenceEntry {
  label: string
  value: string
}

/**
 * A thesis exactly as plt records it — nothing more.
 *
 * `ThesisResponse` carries a rationale, a direction, a confidence, an evidence
 * blob, invalidation conditions, an expected catalyst and a time horizon. It
 * carries **no price, no entry band, no target band and no recommendation**, so
 * this view model has none either: the rich `Idea` those screens were built on
 * is a demo construct and is offered here only as an optional enrichment that
 * the mock seed can supply and a live backend never can (D4, §6).
 */
export interface ThesisView {
  id: string
  symbol: string
  direction: ThesisDirection
  rationale: string
  /**
   * **A 0..1 fraction, exactly as plt sends it** (§7.4). Not a percentage and
   * not the app's 0–100 conviction domain — formatting happens at render via
   * `formatConfidence()`. A silent ×100 here is the footgun the plan calls out.
   */
  confidence?: number
  evidence?: ThesisEvidenceEntry[]
  invalidationConditions?: string[]
  expectedCatalyst?: string
  /** `time_horizon` verbatim — an ISO-8601 duration such as `P14D`. Rendered
   *  through `formatHorizon()`; never rewritten in the adapter. */
  horizon?: string
  source: 'ai' | 'user'
  modelVersion?: string
  promptVersion?: string
  strategyVersion?: string
  /** The decision episode that produced the thesis, when there is one. */
  episodeId?: string
  createdAt: string
  provenance: Provenance
  /**
   * Demo-only enrichment: the scripted idea (prices, entry/target bands,
   * recommendation, charts) behind this thesis.
   *
   * Present in mock mode only. Live theses leave it `undefined`, which is what
   * routes the UI to the plain thesis rendering instead of a tile whose every
   * number would have to be invented.
   */
  idea?: Idea
}

export type OrderSide = 'BUY' | 'SELL'

/**
 * The exact contract an order is for, taken from the live chain (APP-112).
 *
 * plt's plan → bkt's execution needs full option identity: bkt re-resolves the
 * contract from mnd and refuses a plan whose identity does not match
 * (`CONTRACT_IDENTITY_MISMATCH`). Every field here is a *server* number off the
 * chain route — nothing in the browser derives a strike, a mid or a DTE.
 */
export interface OrderContract {
  occSymbol: string
  right: 'CALL' | 'PUT'
  strike: number
  /** `YYYY-MM-DD`. */
  expiry: string
  /** mnd's own day count, not one recomputed from the browser clock. */
  dte: number
  /** Chain mid at selection; the entry band is built around it. */
  mid?: number
  bid?: number
  ask?: number
  underlyingPrice?: number
}

export interface OrderRequest {
  symbol: string
  side: OrderSide
  quantity: number
  limitPrice?: number
  estimatedPrice: number
  brokerageId?: BrokerageId
  positionId?: string
  /**
   * Whether this opens exposure or closes an existing position.
   *
   * Closing does not come through here in live mode: it is `ExitRequest` and
   * `requestExit`. bkt prices an exit itself from the current quote and its
   * body refuses a price, a side or a partial quantity (§17), none of which
   * this shape could express honestly.
   */
  intent?: 'open' | 'close'
  /** Required to open in live mode — see `OrderContract`. */
  contract?: OrderContract
  /** The thesis this order acts on, when it came from one. */
  thesisId?: string
  /** Structured exits, as **fractions** (§7.1): 0.35 is +35%. */
  profitTargetPct?: number
  stopLossPct?: number
  /**
   * Stable idempotency key for this *logical* operation (D6). A network retry
   * of the same attempt reuses it; a user's deliberate "try again" after a
   * returned NO_FILL/REJECTED is a new operation and mints a new key.
   */
  idempotencyKey?: string
}

/**
 * "Close this position, now, at whatever the model says it is worth."
 *
 * Deliberately **not** an `OrderRequest` (APP-114). bkt's exit route takes the
 * whole body and nothing else (`extra: forbid`, contracts §17): a price, a
 * reason, a quantity or a side in that body is a 422, not a field politely
 * ignored. The exit price is measured server-side from the current mnd quote
 * through the configured fill model, the reason is fixed to `USER_CLOSE`, and
 * the close is always for the whole trade. Reusing the order shape would have
 * meant carrying four fields the wire refuses and one — a limit price — the
 * user cannot influence at all.
 */
export interface ExitRequest {
  /** The app-side position, used for labels and for the demo book's own close. */
  positionId: string
  /** plt's silent trade — bkt's only handle on the position (§17). */
  silentTradeId?: string
  /**
   * The position's own ticker and contract count.
   *
   * **Never sent to bkt** — the exit body is closed and carries neither. They
   * label the returned order in the two cases the response cannot: a NO_FILL
   * has no fill to read a quantity from, and no `ExecutionOutcome` carries an
   * underlying ticker at all.
   */
  symbol: string
  quantity: number
  /**
   * Required by bkt for exits, unlike on the entry path: a close is a live
   * operation a human retries on a slow network, and the retry must be
   * answerable with the recorded outcome rather than a second attempt against
   * a newer quote (D6, §17).
   */
  idempotencyKey: string
}

/**
 * The outcome of a silent-execution attempt.
 *
 * `NO_FILL` is a *successful* bkt response (HTTP 201) that leaves no
 * silent-trade row — it is not an error and must never be rendered as one, nor
 * swallowed. `REJECTED` is plt's PolicyGate refusing the plan (422).
 */
export type OrderStatus = 'SUBMITTED' | 'FILLED' | 'NO_FILL' | 'REJECTED'

export interface Order {
  id: string
  symbol: string
  company?: string
  side: OrderSide
  quantity: number
  /** Fill/limit price per share. Absent when nothing filled. */
  price?: number
  /** Notional, when a price exists to compute it from. */
  estimatedValue?: number
  brokerageId?: BrokerageId
  status: OrderStatus
  submittedAt: string
  /**
   * bkt executed but could not report the outcome to plt. A recoverable
   * state, never a success toast (plan D3).
   */
  reportedToPlatform?: boolean
  platformError?: string
  /** PolicyGate `rejection_reasons[]`, verbatim; codes may repeat (§7.5). */
  rejectionReasons?: string[]
  /** plt trade plan behind this order, when there is one. */
  tradePlanId?: string
  /** bkt's execution id, when an execution was attempted. */
  executionId?: string
  /** bkt's own reason for a NO_FILL (`SPIKE_NO_FILL`, `ENTRY_PRICE_ABOVE_BAND`)
   *  or for a refusal, verbatim. */
  reasonCode?: string
  /** The silent trade this order created, when it filled and plt recorded it.
   *  On an exit, the trade this order *closed*. */
  silentTradeId?: string
  /**
   * bkt's server-assigned exit reason (`USER_CLOSE` for a hand close). Present
   * on EXIT outcomes only; a caller never names one (contracts §17).
   */
  exitReason?: string
  /**
   * This response replayed an outcome recorded earlier under the same
   * idempotency key — bkt answered 200, nothing was re-simulated, and no
   * second attempt was made against a newer quote.
   *
   * Read from the **HTTP status**, not the body: the exits route builds its
   * body with `outcome_from_record(...)`, which leaves the wire's own
   * `replayed` flag `false` even on a replay.
   */
  replayed?: boolean
  /**
   * True when nothing durable exists for this outcome anywhere — a `NO_FILL`,
   * or a fill plt never heard about. These rows live only in this session
   * until HKP-BKT-4 adds a list-executions route, and the UI labels them.
   */
  sessionOnly?: boolean
  /** The contract the order was for, when one was resolved. */
  contractDetail?: string
  provenance?: Provenance
}

/**
 * Activity kinds the app renders. `other` is the mandatory fallback: plt's
 * `ActionType` roster is a strict superset of these and grows independently,
 * so an unmapped type must degrade, not disappear.
 */
export type ActivityKind = 'order' | 'ai-signal' | 'thesis-update' | 'alert' | 'other'

export interface ActivityEvent {
  id: string
  kind: ActivityKind
  title: string
  /** Absent when the wire row carries no payload to describe. */
  detail?: string
  symbol?: string
  at: string
  provenance?: Provenance
}

export interface User {
  id: string
  email: string
  name: string
}

export interface Session {
  token: string
  user: User
}

/* ---------------------------------------------------------------------------
 * ActiveUniverse — the symbols the decision engine works on (plt watchlist).
 *
 * Deliberately distinct from the terminal tape (`Watchlist.tsx`), which is a
 * local, cosmetic ticker rail. Adding a symbol here changes what the AI looks
 * at; adding one there changes what the user looks at. Conflating them means a
 * casual glance at a ticker silently enrols it in the trading universe, and
 * plt's default-pinned universe floods a cosmetic rail (plan §3.8).
 * ------------------------------------------------------------------------ */

/** Why an entry is in the universe (plt `WatchlistEntryKind`). */
export type UniverseEntryKind =
  | 'DEFAULT_PINNED'
  | 'USER_PINNED'
  | 'AI_SELECTED'
  | 'EVENT_PROMOTED'

/** Membership state (plt `WatchlistStatus`). Removal is a soft exclude — plt
 *  never deletes an entry, so a re-add needs an explicit restore. */
export type UniverseStatus = 'ACTIVE' | 'USER_EXCLUDED'

/** Whether the symbol resolves to a tradable instrument (plt
 *  `ValidationStatus`). `UNRESOLVABLE` is why a symbol can sit in the universe
 *  and never produce a plan. */
export type UniverseValidationStatus = 'UNVALIDATED' | 'VALID' | 'UNRESOLVABLE'

export type UniverseInstrumentType = 'EQUITY' | 'ETF' | 'UNKNOWN'

export interface UniverseEntry {
  symbol: string
  instrumentType: UniverseInstrumentType
  kind: UniverseEntryKind
  status: UniverseStatus
  /** 0..1 ranking score; absent until the engine has evaluated the symbol. */
  priorityScore?: number
  /** Protected entries cannot be evicted to make room for a new candidate. */
  isProtected: boolean
  protectionReasons: string[]
  hasOpenTrade: boolean
  positionProtected: boolean
  addedAt?: string
  lastPromotedAt?: string
  lastEvictedAt?: string
  lastEvaluatedAt?: string
  reason?: string
  validationStatus: UniverseValidationStatus
  provenance: Provenance
}

export interface UniverseCapacity {
  activeCount: number
  max: number
  availableSlots: number
  protectedCount: number
  unresolvedCount: number
}

export interface ActiveUniverse {
  entries: UniverseEntry[]
  capacity: UniverseCapacity
  provenance: Provenance
}
