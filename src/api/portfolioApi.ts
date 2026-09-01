import type {
  ActivityEvent,
  Idea,
  Order,
  OrderRequest,
  PerformancePeriod,
  PerformanceSeries,
  PortfolioAccount,
  PortfolioMeta,
  PortfolioOutlook,
  Position,
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

export interface IdeasApi {
  getIdeas(): Promise<Idea[]>
  getIdea(id: string): Promise<Idea | undefined>
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
