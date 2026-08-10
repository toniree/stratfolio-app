/** Shared domain types. These describe the wire contract the real backend
 *  will eventually satisfy — the mock implementations are interchangeable. */

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

export type Recommendation = 'BUY' | 'HOLD' | 'TRIM' | 'REDUCE'

export type AssetType = 'stock' | 'option' | 'etf'
export type OptionOpeningSide = 'BUY_TO_OPEN' | 'SELL_TO_OPEN'

/** The intelligence layer attached to a holding or an idea. */
export interface AIAssessment {
  /** 0–100 conviction score. */
  conviction: number
  /** Change in conviction over the last session. */
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
  /** Display form, e.g. "Nov 20 '26". */
  expiryLabel: string
  /**
   * Extrinsic value at the money, in dollars per share. Stands in for
   * time-value + implied vol; decays as the contract moves away from strike.
   */
  extrinsicBase: number
  /** Earnings print(s) the contract is deliberately sized to span. */
  earningsDate?: string
  earningsNote?: string
}

export interface Position {
  id: string
  symbol: string
  company: string
  assetType: AssetType
  /** e.g. "Jan 16 '26 · $180 Call" — display only; `option` carries the terms. */
  contractDetail?: string
  option?: OptionContract
  /** Opening transaction direction; older long-option records default to buy-to-open. */
  openingSide?: OptionOpeningSide
  brokerageId: BrokerageId
  quantity: number
  avgCost: number
  openedAt: string
  /** Optional private note; cards prefer this over the generated AI summary. */
  userNote?: string
  ai: AIAssessment
}

export interface PortfolioAccount {
  id: string
  name: string
  subtitle: string
  isDemo: boolean
}

export interface PortfolioOutlook {
  stance: string
  headline: string
  summary: string
  score: number
  scoreLabel: string
  signals: { label: string; detail: string; tone: 'positive' | 'neutral' | 'caution' }[]
  updatedAt: string
}

export interface PortfolioMeta {
  buyingPower: number
  cash: number
  /** Cost basis of all currently open positions. */
  totalDeposited: number
}

export type PerformancePeriod = '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL'

export interface PerformancePoint {
  /** Unix seconds (UTC). */
  time: number
  /** Multiplier relative to the current portfolio value (last point == 1). */
  multiplier: number
}

export type IdeaCategory = 'stocks' | 'options' | 'watchlist'

export interface Idea {
  id: string
  /** Whether the thesis originated with the model or the user. */
  source?: 'ai' | 'user'
  symbol: string
  company: string
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
  ai: AIAssessment
  catalysts: string[]
  risks: string[]
  tags: string[]
}

export type OrderSide = 'BUY' | 'SELL'

export interface OrderRequest {
  symbol: string
  side: OrderSide
  quantity: number
  limitPrice?: number
  estimatedPrice: number
  brokerageId: BrokerageId
  positionId?: string
}

export interface Order {
  id: string
  symbol: string
  company: string
  side: OrderSide
  quantity: number
  price: number
  estimatedValue: number
  brokerageId: BrokerageId
  status: 'SUBMITTED' | 'FILLED'
  submittedAt: string
}

export interface ActivityEvent {
  id: string
  kind: 'order' | 'ai-signal' | 'thesis-update' | 'alert'
  title: string
  detail: string
  symbol?: string
  at: string
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
