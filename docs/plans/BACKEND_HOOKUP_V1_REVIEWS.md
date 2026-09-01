# Backend Hookup V1 Plan Reviews

## Codex review — 2026-08-31

Code was treated as ground truth. I reviewed the app data layer and consumers plus the current `service-plt`, `service-bkt`, `service-ai`, and `service-mnd` implementations/protos.

### §9 checklist verdicts

1. **Contract truth — FAIL; the mapping needs contract corrections before implementation.**

   Spot checks against the actual DTOs/routes found the following:

   - `getMeta`: `totalDeposited -> starting_capital` is wrong. The app defines `totalDeposited` as open-position cost basis and its mock computes exactly that (`src/api/types.ts:108-113`, `src/api/mock/MockPortfolioApi.ts:121-128`). PLT exposes that value as `open_positions_cost_basis`; `starting_capital` is a different field (`../stratfolio/service-plt/src/main/java/com/stratfolio/plt/web/dto/PortfolioResponse.java:14-23`). Correct mapping: `cash -> cash_balance`, `buyingPower -> cash_balance` if that product decision is retained, and `totalDeposited -> open_positions_cost_basis`.
   - Positions: the PLT row is substantially correct for option identity and accounting fields (`../stratfolio/service-plt/src/main/java/com/stratfolio/plt/web/dto/PositionResponse.java:11-32`), but the promised “episode assessment else omitted” cannot satisfy the current app contract. `Position.ai` and every field of `AIAssessment` are required (`src/api/types.ts:28-48`, `src/api/types.ts:72-89`), and consumers dereference them unconditionally (`src/lib/portfolioMath.ts:110-113`, `src/components/trade/TradeTicket.tsx:348-353`). The AI episode endpoint returns a generic episode view (`../stratfolio/service-ai/src/stratfolio_ai/app.py:196-199`, `../stratfolio/service-ai/src/stratfolio_ai/app.py:797-809`); its stored fields include confidence/decision and audit data, not the complete app assessment (`../stratfolio/service-ai/src/stratfolio_ai/episodes.py:35-96`). Missing fields must stay missing, so an adapter cannot manufacture the current `AIAssessment`.
   - Activity: the row names the source field `action`, but the actual snake-case wire field is `action_type` because the DTO member is `actionType` and PLT uses `SNAKE_CASE` (`../stratfolio/service-plt/src/main/java/com/stratfolio/plt/web/dto/ActivityResponse.java:9-17`, `../stratfolio/service-plt/src/main/resources/application.yml:34-42`). The `ActionType` roster is also much broader than the app's four `kind` values, so the adapter needs a complete mapping plus an honest fallback (`../stratfolio/service-plt/src/main/java/com/stratfolio/plt/domain/ActionType.java:7-33`, `src/api/types.ts:174-181`).
   - Theses: `ThesisResponse` has ticker, direction, rationale, evidence/features maps, confidence, one `expectedCatalyst`, horizon, and invalidation conditions (`../stratfolio/service-plt/src/main/java/com/stratfolio/plt/web/dto/ThesisResponse.java:12-29`). It does **not** have company, asset/contract detail, reference/entry/target prices, expected upside, recommendation, target band, tags, or catalyst/risk arrays required by `Idea`/`AIAssessment` (`src/api/types.ts:28-48`, `src/api/types.ts:126-147`). Calling the row merely PARTIAL is not an implementable field map while app types remain frozen.
   - Trade-plan reads: `TradePlanResponse` supplies option terms, entry band, structured percentage exits, conditions, confidence/reasoning, provenance versions, and backend status (`../stratfolio/service-plt/src/main/java/com/stratfolio/plt/web/dto/TradePlanResponse.java:13-86`). It does **not** supply the required `PlannerIdea` company, title, absolute target band, absolute stop, categories, catalysts, risks, or author (`src/api/newsTypes.ts:39-80`). A thesis join still would not supply most of those values. This row also needs type/UI changes rather than a thin lossless adapter.
   - Open order: the proposed PLT→BKT chain is the correct backend ownership boundary, but the current `OrderRequest`/ticket cannot construct a valid plan: it carries only symbol, side, quantity, estimated/limit price, brokerage, and optional position id (`src/api/types.ts:151-159`, `src/components/trade/TradeTicket.tsx:84-95`). The plan request surface includes option type, long side, leg/expiry/strike, entry band, risk/execution modes, reasoning/provenance, and exits (`../stratfolio/service-plt/src/main/java/com/stratfolio/plt/web/dto/CreateTradePlanRequest.java:36-85`), while PolicyGate enforces the single-leg, long-option, DTE, and silent-mode rules (`../stratfolio/service-plt/src/main/java/com/stratfolio/plt/policy/PolicyGate.java:70-104`). APP-112 therefore needs an explicit plan/thesis-backed order input or a redesigned option-plan ticket; a transport adapter alone is insufficient.
   - Execution outcome: BKT accepts IDs only, with `idempotency_key` in the **body**, and returns `FILLED` or the equally successful `NO_FILL` on 201 (`../stratfolio/service-bkt/src/stratfolio_bkt/api/executions.py:1-27`, `../stratfolio/service-bkt/src/stratfolio_bkt/api/executions.py:70-87`, `../stratfolio/service-bkt/src/stratfolio_bkt/api/executions.py:109-142`). The current app order status permits only `SUBMITTED | FILLED` (`src/api/types.ts:161-172`). Wave B's proof must not require “sees fill”; it must assert and render both outcomes, including `reason_code`, `reported_to_platform`, and `platform_error` (`../stratfolio/service-bkt/src/stratfolio_bkt/execution/engine.py:121-160`).
   - Backtests: the plan's “synchronous despite 202” claim is correct (`../stratfolio/service-bkt/src/stratfolio_bkt/api/backtests.py:1-11`, `../stratfolio/service-bkt/src/stratfolio_bkt/api/backtests.py:53-87`). The supported surface really is long single-leg CALL/PUT with bounded DTE and structured exits (`../stratfolio/service-bkt/src/stratfolio_bkt/backtest/models.py:44-97`, `../stratfolio/service-bkt/src/stratfolio_bkt/backtest/models.py:112-152`).
   - Market/news: the plan is correct that the user-facing data is gRPC-only today. Market RPCs and their shapes are defined in `../stratfolio/proto/stratfolio/marketdata/v1/market_data.proto:28-59`; MND's HTTP mux exposes only health/metrics/admin operations (`../stratfolio/service-mnd/internal/httpapi/server.go:73-96`). News has headline/summary/url and no article body or sentiment (`../stratfolio/proto/stratfolio/news/v1/news.proto:133-200`).

