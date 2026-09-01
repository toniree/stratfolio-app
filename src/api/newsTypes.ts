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

export interface PlannerIdea {
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
  title: string
  /** Original instruction that produced the plan; shown verbatim in position plan summaries. */
  originalPrompt?: string
  notes: string
  /** Maximum capital the user permits this plan to deploy. */
  maxAmount?: number
  entryLow: number
  entryHigh: number
  targetLow: number
  targetHigh: number
  stop: number
  horizon: string
  expectedUpsidePct: number
  categories: IdeaCategory[]
  catalysts: string[]
  risks: string[]
  createdAt: string
  author: string
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
  provenance?: Provenance
}

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
