# StratFolio App — Backend Hookup V1 Plan

- **Status:** DRAFT **rev 3** — rev 1 reviewed by Codex (rework), rev 2 by Cursor (approve-with-changes); rev 3 integrates both (`BACKEND_HOOKUP_V1_REVIEWS.md`). **Implementation-ready pending user go-ahead.**
- **Author:** Claude Fable 5 (lead agent), 2026-08-31 (rev 3 same day).
- **App repo:** `stratfolio-app` @ branch `backend-hookup`.
- **Backend repo:** `../stratfolio` @ branch `app-hookup` (head `6f4bc2b`). Binding contracts: `../stratfolio/docs/architecture/BACKEND_V1_SERVICE_CONTRACTS.md`.
- **Companion doc:** `../stratfolio/docs/plans/APP_HOOKUP_BACKEND_GAPS_V1.md` (rev 3) — authoritative backend gap list.

**Rev 3 change log (from Cursor review):** APP-103 re-scoped — plt watchlist is **ActiveUniverse**, not the terminal tape; `getOrders()` given an implementable merge + new gap HKP-BKT-4; `company`/`brokerageId` made optional/dropped in live view models (no live-safe company map exists); confidence 0..1 vs conviction 0–100 footgun added; ticket hard-pins `execution_mode`/`risk_profile`; D6 clarified (retry reuses key, try-again mints new); performance-chart equity basis pinned; interim activity payload schema pinned to real `ActionType`; auto-execution copy citations completed; LLM-mock claim corrected; plan status map includes `PROPOSED`/`CANCELLED`.

---

## 1. Ground truth (verified, not aspirational)

**App side.** All screens consume data through one seam: `src/api/index.ts:16-27` binds six interfaces (`src/api/portfolioApi.ts:27-70`) to mock classes. Hooks in `src/hooks/queries.ts` have keys/invalidation wired (order mutation invalidation incomplete — APP-101). No networking code exists. Live "prices" come from `src/api/marketData/MarketDataSimulator.ts`, booted unconditionally (`App.tsx:30-32`).

**Backend side.** Four services, no gateway (`service-gty` in the backend README does not exist):

| Service | Protocol | Port | Browser-callable today? |
|---|---|---|---|
| service-plt (system of record) | HTTP JSON snake_case | 7201 | Yes, except **no CORS** |
| service-ai (decision engine) | HTTP JSON | 7301 (binds 127.0.0.1) | Yes locally, no CORS |
| service-bkt (execution/backtests) | HTTP JSON | 7401 | Yes, no CORS |
| service-mnd (market data + news) | **gRPC only** :7101 (HTTP :7102 health/admin) | 7101/7102 | **No** — JSON facade on :7102 DECIDED (HKP-MND-1) |

Zero auth anywhere. No browser-facing push (only gRPC `StreamSnapshots`). plt never marks positions to market — `unrealized_pnl` is always 0 while open (`PortfolioService.java:220-240, 269-281`). LLM content is a deterministic mock because `STRATFOLIO_LLM_PROVIDER` defaults to the mock provider (`service-ai config.py:51-56`, `gateway/factory.py:12-28`); selecting `openai-compatible` without base-url/key/model **raises**, it does not silently mock.

**Hard semantics reviewers must internalize:**
- ai `POST /api/v1/decision-cycles/run` is **not a draft generator**: it submits a plan to plt and invokes bkt execution (`cycle.py:2924-3041`).
- bkt execution 201 = `FILLED` **or the equally successful `NO_FILL`**, plus `reported_to_platform`/`platform_error` (`execution/engine.py:121-160`). `NO_FILL` leaves **no silent-trade row**, and bkt has **no list-executions route** (only by-plan/by-id — `api/executions.py:145-189`) → gap HKP-BKT-4.
- plt `/api/v1/watchlist*` is the **ActiveUniverse** (capacity, pinning, AI promotion, validation — contracts §10), not a cosmetic ticker list.

**V1 product invariant (binding):** silent/paper trading only; long single-leg CALL/PUT, DTE ≥ 1. No equity/stock positions exist backend-side.

---

## 2. Locked decisions