2. **Accidental-live-trading audit — PASS, with a release gate.**

   Waves A-C name only PLT trade-plan/silent-trade routes and BKT execution routes. PLT labels the controller as simulated and states that no live orders exist (`../stratfolio/service-plt/src/main/java/com/stratfolio/plt/web/SilentTradeController.java:28-32`). Its PolicyGate rejects non-silent execution modes (`../stratfolio/service-plt/src/main/java/com/stratfolio/plt/policy/PolicyGate.java:101-104`). BKT states that it has no brokerage integration or order-submission path and rechecks the long single-leg option policy (`../stratfolio/service-bkt/src/stratfolio_bkt/app.py:45-52`); its entry engine can only issue a simulated BUY into its fill model (`../stratfolio/service-bkt/src/stratfolio_bkt/execution/engine.py:355-374`). The registered BKT routers are executions, monitor, backtests, and experiments—no broker route (`../stratfolio/service-bkt/src/stratfolio_bkt/app.py:260-265`). Keep an explicit automated assertion/grep in each wave proof that no brokerage SDK/client or non-silent endpoint has entered the app or BKT dependency graph.

3. **D1 proxy vs CORS — FAIL for an installed/live PWA; acceptable only for the dev-server milestone.**

   A Vite `server.proxy` exists only while running the development server. The service worker is deliberately registered only in production builds (`src/main.tsx:12-15`), so `npm run dev` cannot prove installed-PWA/service-worker behavior. The production worker is scoped from the relative manifest/start URL (`public/manifest.webmanifest:5-8`) and currently cache-intercepts same-origin GETs (`public/service-worker.js:19-47`). On GitHub Pages the build base is `/stratfolio-app/` (`vite.config.ts:8-10`), while absolute `/plt/*` calls target the GitHub origin outside that app path/scope; a service-worker bypass cannot create a reverse proxy. The plan itself limits GitHub Pages to mock mode (`docs/plans/BACKEND_HOOKUP_V1_PLAN.md:169`), which contradicts treating CORS/a production reverse proxy as unnecessary for a live installed-PWA V1.

   D1 should distinguish two proofs: (a) dev-server integration via proxy, and (b) installed production-build smoke via a local production reverse proxy, or a configured API origin with backend CORS/auth. `preview.proxy` could help a local preview smoke but does not solve deployment. D7's network-only API bypass remains required once same-origin production APIs exist.

