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

export type OrderSide = 'BUY' | 'SELL'

export interface OrderRequest {
  symbol: string
  side: OrderSide
  quantity: number
  limitPrice?: number
  estimatedPrice: number
  brokerageId?: BrokerageId
  positionId?: string
  /**
   * Stable idempotency key for this *logical* operation (D6). A network retry
   * of the same attempt reuses it; a user's deliberate "try again" after a
   * returned NO_FILL/REJECTED is a new operation and mints a new key.
   */
  idempotencyKey?: string
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
