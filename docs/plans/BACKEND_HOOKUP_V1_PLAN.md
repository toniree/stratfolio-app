# StratFolio App — Backend Hookup V1 Plan

- **Status:** DRAFT — awaiting multi-agent review (Codex, Cursor, cheaper Claude agents) before implementation.
- **Author:** Claude Fable 5 (lead agent), 2026-08-31.
- **App repo:** `stratfolio-app` @ branch `backend-hookup` (Vite 8 + React 19 + TS PWA, HashRouter, TanStack Query + Zustand).
- **Backend repo:** `../stratfolio` @ branch `app-hookup` (head `6d1dcae`). Binding contracts: `../stratfolio/docs/architecture/BACKEND_V1_SERVICE_CONTRACTS.md`.
- **Companion doc (backend gaps):** `../stratfolio/docs/plans/APP_HOOKUP_BACKEND_GAPS_V1.md` — the authoritative list of missing backend capability. This plan only sequences app-side work.

Reviewers: read §9 (review checklist) last, after the mapping tables. Ground-truth citations use `repo:path:line` and were verified 2026-08-31; re-verify before disputing.

---

## 1. Ground truth (verified, not aspirational)

**App side.** All screens consume data through one seam: `src/api/index.ts:16-27` binds six interfaces (`PortfolioApi`, `IdeasApi`, `NewsApi`, `PlannerApi`, `AuthApi`, `AssistantApi` — `src/api/portfolioApi.ts:27-70`) to mock classes. Hooks in `src/hooks/queries.ts` already have correct query keys and invalidation. There is **no networking code anywhere**: no fetch/axios, no `VITE_*` env vars, no `.env` files. Live "prices" come from `src/api/marketData/MarketDataSimulator.ts` (deterministic OU walk). Several screens bypass the seam entirely (fixtures list in §6).

**Backend side.** Four services, no gateway (`service-gty` in the backend README does not exist as code):

| Service | Protocol | Port | Browser-callable today? |
|---|---|---|---|
| service-plt (system of record) | HTTP JSON snake_case | 7201 | Yes, except **no CORS** |
| service-ai (decision engine) | HTTP JSON | 7301 (**binds 127.0.0.1**) | Yes locally, no CORS |
| service-bkt (execution/backtests) | HTTP JSON | 7401 | Yes, no CORS |
| service-mnd (market data + news) | **gRPC only** :7101 (HTTP :7102 is health/admin only) | 7101/7102 | **No** — no grpc-web, no reflection, no REST |

Zero auth anywhere. Zero WebSocket/SSE anywhere (only gRPC `StreamSnapshots`). plt **never marks positions to market** — `unrealized_pnl` is always 0 for open positions (`service-plt .../PortfolioService.java:235-237, 277-279`); realized P&L, win rate, peak equity are real. LLM output is a deterministic mock unless `STRATFOLIO_LLM_BASE_URL`+key+model are set (`service-ai .../gateway/factory.py:15-31`).

**V1 product invariant (binding):** silent/paper trading only; AI-originated trades are long single-leg CALL/PUT, DTE ≥ 1. The backend has **no equity/stock positions at all** — only option silent trades.

---

## 2. Locked decisions (challenge in review, not in implementation)