4. **§3.1 close path — AGREE: manual close must wait for a BKT-owned endpoint.**

   PLT's close body accepts caller-supplied exit price/time/fill/fees/MFE/MAE and is documented as BKT reporting a simulated exit fill (`../stratfolio/service-plt/src/main/java/com/stratfolio/plt/web/dto/CloseSilentTradeRequest.java:10-24`). Calling it from the UI would turn a user estimate into execution evidence. BKT currently exposes only a whole-monitor tick and reconciliation (`../stratfolio/service-bkt/src/stratfolio_bkt/api/monitor.py:1-18`, `../stratfolio/service-bkt/src/stratfolio_bkt/api/monitor.py:33-53`), not a targeted user exit. The current UI already constructs a SELL from its displayed price (`src/components/positions/ManualCloseTicket.tsx:78-99`), which must be disabled in live mode until BKT can select/record/report the exit itself. It may remain a clearly simulated mock-mode behavior.

5. **Deletion list §6 — CHANGE REQUIRED; two entries are known demo-script dependencies.**

   - Do not blindly delete the forced demo plans: `MockPlannerApi` calls them `REQUIRED_DEMO_PLAN_IDS` and re-inserts/refreshes them from seed data (`src/api/mock/MockPlannerApi.ts:11-16`, `src/api/mock/MockPlannerApi.ts:32-45`).
   - Do not blindly delete the MSFT assistant response: its source comment says the demo script leans on it (`src/api/mock/MockAssistantApi.ts:79-93`).
   - `EXAMPLE_ORDERS` also guarantees a pending order, and `HeaderOrders` currently asserts one exists (`src/components/shell/HeaderOrders.tsx:7-24`). The live component needs empty/no-pending states. If the demo needs the scripted orders, move them behind the mock `getOrders()` seam instead of retaining a component fixture; the mock already has an unexposed `getOrders` method (`src/api/mock/MockPortfolioApi.ts:270-279`).
   - Delete or isolate coin-flip criteria and synthesized fills/order IDs from any live view: their source explicitly says the fills are synthesized (`src/lib/positionEvents.ts:40-47`, `src/lib/positionEvents.ts:64-75`, `src/lib/positionEvents.ts:205-207`) and the criteria derive `met` from a PRNG (`src/lib/planIntent.ts:44-68`). They may exist only as visibly scripted mock data if a demo stakeholder confirms the need. DOW-from-SPY should be deleted.

   As written, “delete forced demo plans/easter egg” and “mock mode byte-identical” cannot both pass (`docs/plans/BACKEND_HOOKUP_V1_PLAN.md:108-109`). Resolve the product choice explicitly; my recommendation is to preserve the scripted experience only in mock mode, label it, and prevent those records from entering live adapters.

