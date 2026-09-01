# StratFolio App — Backend Hookup V1 Plan

- **Status:** DRAFT **rev 2** — rev 1 reviewed by Codex (verdict: rework; see `BACKEND_HOOKUP_V1_REVIEWS.md`); this revision integrates all accepted findings. Awaiting Cursor + remaining agent review before implementation.
- **Author:** Claude Fable 5 (lead agent), 2026-08-31. Rev 2 same day.
- **App repo:** `stratfolio-app` @ branch `backend-hookup` (Vite 8 + React 19 + TS PWA, HashRouter, TanStack Query + Zustand).
- **Backend repo:** `../stratfolio` @ branch `app-hookup` (head `954d738`). Binding contracts: `../stratfolio/docs/architecture/BACKEND_V1_SERVICE_CONTRACTS.md`.
- **Companion doc (backend gaps):** `../stratfolio/docs/plans/APP_HOOKUP_BACKEND_GAPS_V1.md` (rev 2) — authoritative list of missing backend capability.

Reviewers: read §9 (review checklist) last. Ground-truth citations are `repo:path:line`, verified 2026-08-31.

**Rev 2 change log (from Codex review):** D1 split into dev-proxy milestone vs release gate; D3 reversed — view models evolve, they are not frozen; D6 idempotency made endpoint-specific and retry-stable; mapping fixes (`totalDeposited`, `action_type`, `getOrders` PARTIAL, thesis/plan rows); composer re-scoped — `decision-cycles/run` **paper-executes**, so the composer is blocked on a draft-only endpoint (HKP-AI-3a) + approval gate (HKP-AI-8); market data pulled forward to Wave B0 ahead of trading writes; Wave A demo-hack contradiction resolved (scripted demo survives in mock mode only); new provenance decision D10; Wave B proofs cover FILLED **and** NO_FILL and plt-reporting failure.

---

## 1. Ground truth (verified, not aspirational)

**App side.** All screens consume data through one seam: `src/api/index.ts:16-27` binds six interfaces (`PortfolioApi`, `IdeasApi`, `NewsApi`, `PlannerApi`, `AuthApi`, `AssistantApi` — `src/api/portfolioApi.ts:27-70`) to mock classes. Hooks in `src/hooks/queries.ts` have query keys and invalidation wired (order mutation invalidation is incomplete — see APP-101). There is **no networking code anywhere**. Live "prices" come from `src/api/marketData/MarketDataSimulator.ts` (deterministic OU walk).

**Backend side.** Four services, no gateway (`service-gty` in the backend README does not exist as code):

| Service | Protocol | Port | Browser-callable today? |
|---|---|---|---|
| service-plt (system of record) | HTTP JSON snake_case | 7201 | Yes, except **no CORS** |
| service-ai (decision engine) | HTTP JSON | 7301 (**binds 127.0.0.1**) | Yes locally, no CORS |
| service-bkt (execution/backtests) | HTTP JSON | 7401 | Yes, no CORS |
| service-mnd (market data + news) | **gRPC only** :7101 (HTTP :7102 is health/admin only) | 7101/7102 | **No** — JSON facade on :7102 is DECIDED (HKP-MND-1) |

