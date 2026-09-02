import type {
  ActiveUniverseApi,
  AssistantApi,
  AuthApi,
  ExecutionPolicyApi,
  IdeasApi,
  NewsApi,
  PlannerApi,
  PortfolioApi,
  ResearchApi,
} from '@/api/portfolioApi'
import { mockPortfolioApi } from '@/api/mock/MockPortfolioApi'
import { mockIdeasApi } from '@/api/mock/MockIdeasApi'
import { mockNewsApi } from '@/api/mock/MockNewsApi'
import { mockPlannerApi } from '@/api/mock/MockPlannerApi'
import { mockAuthApi } from '@/api/mock/MockAuthApi'
import { mockAssistantApi } from '@/api/mock/MockAssistantApi'
import { mockActiveUniverseApi } from '@/api/mock/MockActiveUniverseApi'
import { mockResearchApi } from '@/api/mock/MockResearchApi'
import { httpPortfolioApi } from '@/api/http/HttpPortfolioApi'
import { httpIdeasApi } from '@/api/http/HttpIdeasApi'
import { httpPlannerApi } from '@/api/http/HttpPlannerApi'
import { httpActiveUniverseApi } from '@/api/http/HttpActiveUniverseApi'
import { httpExecutionPolicyApi } from '@/api/http/HttpExecutionPolicyApi'
import { httpMarketDataApi } from '@/api/http/HttpMarketDataApi'
import { httpResearchApi } from '@/api/http/HttpResearchApi'
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

/**
 * Trade plans — plt `GET/POST /api/v1/trade-plans` (APP-113).
 *
 * Reads and creation are live; edit, disable and delete have no plt route at
 * all (HKP-PLT-4) and are recorded locally plus as a schema-valid activity row.
 */
export const plannerApi: PlannerApi = isLive('planner') ? httpPlannerApi : mockPlannerApi

/**
 * The execution policy plt enforces (APP-114, contracts §16).
 *
 * `null` in mock mode, like `marketDataApi`: these three settings are the ones
 * whose whole point is that a *server* checks them. A mock implementation
 * would be a client-side kill switch again, and the settings UI would have no
 * way to tell the user which of the two it was looking at. Mock mode keeps its
 * device-local toggles and labels them as such.
 */
export const executionPolicyApi: ExecutionPolicyApi | null = isLive('portfolio')
  ? httpExecutionPolicyApi
  : null

/**
 * Research — bkt backtests (APP-122, Wave C).
 *
 * Live mode runs the real engine: the library prunes to the presets bkt's V1
 * universe can express, and the deterministic in-browser engine
 * (`simulateRun`) is confined to the mock binding, where every run it produces
 * is labelled simulated (§6). The two modes report different quantities and
 * say which is which — bkt reports realised P/L, a fill rate and §19 execution
 * evidence; the demo engine reports a shaped CAGR and equity curve.
 */
export const researchApi: ResearchApi = isLive('research') ? httpResearchApi : mockResearchApi

// Blocked on backend capability, or on a later wave — see `.env.example` and
// `../stratfolio/docs/plans/APP_HOOKUP_BACKEND_GAPS_V1.md`.
export const newsApi: NewsApi = mockNewsApi // HKP-MND-2
export const authApi: AuthApi = mockAuthApi // HKP-AUTH-1 — V1 has zero auth
export const assistantApi: AssistantApi = mockAssistantApi // HKP-AI-2