6. **Wave ordering — YES: pull market quotes/chains forward to a new Wave B0, after Wave A and before trading writes.**

   The app starts the simulator unconditionally (`src/App.tsx:30-32`, `src/store/priceStore.ts:14-27`), while BKT independently selects a real/replay option from MND for execution (`../stratfolio/service-bkt/src/stratfolio_bkt/execution/engine.py:453-464`). Shipping the write flow first would let the ticket display a synthetic estimate while BKT decides against a different MND quote, and portfolio P/L would remain simulated despite live positions. Implement the MND browser facade/gap, snapshot/chain reads, and provenance labels before APP-112; leave news in Wave D. Accept that this makes HKP-MND-1 a Wave B prerequisite.

   MND provenance must travel through the adapter/UI: `DATA_SOURCE_SYNTHETIC` is explicitly required to be labeled (`../stratfolio/proto/stratfolio/marketdata/v1/common.proto:48-64`), and every quote/chain carries provenance (`../stratfolio/proto/stratfolio/marketdata/v1/common.proto:129-142`, `../stratfolio/proto/stratfolio/marketdata/v1/market_data.proto:85-98`, `../stratfolio/proto/stratfolio/marketdata/v1/market_data.proto:122-130`). “From MND” does not necessarily mean real/live.

7. **Adapter typing — REJECT frozen app types; keep separate wire DTOs, but evolve the view models.**

   The swap point is good (`src/api/index.ts:16-27`), and backend wire DTO types should remain distinct from component-facing models. However, the existing models describe the rich mock dataset rather than the backend contract: `Position.ai` is mandatory, `Idea` requires unserved targets/assessment data, `PlannerIdea` requires unserved presentation fields, `PlanCriterion.met` cannot represent “unknown,” `BrokerageId` invents six brokerages for a single paper portfolio, and `Order` cannot represent `NO_FILL` (`src/api/types.ts:4-23`, `src/api/types.ts:72-89`, `src/api/types.ts:126-147`, `src/api/types.ts:161-172`, `src/api/newsTypes.ts:33-80`). Freezing them would force forbidden synthetic defaults.

   Use generated or hand-pinned wire DTOs per service, then map to deliberately revised UI view models with optional/discriminated availability and provenance. At minimum: make assessment presence explicit; split thesis, plan, and order/execution views instead of coercing all into mock `Idea`; let criteria state be `met | unmet | unknown`; represent `NO_FILL`/`REJECTED` and platform-reporting state; and make simulated/paper account identity explicit. Components must render unavailable states. Preserve the adapter boundary for snake-case, omitted-null, decimal/micros, and fraction conversions.

### Factual errors in the mapping tables

- §3.1 `getMeta`: `totalDeposited -> starting_capital` is false; it maps semantically to `open_positions_cost_basis` (`src/api/types.ts:108-113`; `../stratfolio/service-plt/src/main/java/com/stratfolio/plt/web/dto/PortfolioResponse.java:17-23`).
- §3.1 activity: the wire field is `action_type`, not `action` (`../stratfolio/service-plt/src/main/java/com/stratfolio/plt/web/dto/ActivityResponse.java:9-17`; `../stratfolio/service-plt/src/main/resources/application.yml:34-42`).
- §3.1 positions: “assessment ... else omitted (UI hides block)” is false for current code; `Position.ai` is required and multiple consumers dereference it without a guard (`src/api/types.ts:72-89`; `src/lib/portfolioMath.ts:110-113`; `src/components/trade/TradeTicket.tsx:348-353`).
- §3.1 `getOrders()` should be PARTIAL, not LIVE. BKT has a successful `NO_FILL` outcome and execution/reporting fields the app `Order` cannot represent (`../stratfolio/service-bkt/src/stratfolio_bkt/execution/engine.py:121-160`; `src/api/types.ts:161-172`); open PLT plans are plans, not necessarily submitted/filled orders.
- §3.2 theses cannot currently map to app `Idea` “as far as the DTO carries” while satisfying the declared return type. Required prices, recommendation/assessment fields, company, contract detail, categories, and tags do not exist on `ThesisResponse` (`../stratfolio/service-plt/src/main/java/com/stratfolio/plt/web/dto/ThesisResponse.java:12-29`; `src/api/types.ts:126-147`).
- §3.3 a thesis join does not make `TradePlanResponse` satisfy `PlannerIdea`; absolute target/stop prices, title, categories, author, and other required presentation fields are absent from both DTOs (`../stratfolio/service-plt/src/main/java/com/stratfolio/plt/web/dto/TradePlanResponse.java:13-86`; `../stratfolio/service-plt/src/main/java/com/stratfolio/plt/web/dto/ThesisResponse.java:12-29`; `src/api/newsTypes.ts:39-80`).
- D3/APP-101's generic `Idempotency-Key` on all POSTs is not the BKT execution contract. BKT takes `idempotency_key` in the JSON body (`../stratfolio/service-bkt/src/stratfolio_bkt/api/executions.py:70-87`), while PLT trade plans take the header (`../stratfolio/service-plt/src/main/java/com/stratfolio/plt/web/TradePlanController.java:54-67`).