Zero auth anywhere. No browser-facing push channel (only gRPC `StreamSnapshots`; mnd's Alpaca WebSocket is an outbound client). plt **never marks positions to market** — `unrealized_pnl` is always 0 for open positions (`PortfolioService.java:220-240, 269-281`); realized P&L, win rate, peak equity are real. LLM output is a deterministic mock unless `STRATFOLIO_LLM_BASE_URL`+key+model are set (`service-ai .../gateway/factory.py:15-31`).

**Two hard semantics reviewers must internalize:**
- ai `POST /api/v1/decision-cycles/run` is **not a draft generator**: it constructs a plan, submits it to plt, and invokes bkt execution (`cycle.py:2924-3041`). Any UI wired to it is requesting a full paper-executing decision.
- bkt execution returns `FILLED` **or the equally successful `NO_FILL`** on 201, plus `reported_to_platform`/`platform_error` (`execution/engine.py:121-160`). A 201 is not proof of a position.

**V1 product invariant (binding):** silent/paper trading only; long single-leg CALL/PUT, DTE ≥ 1. The backend has no equity/stock positions.

---

## 2. Locked decisions (challenge in review, not in implementation)

- **D1 — Two integration targets, not one.** (a) **Dev milestone:** Vite dev proxy (`/plt`, `/ai`, `/bkt`, `/mnd` → localhost 7201/7301/7401/7102); no backend CORS needed; proves data integration only — the service worker registers only in PROD builds (`src/main.tsx:12-15`), so dev cannot prove installed-PWA behavior. (b) **Release gate (built PWA):** exact-origin CORS allowlist on all four HTTP surfaces (HKP-CORS-1, credentials disabled) **or** a local production reverse proxy, plus an installed-build smoke test. GitHub Pages stays mock-only for V1. D7's service-worker API bypass belongs to (b) but lands in Wave A anyway.
- **D2 — Per-domain live/mock switch, not big-bang.** `src/api/index.ts` picks `Http*Api` vs `Mock*Api` per domain from `VITE_DATA_*` env flags (default: mock). Rollout is domain-by-domain across waves. The scripted demo experience is a supported product mode, preserved in mock bindings (see APP-104).
- **D3 (reversed in rev 2) — Wire DTOs + evolved view models; app types are NOT frozen.** Current app types encode the rich mock dataset, not any backend contract: `Position.ai` and all of `AIAssessment` are required (`src/api/types.ts:28-48,72-89`) and dereferenced unguarded (`src/lib/portfolioMath.ts:110-113`); `Idea`/`PlannerIdea` require prices/recommendation/presentation fields no DTO carries; `Order` cannot represent `NO_FILL`; `PlanCriterion.met` cannot say "unknown". Freezing them forces forbidden fabrication. Therefore: per-service wire DTO types (hand-pinned against `/v3/api-docs` + `/openapi.json`), mapped to **revised view models** with explicit availability — optional assessments (`ai?`), criteria `met | unmet | unknown`, order outcomes `SUBMITTED | FILLED | NO_FILL | REJECTED` (+ `reported_to_platform`/`platform_error` as a recoverable state, never a success toast), explicit paper-account identity replacing the six fake brokerages, and per-value provenance (D10). Components gain unavailable-state rendering. This is the single largest app-side work item and lives in APP-101/102.
- **D4 — What the backend cannot serve stays mocked and labeled, never silently fabricated.** Fabricated-but-presented-as-real data (fake order IDs, coin-flip criteria) never enters live adapters; in mock mode it may remain, visibly labeled, where the demo script needs it.
- **D5 — No auth in V1 hookup.** Local-first single user; loopback exposure only. Any CORS/reverse-proxy work must preserve the not-externally-exposed boundary until HKP-AUTH-1.
- **D6 — Money & idempotency discipline.** plt sends JSON decimals with `non_null` omission (absent ≠ null, never fabricate 0); mnd facade sends decimal strings for all money (micros converted server-side); `profit_target_pct`/`stop_loss_pct` are **fractions of entry premium**. Idempotency is **endpoint-specific and retry-stable**: one key per logical user operation, generated once and reused across retries/timeouts; plt takes an `Idempotency-Key` header (`TradePlanController.java:54-67`), bkt takes `idempotency_key` in the **body** (`api/executions.py:70-87`). No generic fresh-UUID-per-POST wrapper — that turns a retry into a second simulation.
- **D7 — Service worker API bypass (network-only for `/plt|/ai|/bkt|/mnd`) lands in Wave A**, though it only matters for PROD builds (see D1).
- **D8 — Polling, not streaming, for V1.** TanStack Query `refetchInterval`; chain polling respects mnd's provider cadence and staleness fields rather than assuming 5s freshness.
- **D9 — Tests move to MSW** with fixtures pinned against the real services' OpenAPI. Existing mock-layer tests stay.
- **D10 (new) — Per-domain provenance replaces the global demo badge.** With per-domain switching, screens will mix live portfolio data with mocked AI/news/synthetic marks. The global "everything is simulated" badge (`DemoBadge.tsx:3-12`, `PortfolioPage.tsx:294-299`) becomes false at the first mixed-mode build. Every view model carries a source tag (`live | replay | synthetic | mock`); mnd data additionally carries its own provenance (`DATA_SOURCE_SYNTHETIC` must be labeled — `proto .../common.proto:48-64`); UI renders per-panel provenance chips.

---

## 3. Domain → backend mapping

Legend: **LIVE** = servable now · **PARTIAL** = servable with adaptation/loss · **BLOCKED(gap)** = needs backend work · **LOCAL** = deliberately client-side.

### 3.1 PortfolioApi

| Method | Backend | Status |
|---|---|---|
| `getAccounts()` | plt `GET /api/v1/portfolio` → single explicit paper account (view model change; six fake brokerages removed from live mode) | **PARTIAL** — multi-account/brokerage = HKP-PLT-6. |
| `getPositions(accountId)` | plt `GET /api/v1/positions?status=OPEN` | **PARTIAL** — options only (HKP-PLT-7); `company` from local symbol map until HKP-MND-4; `contractDetail` derived from `occ_symbol`/strike/expiration; **`ai` becomes optional** — populated only from a real episode via `decision_episode_id` (ai `GET /api/v1/episodes/{id}` returns confidence/decision/audit fields, *not* the full mock `AIAssessment` — map only what exists, UI renders absence); live mark from mnd facade (Wave B0), until then entry-based values labeled `synthetic`. |
| `getMeta(accountId)` | plt `GET /api/v1/portfolio` | **LIVE** — `cash → cash_balance`, `buyingPower → cash_balance` (product decision retained), **`totalDeposited → open_positions_cost_basis`** (app defines it as open-position cost basis — `src/api/types.ts:108-113`; rev 1's `starting_capital` mapping was wrong). |
| `getOutlook(accountId)` | — | **BLOCKED (HKP-AI-5)** — mocked with tag. |
| `getPerformance(accountId, period)` | plt `GET /api/v1/silent-trades?status=CLOSED&limit=500` → settled-equity curve | **PARTIAL** — settled-only, labeled; **bounded**: 500 is the endpoint max with no pagination (`SilentTradeController.java:85-90`), so `ALL` is labeled "last 500 closed trades" until HKP-PLT-8. True marked history = HKP-PLT-2 (reclassified P1). |
| `submitOrder(...)` — open | plt `POST /api/v1/trade-plans` → bkt `POST /api/v1/executions {trade_plan_id, idempotency_key}` | **PARTIAL, Wave B, with a redesigned ticket.** The current `OrderRequest` (symbol/side/qty/price — `src/api/types.ts:151-159`) cannot construct a valid plan: `CreateTradePlanRequest` needs option identity (type/strike/expiry), entry band, risk/execution modes (`CreateTradePlanRequest.java:36-85`), and PolicyGate validates them. The new option ticket needs contract selection from the mnd facade chain (Wave B0 prerequisite) or executes an existing validated plan. Ticket UX rewritten around "silent execution attempt": authorized entry band, possible NO_FILL, simulated fill costs — no "market/GFD, $0 commission" copy (`TradeTicket.tsx:340-346`). 422 `rejection_reasons[]` rendered verbatim. |
| `submitOrder(...)` — close | — | **BLOCKED (HKP-BKT-1)** — no user-initiated exit; plt `/close` takes caller-supplied fill facts and must never receive UI estimates. Close disabled in live mode (mock mode may keep the simulated flow, labeled). |
| `getOrders()` (new seam method) | plt silent-trades + open trade-plans + bkt execution outcomes | **PARTIAL** (not LIVE — rev 1 error): view model must represent plan-validated vs FILLED vs NO_FILL vs REJECTED vs filled-but-unreported (`platform_error`). `EXAMPLE_ORDERS` fixture is replaced by the seam; the mock binding serves the scripted orders (mock `getOrders()` already exists unexposed — `MockPortfolioApi.ts:270-279`); live `HeaderOrders` gets empty/no-pending states (it currently assumes a pending order exists). |
| `addPositionFromIdea(...)` | thesis → plt trade-plan → bkt execution | **PARTIAL** — same constraints as open order. |
| `getActivity()` | plt `GET /api/v1/activity?limit=100` | **LIVE** — wire field is **`action_type`** (DTO `actionType` + SNAKE_CASE — `ActivityResponse.java:9-17`, rev 1 said `action`); plt's `ActionType` roster is much broader than the app's four kinds — adapter ships a complete mapping + honest `other` fallback. |

### 3.2 IdeasApi (theses)

plt `GET /api/v1/theses` / `{id}`. **PARTIAL with view-model change (rev 2):** `ThesisResponse` carries ticker, direction, rationale, evidence/features, confidence, one expected catalyst, horizon, invalidation conditions (`ThesisResponse.java:12-29`) — **no** company, prices/bands, recommendation, tags, or catalyst/risk arrays. The app's `Idea` type cannot be satisfied; instead a `ThesisView` model renders what exists (rationale, confidence, invalidation conditions are genuinely good content) and drops the mock-only stat rows. Accept/reject: **BLOCKED (HKP-PLT-3**, terminology aligned to the app's existing `added|rejected`**)** — interim: localStorage + `POST /api/v1/activity` record; note the plt outbox has no relay/AI consumer yet, so the learning-loop claim waits for the shared PLT+AI delivery task. Thesis content is MockModel output until HKP-AI-6.

### 3.3 PlannerApi (trade plans)

| App concept | Backend | Status |
|---|---|---|
| `getIdeas()` list | plt `GET /api/v1/trade-plans` (+ thesis join for rationale) | **PARTIAL with view-model change** — `TradePlanResponse` supplies option terms, entry band, fractional exits, status, confidence/reasoning (`TradePlanResponse.java:13-86`); a `PlanView` renders those and does not pretend to have title/author/categories/absolute stops that neither DTO carries. Status map documented in the adapter. |
| AI plan composer | — | **BLOCKED (HKP-AI-3a draft-only endpoint + HKP-AI-8 approval gate).** `decision-cycles/run` paper-executes; it may be exposed in Wave C only as an explicitly labeled **"Run AI decision (paper-executes)"** action gated by the approval/kill-switch policy — never as a "composer". Client regex NLP (`src/lib/planPrompt.ts`) is deleted, not moved. |
| `createIdea` (manual/from thesis/from position) | plt `POST /api/v1/trade-plans` | **PARTIAL** — full option identity required (see 3.1 open order); client-side heuristics in `src/lib/thesisPlan.ts:5-32` deleted. |
| criteria / readiness | — | **BLOCKED (HKP-XSV-1)** — no backend owns typed entry criteria; plt/bkt "criteria" are *exit* rules. Coin-flip `met` deleted Wave A; criteria render as free text with state `unknown`. |
| enable/disable, edit, delete | — | **BLOCKED (HKP-PLT-4)** — validated plans are audit records: disable → future `CANCELLED`-with-reason transition; interim localStorage + activity record; delete hidden for backend-sourced plans. **The "enabled plans execute automatically" promise (`UpcomingTradePlans.tsx:565`) is removed from live-mode UI until HKP-XSV-1 exists — nothing implements autonomous entry.** |

### 3.4 NewsApi

**BLOCKED (HKP-MND-2)** — gRPC-only, off by default, no body/sentiment on `NewsEvent`, release calendar stub. When the facade lands: bitemporal bounds preserved, news-disabled renders as an explicit capability-unavailable state (never an empty news day), `ArticlePage` degrades to summary+source-link. Mocked until then.

### 3.5 Market data (Wave B0 — mnd JSON facade, HKP-MND-1 DECIDED)

Quotes, candles, option chains, market status via the :7102 JSON facade. Adapter obligations: decimal-string money, provenance + staleness surfaced per D10 (mnd data may be `SYNTHETIC` in replay — "from mnd" ≠ "real"), bounded bar windows (store returns oldest-first under a cap — "latest N" needs an explicit time window), chain filters (expiration/DTE/type) instead of full-chain pulls. `MarketDataSimulator` replaced by a polling provider feeding `priceStore`; `optionMark()` (`portfolioMath.ts:39-49`) prefers server chain mid → **real unrealized P&L**; in-browser IV/OI fabrication (`optionMath.ts`, `terminalSeries.ts`) deleted from live mode. Chain-history RPCs (`GetHistoricalChain`, `GetChainSnapshotHistory`) are **deferred from the V1 facade** (gaps doc HKP-MND-1); the app features needing them stay mocked. DOW tile deleted (it's SPY×0.42). Index strip shows what the dataset serves.

### 3.6 AssistantApi / chat

**BLOCKED (HKP-AI-2)** — tables exist, zero routes. Mock stays with tag; MSFT easter egg confined to mock mode (demo script depends on it — `MockAssistantApi.ts:79-93`). Reprompt capture stays local until HKP-AI-4.

### 3.7 Research / backtests

bkt is real. `POST /api/v1/backtests` (synchronous-despite-202 confirmed — poll immediately, long client timeout), long single-leg strategies only: library prunes to supported presets (HKP-BKT-3 for more). `simulateRun()` random walk and fake `SilentTape` deleted from live mode. Metrics UI renders exactly what `result` returns.

### 3.8 Deliberately LOCAL

Tile/field prefs, mobile ticker, notification booleans, unread-news flag. AI settings + master AI-trading toggle (currently memory-only, not even localStorage — `uiStore.ts:6-34`) are agent policy: interim local, but **execution-affecting policy must become server-enforced** (HKP-PLT-5 split / HKP-AI-8) — a client-side kill switch is not a kill switch.

---

## 4. Waves

### Wave A — plumbing + system-of-record reads (backend prereq: none)
- **APP-101** HTTP foundation: fetch wrapper, ProblemDetail→`ApiError` (carrying `rejection_reasons[]`), per-endpoint idempotency helper per D6, env flags + `.env.example`, Vite proxy, SW bypass, MSW rig; **view-model revision per D3** (types, availability states, provenance tags) — the mock bindings are updated to produce the same view models so mock mode keeps working.
- **APP-102** `HttpPortfolioApi`: portfolio/meta (fixed mappings), positions (optional `ai`), activity (`action_type` + kind map), orders seam (`getOrders()` with full outcome states; fixture removed, mock binding serves scripted orders), bounded settled performance curve.
- **APP-103** Watchlist → plt `/api/v1/watchlist*` (real API, never called by app today).
- **APP-104** Fabrication containment: coin-flip criteria → `unknown` state; synthesized fills/order IDs and DOW tile removed from live views; scripted demo artifacts (forced plans, easter egg, `EXAMPLE_ORDERS`-equivalent data, `resetDemo`) **retained but confined to mock bindings and labeled** — resolves rev 1's delete-vs-byte-identical contradiction: the proof is "demo script still passes in mock mode", not byte-identity.
- **Proof:** live mode renders real portfolio/positions/activity/watchlist against `make up`+plt; mock-mode demo script passes; automated grep-assertion that no brokerage SDK/live-order path exists in the app dependency graph (repeated every wave).

### Wave B0 — market data (backend prereq: **HKP-MND-1 facade**)
- **APP-108** Quote/chain/bars/status provider + provenance plumbing (§3.5); real unrealized P&L; terminal + index strip live.
- **Proof:** replay-mode mnd + app: quotes/chain values spot-checked against gRPC (grpcurl), P&L moves with replay clock, synthetic provenance visibly labeled.

### Wave B — trading writes + theses (prereq: Wave B0)
- **APP-111** `HttpIdeasApi` + `ThesisView` (adapter contract test pins every field against `/v3/api-docs`).
- **APP-112** Option ticket redesign (contract selection from live chain) → trade-plan + execution chain; deterministic fixtures prove **FILLED and NO_FILL** outcomes, stable idempotent retry replay, 422 reason rendering, and the filled-but-`platform_error` recoverable state; targeted query invalidation across plan/orders/positions/meta/performance/activity (today's order mutation only invalidates activity — `queries.ts:78-87`).
- **APP-113** Planner reads (`PlanView`); interim decision/disable recording via activity; manual close disabled in live mode.
- **Proof:** live plt+bkt+mnd(replay): open a plan from a thesis, observe both fill outcomes across fixtures, rejection UX, and plt reconciliation; safety grep-assertion.

### Wave C — ai + research (prereq: HKP-AI-8 for any execution trigger)
- **APP-121** "Run AI decision" action with explicit paper-execution labeling + server-side approval gate; episode detail on positions/theses; ml-status badge. (Composer UX itself waits for HKP-AI-3a.)
- **APP-122** Research → real bkt backtests; template pruning.
- **Proof:** decision run from UI in replay mode traces one episode id across screens; a real backtest renders; disabled kill-switch blocks the run server-side (not just in UI).

### Wave D — news + remaining blocked domains (prereqs: HKP-MND-2, HKP-AI-2/5)
News hookup + degraded article UI; assistant/chat; outlook.

Ownership: APP tasks single-writer in this repo; backend gaps owned per the gaps doc. Lead integrates each wave end.

---

## 5. Files created/changed (Wave A blast radius)

New: `src/api/http/client.ts`, `src/api/http/HttpPortfolioApi.ts` (+siblings later), `src/api/http/wire/*.ts` (pinned DTOs), `src/api/http/adapters/*.ts`, `src/api/env.ts`, `.env.example`, `src/test/msw/*`. Changed: `src/api/types.ts` + `src/api/newsTypes.ts` (view-model revision, D3), `src/api/index.ts`, `src/api/portfolioApi.ts` (add `getOrders`), mock classes (produce revised view models), `vite.config.ts`, `public/service-worker.js`, `HeaderOrders.tsx`, `Watchlist.tsx`, `planIntent.ts`, `positionEvents.ts`, `DemoBadge.tsx` (→ provenance chips), consumers of `Position.ai` gaining guards (`portfolioMath.ts:110-113`, `TradeTicket.tsx:348-353`, others found by the compiler once `ai` is optional).

---

## 6. Fabrication policy (rev 2)

**Removed from live views (Wave A):** coin-flip criteria met-state; synthesized fills/slippage/order IDs; DOW-from-SPY; fabricated IV/OI (live removal completes in B0).
**Confined to mock mode, labeled (demo script preserved):** forced demo plans, MSFT assistant response, scripted orders, price simulator, seeded news, fake stress tests/chat summaries in `AIOutlookPanel`.
**Mocked-with-tag until their gap lands:** assistant (HKP-AI-2), news (HKP-MND-2), outlook (HKP-AI-5), AI-settings persistence (HKP-PLT-5/HKP-AI-8).

---

## 7. Wire footguns (adapter test checklist)

1. `profit_target_pct`/`stop_loss_pct` are fractions, not percent points.
2. plt omits null fields (`non_null`) — absent ≠ 0; missing stays missing.
3. mnd facade money = decimal strings (micros converted server-side); Greeks/IV are JSON numbers; counts integers.
4. `rejection_reasons[]` may repeat codes.
5. bkt `POST /backtests`: 202-but-synchronous; poll immediately; long POST timeout.
6. bkt idempotency in body; plt in header; keys stable per logical operation (D6).
7. bkt 201 = FILLED **or** NO_FILL; check `reported_to_platform`/`platform_error`.
8. plt trade-plan response does not echo `as_of` (documented contract gap).
9. plt activity wire field is `action_type`; `ActionType` roster ⊃ app kinds.
10. plt list endpoints cap at `limit=500`, no pagination (HKP-PLT-8).
11. App seed timestamps are relative; real ISO timestamps age — check `relativeTime()` on old data.

---

## 8. Env / run book (dev)

```
# backend repo
make up                         # timescaledb + mlflow
(cd service-mnd && make run)    # replay mode by default
(cd service-plt && make run)
(cd service-bkt && make run)
(cd service-ai  && make run)    # binds 127.0.0.1 — proxy targets localhost
# app repo
cp .env.example .env            # VITE_DATA_PORTFOLIO=live etc.
npm run dev                     # proxy: /plt→7201 /ai→7301 /bkt→7401 /mnd→7102
```
Built-PWA/release path per D1(b). GitHub Pages stays mock-only.

---

## 9. Review checklist (for Cursor / other agents; Codex reviewed rev 1)

1. **Contract truth:** spot-check ≥3 rev-2 mapping rows (§3) against actual DTOs — especially the corrected `getMeta`, activity, and the `ThesisView`/`PlanView` field sets.
2. **Accidental-live-trading audit:** confirm no Wave A–C path can submit anything but silent trades, **including** that no UI path reaches `decision-cycles/run` without the explicit paper-execution labeling + HKP-AI-8 gate.
3. **D3 view-model revision:** is the availability modeling (`ai?`, criteria `unknown`, `NO_FILL`) complete, or are there other required-but-unservable fields that would force fabrication?
4. **Wave B0 placement:** agree market data must precede trading writes? Any reason B0 can't start immediately after Wave A given HKP-MND-1 is decided?
5. **Idempotency design (D6):** verify the stable-key-per-operation rule against plt/bkt replay semantics.
6. **§6 fabrication policy:** is mock-mode confinement airtight (no scripted record can leak into a live adapter)?
7. **Proof criteria:** are the FILLED/NO_FILL/platform_error fixtures sufficient evidence for Wave B?
8. Record findings in `docs/plans/BACKEND_HOOKUP_V1_REVIEWS.md` under your agent name; the lead integrates.
