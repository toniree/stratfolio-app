import type { AIAssessment, AssetType, IdeaCategory } from '@/api/types'

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
}

export type PlannerIdeaSource = 'ai' | 'user'
export type PlannerDirection = 'LONG' | 'SHORT'
export type PlannerStatus = 'draft' | 'watching' | 'ready'
export type PlannerIntent = 'open' | 'close'

/** One executable condition on a trade plan, with live met/unmet state. */
export interface PlanCriterion {
  text: string
  met: boolean
}

export interface PlannerIdea {
  id: string
  /** Exact open-position association when a plan was saved from a holding. */
  positionId?: string
  source: PlannerIdeaSource
  symbol: string
  company: string
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
  /** Concrete, checkable execution conditions; generated when absent. */
  criteria?: PlanCriterion[]
  /** One to three option contracts or setups monitored for this plan. */
  watchedOptions?: string[]
  /** AI ideas carry a full assessment; user ideas get a lightweight one. */
  ai?: AIAssessment
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