The backtest and MND/news capability claims checked above are accurate.

### Risks and missing work

- **Idempotency/retry design:** do not generate a fresh UUID inside a generic wrapper on every POST attempt. A key must be stable for one logical operation and reused after timeouts; endpoints must declare whether the key is in a header, body, or unsupported. Otherwise a retry can become a second BKT simulation after a `NO_FILL`/rejection (`../stratfolio/service-bkt/src/stratfolio_bkt/api/executions.py:28-36`, `../stratfolio/service-bkt/src/stratfolio_bkt/api/executions.py:82-87`).
- **Write workflow/state machine:** specify the durable client states for plan VALIDATED/REJECTED, execution FILLED/NO_FILL/REJECTED, and “filled but PLT reporting failed.” A 201 from BKT is not proof of a position; `reported_to_platform=false`/`platform_error` must produce a recoverable state, not a success toast (`../stratfolio/service-bkt/src/stratfolio_bkt/execution/engine.py:132-160`).
- **Query convergence:** the existing order mutation invalidates only activity (`src/hooks/queries.ts:78-87`). The live chain needs stable operation keys plus targeted refresh/invalidation for plan, execution/order, positions, portfolio meta, performance, and activity, including delayed BKT→PLT reconciliation.
- **Mixed-mode truthfulness:** per-domain switching means some screens may combine live portfolio data with mocked AI/news/marks. The current global badge and portfolio copy claim that *everything* is simulated (`src/components/shell/DemoBadge.tsx:3-12`, `src/routes/PortfolioPage.tsx:294-299`). Replace this with per-domain/per-value provenance before the first mixed-mode build.
- **All-period performance truncation:** `limit=500` is the maximum and there is no pagination in the PLT list controller (`../stratfolio/service-plt/src/main/java/com/stratfolio/plt/web/SilentTradeController.java:85-90`). An `ALL` curve derived from that endpoint silently ceases to be all history after 500 closed trades. Add a backend pagination/history gap or label and bound the period.
- **Open-ticket semantics:** the UI advertises a market/GFD order and `$0.00` commission (`src/components/trade/TradeTicket.tsx:340-346`), but BKT exposes deterministic fill simulation, not an order type or broker commission promise. Rewrite this UX around “silent execution attempt,” authorized entry band, possible no-fill, and simulated fill costs.
- **No-auth exposure:** the no-auth decision is acceptable only for loopback. Any CORS or reverse-proxy solution must preserve the plan's “not externally exposed” boundary until authentication exists.
- **Proof criteria:** change Wave A's mutually exclusive “fabrication purge” plus “mock byte-identical” assertion, and change Wave B from unconditional “sees fill” to deterministic fixtures proving both FILLED and NO_FILL, stable retry replay, 422 reason rendering, and eventual PLT reconciliation.

### Overall recommendation

**Rework.** The silent-trading safety boundary is correct, and several backend capability assessments are accurate, but the current plan cannot be implemented without violating its own no-fabrication rule. Correct the mapping errors, redesign the view types and open-order input/state machine, make idempotency endpoint-specific and retry-stable, move market/provenance work ahead of trading writes, and resolve the mock-demo deletion contradiction before accepting the wave plan.

