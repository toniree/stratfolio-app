import type {
  AssistantApi,
  AuthApi,
  IdeasApi,
  NewsApi,
  PlannerApi,
  PortfolioApi,
} from '@/api/portfolioApi'
import { mockPortfolioApi } from '@/api/mock/MockPortfolioApi'
import { mockIdeasApi } from '@/api/mock/MockIdeasApi'
import { mockNewsApi } from '@/api/mock/MockNewsApi'
import { mockPlannerApi } from '@/api/mock/MockPlannerApi'
import { mockAuthApi } from '@/api/mock/MockAuthApi'
import { mockAssistantApi } from '@/api/mock/MockAssistantApi'

/**
 * The single swap point for the entire data layer.
 *
 * Replace these bindings with `HttpPortfolioApi` etc. when a backend exists —
 * no component or hook changes required.
 */
export const portfolioApi: PortfolioApi = mockPortfolioApi
export const ideasApi: IdeasApi = mockIdeasApi
export const newsApi: NewsApi = mockNewsApi
export const plannerApi: PlannerApi = mockPlannerApi
export const authApi: AuthApi = mockAuthApi
export const assistantApi: AssistantApi = mockAssistantApi
