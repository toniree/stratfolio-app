# Backend Hookup V1 — Progress Log

Chronological record of verification evidence and milestone status for the `backend-hookup` workstream.

---

## Wave A — DONE (verified)

**Date:** 2026-08-31  
**Branch:** `backend-hookup` @ `0c15395` (static pass recorded) + live-smoke re-run same day  
**Agent:** Cursor verification pass (live-smoke re-run)  
**Plan:** `docs/plans/BACKEND_HOOKUP_V1_PLAN.md` (§4 Wave A proof, §6 fabrication policy)

### Summary

| Check | Result |
|---|---|
| 1. `npx tsc -b` | **PASS** (exit 0) |
| 2. `npx vitest run` | **PASS** — 51 files, 267 tests, 7.12s |
| 3. `npm run build` | **PASS** (exit 0; chunk-size warning only) |
| 4. `npx oxlint src` | **PASS** (exit 0, no errors) |
| 4b. D4 `no-restricted-imports` in `.oxlintrc.json` | **PASS** — rule present under `src/api/http/**` override |
| 5. Wave-A greps (no brokerage SDK; no mock imports in `src/api/http/`) | **PASS** |
| 6. Live smoke — `make up` + `make wait-db` + `(cd service-plt && make run)` | **PASS** — plt UP in ~2s |
| 7–8. Vite proxy curls (`VITE_DATA_PORTFOLIO=live`, `npm run dev`) | **PASS** — all four endpoints 200 + valid plt JSON |

**Overall: Wave A verification PASSED** (static suite + prescribed live-smoke procedure).

---

### Static / suite evidence (2026-08-31, commit `0c15395`)

#### Typecheck
```bash
cd /Users/tmoney/dev/stratfolio-app && npx tsc -b
# exit 0, no output
```

#### Vitest
```bash
cd /Users/tmoney/dev/stratfolio-app && npx vitest run
```
```
 Test Files  51 passed (51)
      Tests  267 passed (267)
   Duration  7.12s
```

#### Production build
```bash
cd /Users/tmoney/dev/stratfolio-app && npm run build
# exit 0 — dist/assets/index-D06iU2uX.js built
```

#### Oxlint
```bash
cd /Users/tmoney/dev/stratfolio-app && npx oxlint src
# exit 0, no errors
```

#### Wave-A grep assertions

- **Brokerage SDK in `package.json` dependencies:** none found.
- **Forbidden live-order patterns in `src/`:** covered by `fabricationContainment.test.ts` (267-test suite includes this).
- **`src/api/http/**` imports from `api/mock` or `seeded*`:** none found (18 files under `src/api/http/`).

---

### Runbook defect (prior failure) — resolved

**First live-smoke attempt (same day, `0c15395`):** Step 6 failed because `(cd service-plt && make run)` did not load the repo-root `.env`. `application.yml` defaults `STRATFOLIO_DB_PORT` to **5432**, but local TimescaleDB publishes **5433** (`/Users/tmoney/dev/stratfolio/.env`). Flyway could not connect; `http://localhost:7201/actuator/health` never returned 200.

**Fix (backend repo):** commit `67ce11c` — `fix(build): make run sources repo-root .env in plt/ai/bkt (APP-100 runbook)`.

**Re-run (prescribed procedure, no source changes):**

1. Docker was not running at session start; started Docker Desktop, then `make up && make wait-db` (stack healthy, postgres on `localhost:5433`).
2. `(cd service-plt && make run)` — plt connected to `jdbc:postgresql://localhost:5433/stratfolio_plt` and reached `{"status":"UP"}` in **~2s**.
3. Note: sourcing root `.env` emits a benign shell warning on line 51 (`MND_SEC_USER_AGENT=StratFolio/0.1.0 (…)` — parentheses); DB vars still applied; boot succeeded.

---

### Live-smoke evidence (2026-08-31 re-run)

#### Backend startup
```bash
cd /Users/tmoney/dev/stratfolio && make up && make wait-db
cd /Users/tmoney/dev/stratfolio/service-plt && make run
# health: http://localhost:7201/actuator/health → {"status":"UP",...,"db":{"status":"UP",...}}
```

#### App startup
```bash
cp .env.example .env   # VITE_DATA_PORTFOLIO=live; other domains mock
cd /Users/tmoney/dev/stratfolio-app && npm run dev
# VITE v8.2.1 ready in 217 ms — http://localhost:5173/
```

#### Vite proxy curls (all HTTP 200, valid JSON)

| Endpoint | HTTP | Shape notes |
|---|---|---|
| `/plt/api/v1/portfolio` | 200 | snake_case (`cash_balance`, `starting_capital`, `total_equity`, …); money fields JSON **numbers** (`cash_balance`: 102967.75, `starting_capital`: 100000.0) |
| `/plt/api/v1/positions?status=OPEN` | 200 | Array of 3 open positions; `entry_price`, `cost_basis` numeric; snake_case wire |
| `/plt/api/v1/activity` | 200 | Activity array; first entry `action_type=CANDIDATE_PROMOTED`, `entity_type=candidate_instrument` |
| `/plt/api/v1/watchlist` | 200 | `{ entries: [...], active_count: 73, max: 125, ... }` ActiveUniverse payload |

Sample portfolio excerpt (plt wire contract):
```json
{"cash_balance":102967.7500,"starting_capital":100000.0000,"total_equity":103597.7000,"return_pct":3.5977,"open_positions":3}
```

#### Cleanup performed
- Vite dev server stopped (port 5173)
- plt process stopped (port 7201)
- Verification `.env` removed from app repo
- Docker compose stack **left running**

---

### Known limitations (Wave A proof scope)

- **No browser-rendered check** — verification used curl through the Vite dev proxy only; UI rendering of live portfolio/universe data was not exercised.
- **No installed-PWA smoke** — dev proxy (D1a) only; production service-worker bypass and exact-origin routing are out of scope for this proof.
- **Live smoke = plt reads only** — only `VITE_DATA_PORTFOLIO=live` was set; universe/ideas/planner/news/assistant domains remained `mock`. Proxy curls hit plt directly; no write paths or bkt/ai/mnd services were started.
