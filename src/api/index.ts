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
import { httpPortfolioApi } from '@/api/http/HttpPortfolioApi'
import { isLive } from '@/api/http/env'

/**
 * The single swap point for the entire data layer.
 *
 * The switch is per domain (D2), not global: the portfolio can be live against
 * plt while news stays mocked because no browser-reachable news API exists
 * (HKP-MND-2). Bindings are resolved once at module load from build-time env
 * flags, so a domain cannot change source mid-session and there is no runtime
 * path that silently falls back to mock data when a live call fails.
 *
 * This file is the *only* place mock and live implementations meet. Live
 * adapters under `src/api/http/**` may not import from `src/api/mock/**` at
 * all — enforced by `.oxlintrc.json` and `importBoundary.test.ts` (D4).
 */
export const portfolioApi: PortfolioApi = isLive('portfolio') ? httpPortfolioApi : mockPortfolioApi

// Blocked on backend capability, or on a later wave — see `.env.example` and
// `../stratfolio/docs/plans/APP_HOOKUP_BACKEND_GAPS_V1.md`.
export const ideasApi: IdeasApi = mockIdeasApi // APP-111 (Wave B)
export const newsApi: NewsApi = mockNewsApi // HKP-MND-2
export const plannerApi: PlannerApi = mockPlannerApi // APP-113 (Wave B)
export const authApi: AuthApi = mockAuthApi // HKP-AUTH-1 — V1 has zero auth
export const assistantApi: AssistantApi = mockAssistantApi // HKP-AI-2