- **D1 — Transport: Vite dev proxy, per-service path prefixes.** App calls same-origin `/plt/*`, `/ai/*`, `/bkt/*`, `/mnd/*`; `vite.config.ts server.proxy` rewrites to `localhost:7201/7301/7401/(7102)`. This unblocks everything without touching backend CORS. Backend CORS (gap **HKP-PLT-1** etc.) is still requested so the built PWA can run against localhost later, but it is not on the critical path.
- **D2 — Per-domain live/mock switch, not big-bang.** `src/api/index.ts` picks `Http*Api` vs `Mock*Api` per domain from `VITE_DATA_*` env flags (default: mock). The demo build must keep working unchanged. Rollout is domain-by-domain across waves.
- **D3 — Thin `Http*Api` classes + explicit adapters.** One small typed `fetch` wrapper (no axios): base URL, JSON, `Idempotency-Key: crypto.randomUUID()` on POSTs, RFC9457 ProblemDetail → typed `ApiError` (carrying `rejection_reasons[]`). Per-domain adapter modules map backend snake_case DTOs → existing app types. **App component/hook types do not change in V1** except where a field is provably unservable (§7).
- **D4 — What the backend cannot serve stays mocked and labeled, never silently fabricated.** Anything still synthetic after its wave keeps a visible "simulated" tag (the app already has this copy). We delete fabricated-but-presented-as-real data (fake order IDs, coin-flip plan criteria) rather than keep it beside live data.
- **D5 — No auth in V1 hookup.** Local-first single user; backend has no auth surface. Keep the mock session UI. Auth is a listed backend gap, required before any non-loopback exposure.
- **D6 — Money discipline.** plt sends JSON decimals with `non_null` omission (absent ≠ null); mnd (when reachable) sends int64 micros (÷1e6). `profit_target_pct` / `stop_loss_pct` are **fractions of entry premium** (0.5 = 50%), not percent points — the contracts doc calls the misread "the classic failure". Adapters own all conversions; components never see raw wire values.
- **D7 — Service worker API bypass before any live call ships.** `public/service-worker.js:35-47` is cache-first for all same-origin GETs; add a network-only bypass for `/plt|/ai|/bkt|/mnd` paths in Wave A.
- **D8 — Polling, not streaming, for V1.** TanStack Query `refetchInterval` (quotes ~5s when visible, portfolio 30s). The only backend stream is gRPC; an SSE bridge is a listed gap, not V1.
- **D9 — Tests move to MSW.** New `Http*Api` classes get MSW-backed contract tests using fixtures captured from the real services' OpenAPI (`plt /v3/api-docs`, ai/bkt `/openapi.json`). Existing mock-layer tests stay.

---

## 3. Domain → backend mapping

Legend: **LIVE** = servable now · **PARTIAL** = servable with adaptation/loss · **BLOCKED(gap)** = needs backend work (see gaps doc) · **LOCAL** = deliberately stays client-side.

### 3.1 PortfolioApi (`src/api/portfolioApi.ts:27-40`)