## Cursor review — 2026-08-31 (rev 2)

Code treated as ground truth. Verified rev-2 corrections against Codex's rev-1 findings (not re-litigated) and spot-checked app `src/` plus `service-plt` DTOs/controllers, `service-bkt` api/execution, `service-ai` `app.py`/`cycle.py`/`episodes.py`, and `service-mnd` proto/HTTP mux. Backend HEAD at review time is `6f4bc2b` on `app-hookup` (plan header still cites `954d738` — ancestor of current HEAD; service claims below still hold).

### §9 checklist verdicts

1. **Contract truth — PASS (rev-2 corrections hold); two residual mapping gaps remain.**

   Spot-checks of the Codex-corrected rows:

   - `getMeta`: `totalDeposited → open_positions_cost_basis` matches app semantics (`src/api/types.ts:108-113`, `MockPortfolioApi.ts:121-128`) and `PortfolioResponse.openPositionsCostBasis` (`../stratfolio/service-plt/.../PortfolioResponse.java:14-23` + Jackson `SNAKE_CASE` at `application.yml:41-42`). `cash`/`buyingPower → cash_balance` is an explicit product decision, not a field mix-up.
   - Activity: wire field is `action_type` (`ActivityResponse.java:9-17` + SNAKE_CASE). `ActionType` roster is far broader than the app's four kinds (`ActionType.java:7-33` vs `src/api/types.ts:174-181`); complete map + `other` fallback is required as stated.
   - Theses / plans: `ThesisResponse` / `TradePlanResponse` field sets match the rev-2 description (`ThesisResponse.java:12-29`, `TradePlanResponse.java:13-86`). Neither DTO can feed frozen `Idea` / `PlannerIdea`; `ThesisView` / `PlanView` is the correct escape.
   - Open order / execution: `CreateTradePlanRequest` still requires full option identity + modes (`CreateTradePlanRequest.java:36-85`); BKT body idempotency + `FILLED`/`NO_FILL` on 201 confirmed (`executions.py:70-87`, `engine.py:121-160`); PLT header idempotency confirmed (`TradePlanController.java:54-67`).
   - `decision-cycles/run` paper-executes: `cycle.py:2924-3041` submits to plt then calls bkt `execute` — composer re-scope is correct.

   Residual (neither Codex nor rev 2 called out cleanly):

   - **`getOrders()` merge is underspecified and partly unservable.** BKT has no list-executions route — only `GET .../by-plan/{id}` and `GET .../{execution_id}` (`executions.py:145-189`). `NO_FILL` leaves no silent-trade row, so "plt silent-trades + open trade-plans + bkt outcomes" either needs an N+1 by-plan fan-out over VALIDATED plans, client-retained submit responses, or a new BKT list gap. Status PARTIAL is right; the adapter contract is not yet implementable as written.
   - **Confidence scale:** contracts bind thesis/plan `confidence` as **0..1** (`BACKEND_V1_SERVICE_CONTRACTS.md` § theses); app `AIAssessment.conviction` is **0–100** (`src/api/types.ts:29-31`). Missing from §7 footguns — easy silent 100× display bug when mapping episode/thesis confidence.

2. **Accidental-live-trading audit — PASS, with one Wave-C gate and broader copy cleanup.**

   Waves A–B only name PLT trade-plan / silent-trade and BKT execution paths. PolicyGate rejects non-silent `execution_mode` (`PolicyGate.java:101-104`). BKT has no brokerage route (`app.py` routers are executions/monitor/backtests/experiments). Wave C's `decision-cycles/run` exposure is correctly blocked on HKP-AI-8 + explicit paper-execution labeling (`app.py:447`, `cycle.py:3001-3041`).

   Keep: ticket must **hard-send** `execution_mode=silent` (and an allowlisted `risk_profile`) — do not trust UI free-text. Also remove auto-execution promises beyond the cited ticker: `AITradingControl.tsx:138-139,217-218` and `PlannerPage.tsx:81` still claim plans "execute automatically" — same HKP-XSV-1 lie as `UpcomingTradePlans.tsx:565`.