- **D1 — Two integration targets.** (a) Dev milestone: Vite dev proxy (`/plt`,`/ai`,`/bkt`,`/mnd` → 7201/7301/7401/7102); proves data integration only (service worker registers only in PROD — `src/main.tsx:12-15`). (b) Release gate (built PWA): exact-origin CORS (HKP-CORS-1) or local reverse proxy + installed-build smoke. GitHub Pages stays mock-only.
- **D2 — Per-domain live/mock switch** via `VITE_DATA_*` flags (default mock). The scripted demo is a supported product mode confined to mock bindings.
- **D3 — Wire DTOs + evolved view models; app types are NOT frozen.** Per-service wire DTOs (pinned against `/v3/api-docs` + `/openapi.json`) map to revised view models with explicit availability: optional assessments (`ai?`), criteria `met | unmet | unknown`, order outcomes `SUBMITTED | FILLED | NO_FILL | REJECTED` (+ `reported_to_platform=false`/`platform_error` as a recoverable state, never a success toast). **Rev 3 additions:** `company?: string` (ticker fallback; the only company names in the app live in mock seed files — importing them into live adapters violates D4); `brokerageId` is **dropped** from live position/order view models in favor of one explicit paper-account identity; plan status map covers the full backend enum `PROPOSED | VALIDATED | REJECTED | EXECUTED | CANCELLED` (`TradePlanStatus.java:4-9`). Components gain unavailable-state rendering; the compiler surfaces the full `Idea.ai`/`Position.ai` consumer blast radius (larger than §5's named files — `RecTile`, `IdeaCard`, `RecDetailsPage`, etc.).
- **D4 — Backend-unservable data stays mocked and labeled, never silently fabricated.** Live adapters must not import `seededData`/`seededOptionsBook`/`EXAMPLE_ORDERS`/`REQUIRED_DEMO_PLAN_IDS` (lint-enforced import boundary in APP-101).
- **D5 — No auth in V1 hookup.** Loopback only until HKP-AUTH-1.
- **D6 — Money & idempotency discipline.** plt JSON decimals with `non_null` omission; `profit_target_pct`/`stop_loss_pct` are fractions. Idempotency endpoint-specific: plt header, bkt body. Keys are stable per **logical operation**: a timeout/network retry **reuses** the key (bkt replays the recorded outcome — `executions.py:28-36,123-135`); a user's "try again" after a returned `NO_FILL`/`REJECTED` is a **new operation and mints a new key**. The ticket state machine documents this explicitly.
- **D7 — Service worker API bypass** (network-only `/plt|/ai|/bkt|/mnd`) lands Wave A.
- **D8 — Polling for V1**; chain polling respects mnd provider cadence + staleness fields.
- **D9 — MSW tests** with OpenAPI-pinned fixtures.
- **D10 — Per-domain provenance replaces the global demo badge.** Every view model carries `live | replay | synthetic | mock`; mnd provenance (`DATA_SOURCE_SYNTHETIC`) surfaces per-panel. Wave A proof asserts the global "everything is simulated" copy (`DemoBadge.tsx:3-12`, `PortfolioPage.tsx:294-299`) is gone from mixed-mode builds.
- **D11 (new) — The ticket hard-pins policy inputs.** `execution_mode=silent` and an allowlisted `risk_profile` are constants in the adapter, never derived from UI state or free text.

---

## 3. Domain → backend mapping

Legend: **LIVE** · **PARTIAL** · **BLOCKED(gap)** · **LOCAL**.

### 3.1 PortfolioApi

| Method | Backend | Status |
|---|---|---|
| `getAccounts()` | plt `GET /api/v1/portfolio` → one explicit paper account | **PARTIAL** — multi-account = HKP-PLT-6. |
| `getPositions(accountId)` | plt `GET /api/v1/positions?status=OPEN` | **PARTIAL** — options only (HKP-PLT-7); `company?` optional (HKP-MND-4); `contractDetail` derived from `occ_symbol`; `ai?` populated only from a real episode via `decision_episode_id` (episode carries confidence/decision/audit — map only what exists); live mark from Wave B0, until then entry-based + `synthetic` tag. |
| `getMeta(accountId)` | plt `GET /api/v1/portfolio` | **LIVE** — `cash`/`buyingPower → cash_balance`, `totalDeposited → open_positions_cost_basis`. |
| `getOutlook(accountId)` | — | **BLOCKED (HKP-AI-5).** |
| `getPerformance(accountId, period)` | plt `GET /api/v1/silent-trades?status=CLOSED&limit=500` → settled-equity curve | **PARTIAL** — labeled "settled equity · last ≤500 closed trades" (HKP-PLT-8 for pagination; HKP-PLT-2 for marked history). **One equity basis per chart:** the settled curve is never multiplied by live marked value (`PerformanceChart.tsx:29` footgun) — after B0 the chart shows settled series + current marked NAV as a separate point/stat, not a blended series. |
| `submitOrder(...)` — open | plt `POST /api/v1/trade-plans` → bkt `POST /api/v1/executions {trade_plan_id, idempotency_key}` | **PARTIAL, Wave B, redesigned ticket** — full option identity from live chain (B0 prereq), D11 pinned policy inputs, 422 `rejection_reasons[]` verbatim, "silent execution attempt" UX (no market/GFD/$0-commission copy). |
| `submitOrder(...)` — close | — | **BLOCKED (HKP-BKT-1)** — disabled in live mode; mock keeps the simulated flow, labeled. |
| `getOrders()` (new seam method) | **Implementable merge (rev 3):** plt `GET /api/v1/silent-trades` (fills + closes) ∪ plt `GET /api/v1/trade-plans?status=VALIDATED\|REJECTED` (pending/rejected intents) ∪ **session-retained bkt submit outcomes** (NO_FILL/platform_error live only in the execution response until HKP-BKT-4 adds a list route) | **PARTIAL** — durable NO_FILL *history* is BLOCKED (HKP-BKT-4); until then NO_FILL entries persist for the session and the UI labels history "fills & pending plans". No N+1 by-plan fan-out. |
| `addPositionFromIdea(...)` | thesis → plan → execution | **PARTIAL** — same constraints. |
| `getActivity()` | plt `GET /api/v1/activity?limit=100` | **LIVE** — wire field `action_type`; complete `ActionType`→kind map + `other` fallback. |

### 3.2 IdeasApi (theses)

plt `GET /api/v1/theses` / `{id}` → **`ThesisView`** (rationale, direction, confidence, evidence, invalidation conditions, expected catalyst, horizon — exactly the DTO fields, nothing invented). **Confidence is 0..1 on the wire (contracts); app conviction is 0–100 — view models keep fractional and format at render (§7).** Accept/reject: **BLOCKED (HKP-PLT-3**, `added|rejected`**)**; interim = localStorage + plt activity record with a **schema-valid payload**: `CreateActivityRequest{action_type: USER_ACTIVITY, entity_type, entity_id, detail}` (`CreateActivityRequest.java:10-15`) — no free-form types the enum rejects. Outbox delivery to ai = HKP-PLT-9. Content is MockModel until HKP-AI-6.

### 3.3 PlannerApi (trade plans)

| App concept | Backend | Status |
|---|---|---|
| `getIdeas()` | plt `GET /api/v1/trade-plans` (+ thesis join) → **`PlanView`** | **PARTIAL** — full status enum mapped incl. `PROPOSED`/`CANCELLED`; no fabricated title/author/absolute stops. |
| AI plan composer | — | **BLOCKED (HKP-AI-3a + HKP-AI-8).** Wave C may expose only an explicitly labeled **"Run AI decision (paper-executes)"** action behind the server-side gate. Client regex NLP deleted. |
| `createIdea` | plt `POST /api/v1/trade-plans` | **PARTIAL** — D11; client heuristics (`thesisPlan.ts:5-32`) deleted. |
| criteria / readiness | — | **BLOCKED (HKP-XSV-1)** — coin-flip `met` deleted Wave A; criteria render free-text with `unknown`. Note plt already validates entry *price bands* (`target_entry_min/max`, `PolicyGate.java:116-124`) — the view shows the band as the one real criterion. |
| enable/disable/edit/delete | — | **BLOCKED (HKP-PLT-4** — note `CANCELLED` exists in the enum but **no service path sets it today**`)`; interim localStorage + schema-valid activity record. **All auto-execution copy is removed from live mode** — `UpcomingTradePlans.tsx:565`, `AITradingControl.tsx:138-139,217-218`, `PlannerPage.tsx:81` — nothing implements autonomous entry (HKP-XSV-1). |

### 3.4 NewsApi

**BLOCKED (HKP-MND-2)** — mocked until the facade lands; then bitemporal bounds preserved, news-disabled renders capability-unavailable (never an empty news day), `ArticlePage` degrades to summary+link.

### 3.5 Market data (Wave B0 — HKP-MND-1, DECIDED)

Quotes, bars, chains, market status via the :7102 JSON facade (routes/bounds/caps per the gaps doc rev 3 contract). Adapter obligations: decimal-string money everywhere (strikes, OHLCV, VWAP included), provenance + staleness per D10, bounded bar windows (explicit start+end), chain filters, no full-chain pulls. Simulator replaced by a polling provider feeding `priceStore`; `optionMark()` prefers server chain mid → real unrealized P&L; in-browser IV/OI fabrication deleted from live mode. `GetHistoricalChain`/`GetChainSnapshotHistory` **and `StreamSnapshots`** are deferred from the V1 facade — dependent features stay mocked. DOW tile deleted.

### 3.6 AssistantApi / chat

**BLOCKED (HKP-AI-2)** — mock stays, tagged; easter egg confined to mock. Reprompts local until HKP-AI-4.

### 3.7 Research / backtests

bkt real; 202-but-synchronous (poll immediately, long POST timeout); long single-leg presets only (HKP-BKT-3); `simulateRun()` + fake `SilentTape` deleted from live mode.

### 3.8 Terminal watchlist & ActiveUniverse (re-scoped in rev 3)

Two different products, previously conflated:
- **Terminal tape (`Watchlist.tsx`) stays LOCAL** (persisted client-side; quotes go live in B0). Casual add/remove must not mutate the AI universe, and plt's ~default-pinned universe must not flood the rail.
- **APP-103 becomes a dedicated ActiveUniverse surface**: a read/manage view over plt `/api/v1/watchlist*` (membership, capacity, pinned, validation status, promotion source) living with portfolio/settings UI, using the real add/exclude/pin semantics.

### 3.9 Deliberately LOCAL

Tile/field prefs, mobile ticker, notification booleans, unread flag. AI settings + master toggle: interim local; execution-affecting policy becomes server-enforced via HKP-AI-8/HKP-PLT-5 (a client-side kill switch is not a kill switch).

---

## 4. Waves

### Wave A — plumbing + system-of-record reads (backend prereq: none)
- **APP-101** HTTP foundation: fetch wrapper, ProblemDetail→`ApiError`, D6 idempotency helper, env flags + `.env.example`, Vite proxy, SW bypass, MSW rig; **D3 view-model revision** (mocks updated to produce the same view models); lint-enforced mock-import boundary (D4).
- **APP-102** `HttpPortfolioApi`: meta/positions/activity/orders-merge (§3.1)/bounded settled curve.
- **APP-103** ActiveUniverse surface per §3.8 (terminal tape untouched).
- **APP-104** Fabrication containment per §6; global simulated-copy removal (D10).
- **Proof:** live mode renders real portfolio/positions/activity/universe against `make up`+plt; mock-mode demo script passes; brokerage-SDK/live-order grep-assertion; mixed-mode copy assertion.

### Wave B0 — market data (prereq: **HKP-MND-1 facade**; starts immediately after A once facade exists)
- **APP-108** Quote/chain/bars/status provider + provenance; real unrealized P&L; terminal + index strip live; performance chart gains the separate marked-NAV stat (§3.1).
- **Proof:** replay-mode mnd vs facade spot-check (grpcurl), P&L moves with replay clock, synthetic provenance labeled.

### Wave B — trading writes + theses (prereq: B0)
- **APP-111** `HttpIdeasApi` + `ThesisView` (field-pinned contract test; fractional confidence).
- **APP-112** Option ticket (live-chain contract selection, D11 pinned inputs) → plan + execution; fixtures prove **FILLED and NO_FILL**, idempotent retry replay vs new-operation key, 422 rendering, `platform_error` recoverable state, **NO_FILL appearing in the orders seam without a silent-trade row**; full query invalidation set.
- **APP-113** `PlanView` reads; interim disposition/disable via schema-valid activity; manual close disabled (live).
- **Proof:** live plt+bkt+mnd(replay) end-to-end open flow incl. both outcomes; safety grep.

### Wave C — ai + research (prereq: HKP-AI-8 for any execution trigger)
- **APP-121** "Run AI decision (paper-executes)" behind server-side gate; episode detail; ml-status badge. Composer waits for HKP-AI-3a.
- **APP-122** Research → real backtests; template pruning.
- **Proof:** one episode id traced across screens; server-side (not UI) kill-switch refusal demonstrated.

### Wave D — news + remaining blocked domains (prereqs: HKP-MND-2, HKP-AI-2/5)

Lead integrates each wave end; single writer per APP task.

---

## 5. Wave A blast radius

New: `src/api/http/{client,env}.ts`, `src/api/http/wire/*`, `src/api/http/adapters/*`, `HttpPortfolioApi.ts`, `.env.example`, `src/test/msw/*`. Changed: `types.ts`/`newsTypes.ts` (D3), `index.ts`, `portfolioApi.ts` (+`getOrders`), mock classes, `vite.config.ts`, `service-worker.js`, `HeaderOrders.tsx`, `planIntent.ts`, `positionEvents.ts`, `DemoBadge.tsx`, `PerformanceChart.tsx`, plus **every consumer of `Position.ai`/`Idea.ai` surfaced by the compiler once optional** (`portfolioMath.ts:110-113`, `TradeTicket.tsx:348-353`, `RecTile`, `IdeaCard`, `RecDetailsPage`, …).

---

## 6. Fabrication policy

**Removed from live views (Wave A):** coin-flip criteria; synthesized fills/order IDs; DOW-from-SPY; fabricated IV/OI (completes B0); auto-execution copy; global simulated badge.
**Confined to mock mode, labeled:** forced demo plans, MSFT response, scripted orders, simulator, seeded news, `AIOutlookPanel` fixtures, company-name seed data.
**Mocked-with-tag until gap lands:** assistant, news, outlook, AI-settings persistence.

---

## 7. Wire footguns (adapter test checklist)

1. `profit_target_pct`/`stop_loss_pct` are fractions, not percent points.
2. plt `non_null` omission — absent ≠ 0; missing stays missing.
3. mnd facade money = decimal strings (every nested field: strikes, OHLCV, VWAP); Greeks/IV JSON numbers; counts integers.
4. **Confidence 0..1 (thesis/plan/episode wire) vs app conviction 0–100 — keep fractional in view models, format at render; never a silent ×100.**
5. `rejection_reasons[]` may repeat codes.
6. bkt 202-but-synchronous backtests; poll immediately.
7. bkt idempotency in body / plt in header; retry reuses key, try-again mints new (D6).
8. bkt 201 = FILLED or NO_FILL; check `reported_to_platform`/`platform_error`; NO_FILL has no silent-trade row.
9. plt trade-plan response does not echo `as_of`.
10. plt activity wire field `action_type`; roster ⊃ app kinds; writes need enum-valid `action_type` + `entity_type`/`entity_id`.
11. plt list caps at `limit=500`, no cursor (HKP-PLT-8).
12. Plan status enum: `PROPOSED | VALIDATED | REJECTED | EXECUTED | CANCELLED` (CANCELLED currently never set by any path).
13. Relative-looking seed timestamps vs real aging ISO timestamps in `relativeTime()`.

---

## 8. Env / run book (dev)

```
# backend repo
make up
(cd service-mnd && make run)    # replay mode
(cd service-plt && make run)
(cd service-bkt && make run)
(cd service-ai  && make run)
# app repo
cp .env.example .env && npm run dev   # proxy: /plt→7201 /ai→7301 /bkt→7401 /mnd→7102
```

---

## 9. Review record

- Codex reviewed rev 1 → rework; integrated in rev 2.
- Cursor reviewed rev 2 → approve-with-changes; integrated in rev 3 (ActiveUniverse split, getOrders merge + HKP-BKT-4, confidence footgun, optional company/dropped brokerage, D11, equity-basis rule, activity payload schema, LLM-mock correction).
- Full reviews: `BACKEND_HOOKUP_V1_REVIEWS.md`. Further reviewers: verify the rev-3 deltas above, then record findings there under your agent name.