| Method | Backend | Status |
|---|---|---|
| `getAccounts()` | plt `GET /api/v1/portfolio` → single "StratFolio Paper" account | **PARTIAL** — backend is single-portfolio; brokerage filter UI collapses to one synthetic brokerage. Multi-account/brokerage = gap HKP-PLT-6. |
| `getPositions(accountId)` | plt `GET /api/v1/positions?status=OPEN` | **PARTIAL** — options only (no stocks/ETFs, gap HKP-PLT-7); `company` name from a local symbol map (gap HKP-MND-4 for real reference data); `contractDetail` derived from `occ_symbol`/strike/expiration; per-position `AIAssessment` from ai episode via `decision_episode_id` where present, else omitted (UI hides block). Live mark: BLOCKED on HKP-MND-1; until then show entry-based values and label them. |
| `getMeta(accountId)` | plt `GET /api/v1/portfolio` | **LIVE** — cash→cash, buyingPower→cash_balance, totalDeposited→starting_capital. |
| `getOutlook(accountId)` | — | **BLOCKED (HKP-AI-5)** — stays mocked with simulated tag. |
| `getPerformance(accountId, period)` | derived: plt `GET /api/v1/silent-trades?status=CLOSED&limit=500` → settled-equity curve (starting_capital + cumulative realized P&L by close time) | **PARTIAL** — real but settled-only (no intraday marks). True equity history = gap HKP-PLT-2. Chart gets a "settled equity" label. |
| `submitOrder(...)` — open | plt `POST /api/v1/trade-plans` (user-originated, option leg) → bkt `POST /api/v1/executions {trade_plan_id}` | **PARTIAL** — options only; PolicyGate 422 `rejection_reasons[]` surfaced verbatim in the ticket UI (this is a feature, not an error page). Stock orders: UI disables with explanation. |
| `submitOrder(...)` — close | — | **BLOCKED (HKP-BKT-1)** — bkt has no user-initiated exit endpoint (exits belong to the monitor; plt's `/close` expects a real fill from bkt, and the UI must not fabricate one). Manual close button disabled with tooltip until the gap lands. |
| `getOrders()` (new method — `HeaderOrders` fixture today) | plt `GET /api/v1/silent-trades?limit=20` + open trade-plans | **LIVE** — replaces `EXAMPLE_ORDERS` fixture (`src/components/shell/HeaderOrders.tsx:7-21`). |
| `addPositionFromIdea(...)` | thesis → plt `POST /api/v1/trade-plans` (from thesis params) → bkt execution | **PARTIAL** — same constraints as open order. |
| `getActivity()` | plt `GET /api/v1/activity?limit=100` | **LIVE** — direct win; map `action`/entity fields → app `kind`. |

### 3.2 IdeasApi (theses)

plt `GET /api/v1/theses` / `GET /api/v1/theses/{id}` → app `Idea`. **PARTIAL:** conviction/targets/catalysts/risks map only as far as `ThesisResponse` carries them (implementer: pin the actual DTO field-by-field in the adapter test; do not infer from names). Accept/reject: **BLOCKED (HKP-PLT-3)** — interim: keep localStorage decision store **and** record a `POST /api/v1/activity` entry so the decision at least reaches the system of record; swap to the real disposition endpoint when it lands. Note: thesis *content* is MockModel output until an LLM provider is configured (cost decision — flagged in gaps doc HKP-AI-6).

### 3.3 PlannerApi (trade plans)

| App concept | Backend | Status |
|---|---|---|
| `getIdeas()` list | plt `GET /api/v1/trade-plans` (+ join thesis for title/context) | **PARTIAL** — status mapping: plt plan status → `draft/watching/ready` is lossy; document the map in the adapter. |
| AI plan composer (free-text prompt) | ai `POST /api/v1/decision-cycles/run {ticker}` for "generate a plan for TICKER"; free-text NLP → **BLOCKED (HKP-AI-3)** | **PARTIAL** — V1 ships a ticker-picker composer wired to a real decision cycle (client regex parser `src/lib/planPrompt.ts` is deleted, not moved). |
| `createIdea` (manual form / from thesis / from position) | plt `POST /api/v1/trade-plans` | **PARTIAL** — PolicyGate rejects non-conforming plans with 422 + reasons; UI shows them. Client-side derivations in `src/lib/thesisPlan.ts:5-32` (maxAmount/stop heuristics) are deleted; plan params come from the thesis or the form. |
| `updateIdea` / criteria / watched options | — | **BLOCKED (HKP-PLT-4/HKP-BKT-2)** — plt plans are immutable-ish records, and criteria "met" state is a client coin flip today (`src/lib/planIntent.ts:44-70`) — **delete the coin flip in Wave A** (criteria render without met/unmet until the readiness endpoint exists). |
| enable/disable plan | — | **BLOCKED (HKP-PLT-4)** — interim: localStorage + activity record, same pattern as thesis decisions. |
| `deleteIdea` | — | **BLOCKED (HKP-PLT-4)** — hide delete for backend-sourced plans. |

### 3.4 NewsApi

**BLOCKED (HKP-MND-2)** — news lives behind gRPC `NewsService`, off by default (`MND_NEWS_ENABLED=false`), release calendar is a stub, and `NewsEvent` has headline/summary/url but **no body paragraphs and no sentiment** — so `ArticlePage` becomes summary+source-link when live. Stays mocked until the REST facade lands; adapter and UI-degradation decisions are pre-made here so Wave D is mechanical.

### 3.5 Market data (simulator, terminal, chains, index strip)

All **BLOCKED (HKP-MND-1)** — quotes, candles (`GetHistoricalBars` has OHLCV+VWAP), option chains (bid/ask, IV, greeks, OI — real, replacing the in-browser Black–Scholes synthesis), market status/replay clock. Until the facade: simulator stays, clearly labeled. When it lands: `MarketDataSimulator` is replaced by a polling quote provider feeding the same `priceStore`; `optionMark()` in `src/lib/portfolioMath.ts:39-49` prefers server chain mid → **this is what finally makes unrealized P&L real** (plt will never provide it; see gaps HKP-PLT-2 note). DOW index tile is deleted (it's SPY×0.42 today — `TopBar.tsx:19-22`); index strip shows whatever tickers the replay dataset/provider actually serves.

### 3.6 AssistantApi / chat

**BLOCKED (HKP-AI-2)** — ai has chat tables but zero routes. Mock stays (with tag); the two demo hacks (MSFT easter egg `MockAssistantApi.ts:83-93`, forced demo plans `MockPlannerApi.ts:12-16`) are deleted in Wave A regardless. Reprompt/training-signal capture (`repromptStore`) stays local until HKP-AI-4.

### 3.7 Research / backtests

bkt is real: `POST /api/v1/backtests` (synchronous despite 202 — first poll returns COMPLETED), `GET /api/v1/backtests/{id}`, experiments API. **PARTIAL:** the engine supports long single-leg option strategies with entry/exit params — of the 10-template `STRATEGY_LIBRARY`, only long-call/long-put styles survive as presets over `BacktestRequest.params`; the rest (condors, covered calls, momentum baskets…) are removed or marked "engine support pending" (gap HKP-BKT-3). `simulateRun()` random-walk engine and the fake `SilentTape` are deleted. Metrics UI adapts to what `result` actually returns (+ baselines); no fabricated Sortino/vsSpy.

### 3.8 Deliberately LOCAL (not gaps, product decisions)

Tile/field preferences, mobile ticker symbols, notification preference booleans, unread-news flag: per-device UI conveniences, stay in localStorage. AI settings (risk appetite, approval mode, circuit breaker) and the AI-trading master toggle are **not** local by nature — they're agent policy — but have no backend home yet: interim local + listed as gap HKP-PLT-5/HKP-AI-7.

---

## 4. Waves (per phased-wave proof policy: focused tests per phase, expensive proofs at wave end)

### Wave A — plumbing + system-of-record screens (backend prereq: none; runs via dev proxy)
- **APP-101** HTTP foundation: fetch wrapper, `ApiError`/ProblemDetail mapping, idempotency keys, env flags (`.env.example` with `VITE_DATA_*`), Vite proxy config, service-worker API bypass, MSW test rig.
- **APP-102** `HttpPortfolioApi`: portfolio/meta, positions (+adapters), activity, orders-from-silent-trades (new `getOrders()` seam method; delete `EXAMPLE_ORDERS`), settled performance curve.
- **APP-103** Watchlist → plt `/api/v1/watchlist*` (replaces component-local state in `Watchlist.tsx`); capacity/validation states surfaced.
- **APP-104** Demo-hack + fabrication purge: coin-flip criteria, fake fills/order IDs (`src/lib/positionEvents.ts`), forced demo plans, MSFT easter egg, `resetDemo` scoped to mock mode only, DOW tile.
- **Wave-A proof:** `make up` + plt running; app in live-portfolio mode renders real portfolio/positions/activity/watchlist; mock mode byte-identical to today; full app test suite green.

### Wave B — trading writes + theses (backend prereq: none for happy path)
- **APP-111** `HttpIdeasApi` (theses list/detail + adapter contract test against `/v3/api-docs`).
- **APP-112** Order ticket → trade-plan + execution chain, 422 rejection UX, manual-close disabled state; thesis→plan and add-to-portfolio flows.
- **APP-113** Planner reads from trade-plans; interim decision/disable recording via activity.
- **Wave-B proof:** against live plt+bkt with replay-mode mnd feeding them: user opens a plan from a thesis, sees fill, position appears, appears in orders + activity; a policy-violating plan shows its real rejection reasons.

### Wave C — ai + research (backend prereq: ai reachable on 127.0.0.1 via proxy)
- **APP-121** Decision-cycle composer (ticker-based), episode detail on position/thesis pages (`GET /api/v1/episodes/{id}` via plt's `decision_episode_id`), ml-status badge.
- **APP-122** Research page → real bkt backtests; template pruning per §3.7.
- **Wave-C proof:** run a decision cycle from the UI in replay mode → thesis/plan/trade visible across screens with one episode id; queue a real backtest and render its metrics.

### Wave D — market data + news (**blocked on backend gaps HKP-MND-1/2**)
- **APP-131** Quote provider replacing simulator; candles/chains/market-status in terminal; client-side marks → real unrealized P&L everywhere; delete `blackScholes`-derived IV/OI fabrication.
- **APP-132** News hookup + degraded article UI.
- **Wave-D proof:** `make demo-replay`-style stack + app shows replayed quotes matching mnd, chain values match gRPC responses (spot-check via grpcurl), portfolio unrealized P&L moves with the replay clock.

Ownership: APP tasks are app-repo only, single writer per task; backend gaps are owned in the backend repo per its task conventions. The lead agent owns integration review at each wave end.

---

## 5. Files created/changed (Wave A blast radius)

New: `src/api/http/client.ts`, `src/api/http/HttpPortfolioApi.ts` (+per-domain siblings later), `src/api/http/adapters/*.ts`, `src/api/env.ts`, `.env.example`, `src/test/msw/*`. Changed: `src/api/index.ts` (binding switch), `src/api/portfolioApi.ts` (add `getOrders`), `vite.config.ts` (proxy), `public/service-worker.js` (bypass), `src/components/shell/HeaderOrders.tsx`, `src/components/terminal/Watchlist.tsx`, `src/lib/planIntent.ts`, `src/lib/positionEvents.ts`, fixture deletions per APP-104.

---

## 6. Fabrication inventory being deleted vs. kept-with-label

**Deleted in Wave A** (presented as real, is not): coin-flip plan criteria met-state; synthesized fills/slippage/order IDs; `EXAMPLE_ORDERS`; DOW-from-SPY; forced demo plans; assistant easter egg.
**Kept + "simulated" label until its wave/gap:** price simulator (until HKP-MND-1), news (HKP-MND-2), assistant chat (HKP-AI-2), portfolio outlook (HKP-AI-5), AI settings persistence (HKP-PLT-5), stress tests & chat summaries in `AIOutlookPanel` (HKP-AI-2/5).

---

## 7. Wire footguns (adapter test checklist)

1. `profit_target_pct`/`stop_loss_pct` are fractions, not percent points.
2. plt omits null fields (`non_null`) — adapters must treat absent as undefined, never 0. Money is never fabricated as zero; missing stays missing.
3. mnd money = int64 micros (when Wave D lands).
4. `rejection_reasons[]` may repeat codes; render de-duplicated but keep raw list in the error object.
5. bkt `POST /backtests` returns 202 PENDING but has already run synchronously — poll immediately, and set a long client timeout on the POST.
6. plt trade-plan response does not echo `as_of` (documented contract gap).
7. All app seed timestamps are relative ("2h ago" always); real ISO timestamps will age — check `relativeTime()` rendering for old data.

---

## 8. Env / run book (dev)

```
# backend repo
make up                         # timescaledb + mlflow
(cd service-mnd && make run)    # replay mode by default
(cd service-plt && make run)
(cd service-bkt && make run)
(cd service-ai  && make run)    # binds 127.0.0.1 — fine, proxy targets localhost
# app repo
cp .env.example .env            # VITE_DATA_PORTFOLIO=live etc.
npm run dev                     # proxy: /plt→7201 /ai→7301 /bkt→7401 /mnd→7102
```
GitHub Pages build stays mock-only until backend CORS + a non-localhost story exist.

---

## 9. Review checklist (for Codex / Cursor / other agents)

1. **Contract truth:** spot-check ≥3 mapping rows in §3 against actual backend DTOs (not the contracts prose). Flag any field I've assumed exists on `ThesisResponse`/`TradePlanResponse` that doesn't.
2. **Accidental-live-trading audit:** confirm no path in Waves A–C can submit anything but silent trades; the app must never call anything that could become an order at a real brokerage (there is no such endpoint today — keep it that way).
3. **D1 proxy vs CORS:** is there a reason the dev proxy is insufficient for V1 (PWA install flows, service worker scope)?
4. **§3.1 close-path:** agree/disagree that manual close must wait for a bkt endpoint rather than UI-fabricated fills into plt `/close`.
5. **Deletion list §6:** anything listed as "delete" that a demo stakeholder still needs?
6. **Wave ordering:** would you pull market data (Wave D) earlier given how many screens it unblocks, accepting the backend dependency?
7. **Adapter typing:** review the decision to keep app types frozen (D3) vs. migrating types to backend shapes now.
8. Record findings as PR review comments or a `docs/plans/BACKEND_HOOKUP_V1_REVIEWS.md` entry with your agent name; the lead integrates.
