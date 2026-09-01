# Wave A Verification Failures

**Date:** 2026-08-31  
**Branch:** `backend-hookup` @ commits `d3cccca`, `ad577bc`, `316766d`, `454b20e`  
**Agent:** Cursor verification pass  
**Plan:** `docs/plans/BACKEND_HOOKUP_V1_PLAN.md` (§4 Wave A proof, §6 fabrication policy)

---

## Summary

| Check | Result |
|---|---|
| 1. `npx tsc -b` | **PASS** (exit 0) |
| 2. `npx vitest run` | **PASS** — 51 files, 267 tests, 7.12s |
| 3. `npm run build` | **PASS** (exit 0; chunk-size warning only) |
| 4. `npx oxlint src` | **PASS** (exit 0, no errors) |
| 4b. D4 `no-restricted-imports` in `.oxlintrc.json` | **PASS** — rule present under `src/api/http/**` override |
| 5. Wave-A greps (no brokerage SDK; no mock imports in `src/api/http/`) | **PASS** |
| 6. Live smoke — `make up` + `make wait-db` + `(cd service-plt && make run)` | **FAIL** — plt cannot reach DB |
| 7–8. Vite proxy curls (prescribed procedure) | **NOT REACHED** — blocked by step 6 |

**Overall: Wave A verification FAILED** on live-mode smoke step 6 per the prescribed runbook commands.

---

## Static / suite evidence (all green)

### Typecheck
```bash
cd /Users/tmoney/dev/stratfolio-app && npx tsc -b
# exit 0, no output
```

### Vitest
```bash
cd /Users/tmoney/dev/stratfolio-app && npx vitest run
```
```
 Test Files  51 passed (51)
      Tests  267 passed (267)
   Duration  7.12s
```

### Production build
```bash
cd /Users/tmoney/dev/stratfolio-app && npm run build
# exit 0 — dist/assets/index-D06iU2uX.js built
```

### Oxlint
```bash
cd /Users/tmoney/dev/stratfolio-app && npx oxlint src
# exit 0, no errors
```

### Wave-A grep assertions

- **Brokerage SDK in `package.json` dependencies:** none found.
- **Forbidden live-order patterns in `src/`:** covered by `fabricationContainment.test.ts` (267-test suite includes this).
- **`src/api/http/**` imports from `api/mock` or `seeded*`:** none found (18 files under `src/api/http/`).

---

## Failure 1 — `make up` (transient; stack already running)

**Command:**
```bash
cd /Users/tmoney/dev/stratfolio && make up
```

**Result:** exit 2 — Docker build timed out pulling `ghcr.io/mlflow/mlflow:v2.22.0`:
```
failed to solve: DeadlineExceeded: context deadline exceeded
make: *** [up] Error 1
```

**Note:** The compose stack was already healthy from a prior session (`stratfolio-timescaledb` on host port **5433**). `make wait-db` subsequently succeeded.

---

## Failure 2 — `(cd service-plt && make run)` cannot connect to database (BLOCKING)

**Commands (prescribed):**
```bash
cd /Users/tmoney/dev/stratfolio && make wait-db
cd /Users/tmoney/dev/stratfolio/service-plt && make run
```

**Result:** service-plt exits after ~35s. Flyway cannot obtain a DB connection.

**Excerpt from plt boot log:**
```
Connection to localhost:5432 refused. Check that the hostname and port are correct
and that the postmaster is accepting TCP/IP connections.
```

**Root cause:** `service-plt/src/main/resources/application.yml` defaults `STRATFOLIO_DB_PORT` to **5432**, but the local TimescaleDB container publishes **5433** on this host (`/Users/tmoney/dev/stratfolio/.env` has `STRATFOLIO_DB_PORT=5433`). The prescribed `(cd service-plt && make run)` does **not** load the root `.env`, so plt connects to the wrong port.

**Health poll (2 min):** `http://localhost:7201/actuator/health` never returned 200.

**Diagnostic (out of scope for pass, confirms env is the blocker):** Starting plt with explicit `STRATFOLIO_DB_PORT=5433` reached `{"status":"UP"}` in ~2s. Proxy curls through Vite then returned 200 + valid plt JSON (snake_case, numeric money). That path is **not** the prescribed verification procedure and does **not** clear step 6.

---

## Steps 7–8 not executed under prescribed procedure

Because step 6 failed, the verifier did not complete steps 7–8 as specified (`cp .env.example .env` with `VITE_DATA_PORTFOLIO=live`, `npm run dev`, proxy curls) under the official runbook. Diagnostic curls (after manual plt start with port 5433) showed all four endpoints would likely pass once step 6 is fixed:

| Endpoint | HTTP | Shape notes |
|---|---|---|
| `/plt/api/v1/portfolio` | 200 | `cash_balance`, `starting_capital` as JSON numbers; snake_case |
| `/plt/api/v1/positions?status=OPEN` | 200 | Array of open positions; `entry_price`, `cost_basis` numeric |
| `/plt/api/v1/activity` | 200 | Activity array with `action_type`, `entity_type` |
| `/plt/api/v1/watchlist` | 200 | `{ entries: [...] }` ActiveUniverse payload |

---

## Cleanup performed

- Vite dev server stopped (port 5173)
- plt process stopped (port 7201)
- Verification `.env` removed from app repo
- Docker compose stack **left running** (per instructions)

---

## Recommended fix (for implementers — not applied by verifier)

1. Document that `(cd service-plt && make run)` requires `STRATFOLIO_DB_PORT` (and related DB vars) in the shell environment when the host DB is not on 5432, **or** add a root-level `make run-plt` that exports from `.env`.
2. Re-run live smoke steps 6–8 with the corrected backend startup.
