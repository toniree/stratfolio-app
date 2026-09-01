import type {
  ActiveUniverse,
  ActivityEvent,
  ExitRequest,
  Order,
  OrderRequest,
  PerformancePeriod,
  PerformanceSeries,
  PortfolioAccount,
  PortfolioMeta,
  PortfolioOutlook,
  Position,
  ThesisView,
  UniverseEntry,
} from '@/api/types'
import type {
  CreatePlannerIdeaInput,
  NewsArticle,
  PlannerIdea,
  UpdatePlannerIdeaInput,
} from '@/api/newsTypes'

/**
 * Transport-agnostic API contracts.
 *
 * Components depend only on these interfaces via TanStack Query hooks, so an
 * `HttpPortfolioApi` can replace `MockPortfolioApi` later without touching a
 * single component.
 */
export interface PortfolioApi {
  getAccounts(): Promise<PortfolioAccount[]>
  getPositions(accountId: string): Promise<Position[]>
  getMeta(accountId: string): Promise<PortfolioMeta>
  getOutlook(accountId: string): Promise<PortfolioOutlook>
  getPerformance(accountId: string, period: PerformancePeriod): Promise<PerformanceSeries>
  submitOrder(request: OrderRequest): Promise<Order>
  /**
   * Close a position the user is holding, now (APP-114).
   *
   * Its own seam method rather than a `submitOrder({intent:'close'})`, because
   * an exit is a different operation with a different wire: bkt's
   * `POST /executions/exits` takes a silent-trade id and an idempotency key and
   * **refuses every other field** (contracts §17). There is no limit price to
   * pass — the deterministic exit fill model prices the close off the current
   * mnd quote — no side to choose, and no partial quantity.
   */
  requestExit(request: ExitRequest): Promise<Order>
  addPositionFromIdea(accountId: string, ideaId: string, quantity: number): Promise<Position>
  getActivity(): Promise<ActivityEvent[]>
  /**
   * Order history. Promoted to the seam because live mode has to *merge* three
   * sources — plt silent trades (fills and closes), plt trade plans that are
   * validated-but-unfilled or rejected, and session-retained bkt outcomes that
   * left no durable row (NO_FILL / platform_error, HKP-BKT-4).
   */
  getOrders(): Promise<Order[]>
}

/**
 * Theses — plt's `ThesisResponse`, and nothing else (APP-111).
 *
 * The seam used to be `getIdeas(): Idea[]`, where `Idea` carried a reference
 * price, an entry band, a target band, an expected upside and a recommendation.
 * plt records none of those on a thesis, so a live implementation of that
 * interface would have had to invent five numbers per row. The seam now speaks
 * `ThesisView`; the scripted `Idea` rides along on `ThesisView.idea` in mock
 * mode, and its absence is what tells a component to render the thesis plainly.
 */
export interface IdeasApi {
  getTheses(): Promise<ThesisView[]>
  getThesis(id: string): Promise<ThesisView | undefined>
}

export interface NewsApi {
  getArticles(): Promise<NewsArticle[]>
  getArticle(id: string): Promise<NewsArticle | undefined>
}

export interface PlannerApi {
  getIdeas(): Promise<PlannerIdea[]>
  getIdea(id: string): Promise<PlannerIdea | undefined>
  createIdea(input: CreatePlannerIdeaInput): Promise<PlannerIdea>
  updateIdea(id: string, input: UpdatePlannerIdeaInput): Promise<PlannerIdea>
  deleteIdea(id: string): Promise<void>
}

export interface AssistantReply {
  text: string
  intent: string
  symbol?: string
}

export interface AssistantApi {
  ask(question: string): Promise<AssistantReply>
}

export interface AuthApi {
  signup(email: string, password: string, name: string): Promise<import('@/api/types').Session>
  login(email: string, password: string): Promise<import('@/api/types').Session>
  logout(): Promise<void>
}

/**
 * The ActiveUniverse — plt `/api/v1/watchlist*`.
 *
 * Its own seam, not part of `PortfolioApi`, because it is a different product
 * from the terminal tape (plan §3.8). This one governs what the decision
 * engine looks at: capacity, pinning, AI promotion and symbol validation.
 * `Watchlist.tsx` stays local and must never call any of this.
 */
export interface ActiveUniverseApi {
  getUniverse(): Promise<ActiveUniverse>
  /** Add or re-add a symbol. plt honours `pinned` only for `source: USER`. */
  addSymbol(symbol: string, input: AddUniverseSymbolInput): Promise<UniverseEntry>
  setPinned(symbol: string, pinned: boolean): Promise<UniverseEntry>
  /**
   * Bring back a user-excluded symbol.
   *
   * Separate from `addSymbol` because plt's exclusion is sticky: a plain add
   * on an excluded symbol is refused with `USER_EXCLUDED_REQUIRES_RESTORE`
   * (422), which is deliberate — an AI promotion must not silently undo a
   * user's decision to drop a symbol.
   */
  restoreSymbol(symbol: string): Promise<UniverseEntry>
  /** Soft-exclude. plt never deletes an entry; it records who excluded it. */
  excludeSymbol(symbol: string, reason?: string): Promise<UniverseEntry>
}

export interface AddUniverseSymbolInput {
  source: 'USER' | 'AI' | 'NEWS' | 'SYSTEM'
  pinned?: boolean
  reason?: string
}