3. **D3 view-model revision — PASS directionally; incomplete inventory of required-but-unservable fields.**

   Rev 2 correctly unfreezes types: optional `ai?`, criteria `unknown`, `NO_FILL` / `platform_error`, paper-account identity, provenance (D10). That addresses Codex's core rejection.

   Still required today and still unservable without fabrication or further view-model cuts:

   - `Position.brokerageId` / `Order.brokerageId` / six `BrokerageId`s (`src/api/types.ts:4-21,72-88,161-172`) — D3 mentions paper-account identity but does not explicitly drop brokerage from position/order view models; live mode will otherwise invent a brokerage.
   - `Position.company` / `Idea.company` / `Order.company` — DTOs have ticker only. Plan's "local symbol map until HKP-MND-4" has **no live-safe map**: company names live in mock seed (`seededData.ts`, `seededOptionsBook.ts`). Importing those into `Http*Api` would violate §6. Prefer `company?: string` (ticker fallback) until HKP-MND-4.
   - `Idea.ai` remains required (`types.ts:126-147`) — covered by ThesisView, but every current consumer (`RecTile`, `IdeaCard`, `RecDetailsPage`, …) still assumes it; blast radius is larger than the few files listed in §5.
   - `PlannerIdea` absolute `targetLow`/`targetHigh`/`stop`/`expectedUpsidePct`/`author`/`title` (`newsTypes.ts:39-80`) — PlanView covers; status map must include backend `PROPOSED|VALIDATED|REJECTED|EXECUTED|CANCELLED` (`TradePlanStatus.java:4-9`), not only the app's `draft|watching|ready`.

4. **Wave B0 placement — AGREE; start after Wave A once HKP-MND-1 lands.**

   App boots `MarketDataSimulator` unconditionally (`App.tsx:30-32`); BKT independently quotes MND for fills (`engine.py` option selection). Shipping APP-112 before live chain/quotes guarantees ticket/mark divergence. HKP-MND-1 is DECIDED; no reason B0 cannot follow A immediately when the facade exists. Chain-history deferral is correctly mirrored. Provenance labeling (`common.proto:48-64`) remains mandatory — "from mnd" ≠ real.

5. **Idempotency design (D6) — PASS, with one semantic clarification.**

   Endpoint-specific + retry-stable keys match code: PLT header (`TradePlanController.java:54-67`), BKT body (`executions.py:70-87`). BKT replay: same `(trade_plan_id, idempotency_key)` returns recorded FILLED/NO_FILL/REJECTED without re-simulating (`executions.py:28-36,123-135`); a **new** key after NO_FILL/REJECTED may simulate again.

   Clarification for APP-112: "retry after timeout" reuses the key; "user clicked try again after NO_FILL" is a **new logical operation** and must mint a new key. Document that in the ticket state machine so D6 is not read as "one key forever per plan."

6. **§6 fabrication policy — PASS for demo confinement; APP-103 and company-map are leak risks.**

   Mock-only retention of forced plans / MSFT easter egg / scripted orders resolves Codex's delete-vs-byte-identical contradiction. Live adapters must not import `seededData` / `EXAMPLE_ORDERS` / `REQUIRED_DEMO_PLAN_IDS`.

   Leak vectors still open in the plan text:

   - **APP-103 conflates two different "watchlists".** App `Watchlist.tsx` is a local terminal tape (`DEFAULT_WATCHLIST = SYMBOLS.slice(0, 20)`, in-component state — `Watchlist.tsx:11-24`). PLT `/api/v1/watchlist*` is **ActiveUniverse** membership with capacity/pinning/AI promotion (`WatchlistController.java:42-72`, contracts §10). Wiring the terminal rail to ActiveUniverse would either dump ~73 DEFAULT_PINNED symbols into the UI or let casual add/remove mutate the AI universe. Treat APP-103 as a dedicated ActiveUniverse surface (or defer); keep the terminal rail LOCAL (or mnd-backed quotes only) until product decides.
   - Company names from mock seed (item 3) — same confinement rule.

