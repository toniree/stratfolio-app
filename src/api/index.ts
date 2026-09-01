import type {
  ActiveUniverseApi,
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
import { mockActiveUniverseApi } from '@/api/mock/MockActiveUniverseApi'
import { httpPortfolioApi } from '@/api/http/HttpPortfolioApi'
import { httpIdeasApi } from '@/api/http/HttpIdeasApi'
import { httpActiveUniverseApi } from '@/api/http/HttpActiveUniverseApi'
import { httpMarketDataApi } from '@/api/http/HttpMarketDataApi'
import { marketDataSimulator } from '@/api/marketData/MarketDataSimulator'
import { PollingQuoteProvider } from '@/api/marketData/PollingQuoteProvider'
import type { MarketDataApi, QuoteProvider } from '@/api/marketData/types'
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

// plt's watchlist API is complete and browser-ready today — the app simply
// never called it. Its own flag, because the ActiveUniverse is a different
// product from the portfolio (plan §3.8).
export const activeUniverseApi: ActiveUniverseApi = isLive('universe')
  ? httpActiveUniverseApi
  : mockActiveUniverseApi

/**
 * Market data (APP-108, Wave B0).
 *
 * `quoteProvider` feeds the price store; `marketDataApi` is the request/response
 * seam for bars, chains and status. In mock mode the API seam is `null` rather
 * than a simulated implementation: chains and bars are the surfaces the app
 * used to fabricate in the browser, and a "mock market API" would be the same
 * fabrication wearing a live-looking interface. Hooks check for `null` and the
 * mock components keep their own clearly labelled synthetic renderings.
 */
export const quoteProvider: QuoteProvider = isLive('market')
  ? new PollingQuoteProvider()
  : marketDataSimulator

export const marketDataApi: MarketDataApi | null = isLive('market') ? httpMarketDataApi : null

/**
 * Theses — plt `GET /api/v1/theses` (APP-111).
 *
 * Read-only in both modes. The seam speaks `ThesisView`; the demo's rich
 * `Idea` (prices, entry/target bands, recommendation) rides along on
 * `ThesisView.idea`, which only the mock can populate.
 */
export const ideasApi: IdeasApi = isLive('ideas') ? httpIdeasApi : mockIdeasApi

// Blocked on backend capability, or on a later wave — see `.env.example` and
// `../stratfolio/docs/plans/APP_HOOKUP_BACKEND_GAPS_V1.md`.
export const newsApi: NewsApi = mockNewsApi // HKP-MND-2
export const plannerApi: PlannerApi = mockPlannerApi // APP-113 (Wave B)
export const authApi: AuthApi = mockAuthApi // HKP-AUTH-1 — V1 has zero auth
export const assistantApi: AssistantApi = mockAssistantApi // HKP-AI-2
