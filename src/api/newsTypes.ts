import type { AIAssessment, AssetType, IdeaCategory, Provenance } from '@/api/types'

export type NewsSentiment = 'bullish' | 'bearish' | 'neutral'

export interface NewsTicker {
  symbol: string
  company: string
}

export interface NewsArticle {
  id: string
  headline: string
  source: string
  author: string
  publishedAt: string
  /** Short deck shown on the feed card. */
  summary: string
  /** Full body paragraphs for the article view. */
  body: string[]
  tickers: NewsTicker[]
  sentiment: NewsSentiment
  topics: string[]
  readMinutes: number
  /** Id of the optional AI plan derived from this article. */
  tradeIdeaId?: string
  provenance?: Provenance
}

export type PlannerIdeaSource = 'ai' | 'user'
export type PlannerDirection = 'LONG' | 'SHORT'
export type PlannerIntent = 'open' | 'close'

/**
 * Plan status.
 *
 * The first three are local-only states for plans that have never reached the
 * platform service. The rest are the complete plt `TradePlanStatus` enum
 * (`PROPOSED | VALIDATED | REJECTED | EXECUTED | CANCELLED`) lower-cased —
 * every value must be handled, including `cancelled`, which the enum defines
 * but no plt service path currently sets (HKP-PLT-4).
 */
export type PlannerStatus =
  | 'draft'
  | 'watching'
  | 'ready'
  | 'proposed'
  | 'validated'
  | 'rejected'
  | 'executed'
  | 'cancelled'

/** Statuses that came from plt rather than local state. */
export const PLATFORM_PLAN_STATUSES = [
  'proposed',
  'validated',
  'rejected',
  'executed',
  'cancelled',
] as const

/**
 * Whether a criterion currently holds.
 *
 * `unknown` is the honest default and the only value a live plan can carry:
 * no backend owns typed entry criteria (HKP-XSV-1), so nothing can evaluate
 * one. It replaces the PRNG coin-flip `met: boolean` that §6 deletes.
 */
export type CriterionState = 'met' | 'unmet' | 'unknown'

/** One condition on a trade plan, with its evaluation state. */
export interface PlanCriterion {
  text: string
  state: CriterionState
}

/**
 * A trade plan as the app renders it — plt's `TradePlanResponse` (APP-113).
 *
 * The demo book specifies a title, an author, an entry band, a target band and
 * an absolute stop for every plan. plt specifies a **contract**, an entry price
 * band (`target_entry_min/max`) and *fractional* exits — and has no field at
 * all for a title, an author, a target band or an absolute stop (§3.3). So
 * those are optional here and the screens render an explicit absence, rather
 * than the adapter inventing five numbers and a byline per row.
 *
 * `PlannerIdea` remains as an alias: the planner surfaces were written against
 * that name and renaming ~20 files would bury the change that matters.
 */
export interface PlanView {
  id: string
  /** Exact open-position association when a plan was saved from a holding. */
  positionId?: string
  source: PlannerIdeaSource
  symbol: string
  /** Optional — no live-safe symbol→company source exists (HKP-MND-4). */
  company?: string
  assetType: AssetType
  contractDetail?: string
  direction: PlannerDirection
  /** Whether triggering the plan opens exposure or closes an existing position. */
  intent?: PlannerIntent
  status: PlannerStatus
  /** Demo plans carry a written title; plt has no such field, so a live plan
   *  falls back to its contract identity at render. */
  title?: string
  /** Original instruction that produced the plan; shown verbatim in position plan summaries. */
  originalPrompt?: string
  notes: string
  /** Maximum capital the user permits this plan to deploy. Live: plt's
   *  `capital_allocation`. */
  maxAmount?: number
  /** plt's `target_entry_min`/`target_entry_max` — the one real, server-checked
   *  criterion a plan carries (`PolicyGate` validates the band). */
  entryLow?: number
  entryHigh?: number
  /** Demo-only: plt records exits as fractions, not as absolute price levels. */
  targetLow?: number
  targetHigh?: number
  stop?: number
  /** Structured exits as **fractions** (§7.1): 0.35 is +35%. Absent on legacy
   *  plans — absent, not zero. */
  profitTargetPct?: number
  stopLossPct?: number
  maxHoldingDays?: number
  dteFloor?: number
  horizon?: string
  expectedUpsidePct?: number
  categories: IdeaCategory[]
  catalysts: string[]
  risks: string[]
  createdAt: string
  /** Demo-only byline. plt records no author on a plan. */
  author?: string
  /** Present when the idea was generated from a news article. */
  sourceArticleId?: string
  sourceArticleHeadline?: string
  /** Free-form related-news context for user-created position plans. */
  relatedNews?: string
  /** Free-text conditions recorded with the plan. Nothing evaluates them. */
  criteria?: PlanCriterion[]
  /** One to three option contracts or setups monitored for this plan. */
  watchedOptions?: string[]
  /** AI ideas carry a full assessment; user ideas get a lightweight one. */
  ai?: AIAssessment
  /** PolicyGate `rejection_reasons[]`, verbatim, when status is `rejected`. */
  rejectionReasons?: string[]
  /** The thesis this plan was derived from, when plt recorded one. */
  thesisId?: string
  /** 0..1 fraction, exactly as plt sends it (§7.4). Formatted at render. */
  confidence?: number
  /** Contract identity, when the plan names one. */
  optionType?: 'CALL' | 'PUT'
  strike?: number
  expiration?: string
  dte?: number
  quantity?: number
  /** plt's derived `occ_symbol_expected` — the contract bkt will re-resolve. */
  occSymbol?: string
  decisionEpisodeId?: string
  provenance?: Provenance
}

/** Transitional alias — see `PlanView`. */
export type PlannerIdea = PlanView

export interface CreatePlannerIdeaInput {
  symbol: string
  company?: string
  positionId?: string
  assetType?: AssetType
  contractDetail?: string
  direction: PlannerDirection
  intent?: PlannerIntent
  title: string
  originalPrompt?: string
  notes: string
  maxAmount?: number
  entryLow: number
  entryHigh: number
  targetLow: number
  targetHigh: number
  stop: number
  horizon: string
  risk?: string
  relatedNews?: string
  watchedOptions?: string[]
  /**
   * Full option identity from the live chain.
   *
   * Required to create a plan against plt: a trade plan *is* a contract plus a
   * band, and `PolicyGate` refuses one whose option type, strike, expiration
   * or DTE it cannot check (`INVALID_STRIKE`, `MISSING_EXPIRATION`,
   * `DTE_LT_1`). Absent in the demo book, where plans are prose.
   */
  contract?: import('@/api/types').OrderContract
  /** Contracts to plan for. Defaults to 1 when the caller does not size it. */
  quantity?: number
  /** Structured exits as **fractions** (§7.1), when the caller sets them. */
  profitTargetPct?: number
  stopLossPct?: number
  /** The thesis this plan acts on, when it came from one. */
  thesisId?: string
}

export interface UpdatePlannerIdeaInput {
  criteria?: PlanCriterion[]
  intent?: PlannerIntent
  originalPrompt?: string
  notes?: string
  maxAmount?: number
  entryLow?: number
  entryHigh?: number
  targetLow?: number
  targetHigh?: number
  stop?: number
  horizon?: string
  risk?: string
  relatedNews?: string
  watchedOptions?: string[]
}