7. **Proof criteria — PASS for Wave B submit path; insufficient alone for `getOrders` history.**

   FILLED + NO_FILL fixtures, stable idempotent retry, 422 `rejection_reasons[]`, and filled-but-`platform_error` recoverable state are the right submit/execution proofs (`engine.py:121-160`). Wave A demo-in-mock + live SoR reads + brokerage-SDK grep are sound.

   Add: (a) assert kill-switch / approval refusal is **server-side** before any Wave C run (already in Wave C proof — keep); (b) once `getOrders` is specified, a fixture that a NO_FILL appears in the orders seam **without** a silent-trade row; (c) performance curve labeled "settled / last ≤500 closed" and not scaled as if it were marked NAV (`PerformanceChart.tsx:29` multiplies multipliers by "current value" — settled curve × marked value after B0 is a presentation footgun).

### Remaining factual errors / imprecisions in rev-2 tables

- Plan header backend head `954d738` is stale; current `app-hookup` is `6f4bc2b` (docs-only successor). Update on next rev.
- §1 LLM claim: mock is default via `STRATFOLIO_LLM_PROVIDER` (`config.py:51-56`, `factory.py:12-28`), not merely "BASE_URL+key+model unset" — empty provider fields with `openai-compatible` **raises**, it does not silently mock.
- §3.1 `getOrders` implies BKT outcomes are listable; they are not without fan-out or a new endpoint (see checklist 1).
- §3.1 positions "company from local symbol map" — no such live map exists outside mock seed.
- §4 APP-103 "Watchlist → plt watchlist" overstates product fit (ActiveUniverse ≠ terminal rail).
- §3.3 / auto-exec copy: cite `AITradingControl` + `PlannerPage` in addition to `UpcomingTradePlans:565`.
- Minor: TradePlan status enum includes `PROPOSED` (`TradePlanStatus.java:5`); adapter status map should name it.

Corrected Codex items (`totalDeposited`, `action_type`, `getOrders` PARTIAL, ThesisView/PlanView, D3 unfreeze, D6 split, D1 proxy vs release, B0, demo confinement, FILLED/NO_FILL proofs) check out against code.

### Risks / missing work not already in the Codex review

1. **APP-103 ActiveUniverse vs terminal Watchlist semantic mismatch** (above) — highest-priority plan defect left.
2. **`getOrders` needs an explicit merge algorithm or a BKT list/history gap** — Wave B UI otherwise cannot honestly show NO_FILL history.
3. **Confidence 0..1 vs conviction 0–100** — add to §7 wire footguns; map or keep fractional in view models.
4. **Ticket must pin `execution_mode` + `risk_profile`** to PolicyGate allowlists; redesign text at `TradeTicket.tsx:340-346` is noted, pinning is not.
5. **Settled performance × live marked NAV** inconsistency after B0 — pick one equity basis for the chart.
6. **CreateActivityRequest** for interim disposition/disable requires a real `ActionType` (use `USER_ACTIVITY`) + `entityType`/`entityId` (`CreateActivityRequest.java:10-15`) — specify the payload schema so localStorage+activity does not invent free-form types the enum rejects.
7. **D10 provenance chips** replace DemoBadge — also scrub `PortfolioPage.tsx:294-299` global "everything is simulated" copy (Codex noted; rev 2 D10 covers intent; ensure Wave A proof asserts mixed-mode copy is gone).

### Overall recommendation

**Approve-with-changes.** Rev 2 successfully integrates Codex's rework drivers (mappings, D3 unfreeze, D6, B0, demo confinement, execution proofs, composer/HKP-AI-3a+8 split). Do not start Wave A until the ActiveUniverse/APP-103 scope is corrected, `getOrders` is given an implementable merge (or backend gap), confidence scale is footgunned, and company/brokerage fields are explicitly optional or dropped from live view models. After those edits, the wave plan is implementation-ready.
