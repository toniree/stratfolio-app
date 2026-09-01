# Wave B0 (APP-108) — Verification Failures

**Date:** 2026-08-31  
**Branch:** `backend-hookup` @ `b428583` (includes `517b7a2`)  
**Agent:** Cursor verification pass  
**Plan:** `docs/plans/BACKEND_HOOKUP_V1_PLAN.md` (§3.5, §4 Wave B0 proof)  
**mnd facade contract:** `../stratfolio/docs/architecture/BACKEND_V1_SERVICE_CONTRACTS.md` §15

---

## Verdict: **FAILED** (static suite)

Live replay smoke against `synthetic-v1` largely passed, but the prescribed full Vitest run reported **4 failing tests** in **2 files**. Per proof criteria, Wave B0 cannot be marked DONE.

---

## Static / suite results

| # | Check | Result |
|---|---|---|
| 1 | `npx tsc -b` | **PASS** (exit 0) |
| 2 | `npx vitest run` (full suite) | **FAIL** — 55 files, **333 tests**, **329 passed**, **4 failed**, 6.92s |
| 3 | `npm run build` | **PASS** (exit 0; chunk-size warning only) |
| 4 | `npx oxlint src` | **PASS** (exit 0, no errors) |

### Vitest failure 1 — `MockActiveUniverseApi.test.ts`

**Test:** `terminal tape stays local (§3.8) > Watchlist.tsx never touches the ActiveUniverse API or plt`

**Assertion:** `expect(source).not.toMatch(/ActiveUniverse/)`

**Cause:** `src/components/terminal/Watchlist.tsx` now contains the string `ActiveUniverse` in a comment added by APP-108 (`useTrackedSymbols` wiring for live quotes). The test treats any occurrence of that substring as a plt/universe coupling violation.

**Evidence (excerpt from failure output):**
```
// The rail stays a local tape (plan §3.8) — adding a ticker here must never
// touch the AI's ActiveUniverse — but its quotes come from whichever source
// is bound, so the live provider is told which symbols the rail wants.
```

### Vitest failure 2 — `PositionPlanSheet.ui.test.tsx` (3 tests)

**Tests:**
- `shows a two-line prompt summary, plan data, and an AI prompt editor`
- `requires max sizing in the prompt and creates a plan scoped to the exact position`
- `keeps Add plan available through three existing plans`

**Error:**
```
Error: No QueryClient set, use QueryClientProvider to set one
 ❯ useOptionMarks src/hooks/marketQueries.ts:170:19
 ❯ PositionPlanSheet src/components/positions/PositionPlanSheet.tsx:72:21
```

**Cause:** APP-108 added `useOptionMarks()` to `PositionPlanSheet` for real chain marks, but the component UI tests render without a `QueryClientProvider`. The suite passes 329 other tests; these three regress.

---

## Live replay smoke (backend `app-hookup`, mnd `synthetic-v1`)

Docker stack brought up (`make up && make wait-db`). Replay was already `RUNNING` on first `readyz` check (no admin start needed).

| Step | Result |
|---|---|
| mnd `:7102/readyz` | **PASS** — `mode=REPLAY`, `replay_dataset=synthetic-v1`, `replay_state=RUNNING` |
| plt `:7201/actuator/health` | **PASS** — `{"status":"UP",...}` in ~2s |
| App `.env` (`VITE_DATA_PORTFOLIO=live`, `VITE_DATA_MARKET=live`) + `npm run dev` | **PASS** — Vite ready on `:5173` |

### Vite proxy curls (`http://localhost:5173/mnd/...`)

| Endpoint | HTTP | Notes |
|---|---|---|
| `/api/v1/market/status` | 200 | Replay clock `2026-06-01T13:33:00Z` (advances with replay); `mode=MARKET_MODE_REPLAY`; `server_time` RFC3339 |
| `/api/v1/market/snapshots/AAPL` | 200 | Money fields decimal **strings** (`mid`: `"192.152971"`); `provenance.source=DATA_SOURCE_SYNTHETIC`; `event_time` RFC3339 |
| `/api/v1/market/bars/AAPL?start=2026-05-01T00:00:00Z&end=<clock>&interval=1d&limit=10` | 200 | OHLCV/VWAP all strings (`open`: `"191.50"`, `vwap`: `"192.318424"`); `provenance` synthetic/replay |
| `/api/v1/market/chains/AAPL?limit=5` | 200 | `strike`/`bid`/`ask`/`mid`/`underlying_price` all `str`; `implied_volatility` JSON numbers |

**Note:** `interval=BAR_INTERVAL_ONE_DAY` returns **400** (`interval must be one of 1m, 5m, 15m, 1h, 1d`). The app adapter uses `1d` (verified in `HttpMarketDataApi` tests and `PollingQuoteProvider`).

### Open question (a) — IV unit

**Answer: fraction (0..~3), not percent points.**

Sample `implied_volatility` values from chain AAPL:
- `0.2810694864779917`
- `0.27920122170164785`
- `atm_implied_volatility` on snapshot: `0.2539385028876274`

**App assumption (×100 at display) is correct** — no IV-unit FAIL.

### Open question (b) — default symbol coverage (`synthetic-v1`)

Replay admin stats list **`tickers: 3`** for this dataset.

| Symbol | Snapshot | Daily bars (`interval=1d`) |
|---|---|---|
| SPY | **200** — `mid=529.60053` | **200** — 1 bar in window |
| QQQ | **404** — `not found: quote QQQ` | **503** — `market store unavailable` |
| NVDA | **404** — `not found: quote NVDA` | **503** — `market store unavailable` |
| AAPL | **200** — `mid=192.272321` | **200** — 1 bar in window |
| MSFT | **200** — `mid=418.043844` | **200** — 1 bar in window |

**Symbols missing both snapshot and usable bars window:** **QQQ**, **NVDA** (dataset limitation for `synthetic-v1`, not a facade encoding defect).

### Movement check (~30s apart, replay running)

| | T0 | T1 (+30s) |
|---|---|---|
| Replay clock | `2026-06-01T13:37:00Z` | `2026-06-01T13:42:00Z` |
| AAPL snapshot `as_of` | `2026-06-01T13:37:00Z` | `2026-06-01T13:42:00Z` |
| AAPL `underlying.mid` | `192.119739` | `192.76731` |
| `events_emitted` | 45 | 75 |

**PASS** — mids and quote timestamps advance with the replay clock.

---

## Cleanup performed

- Vite dev server stopped
- mnd and plt processes stopped
- Verification `.env` removed from app repo
- Docker compose stack **left running**

---

## Known limitations (not exercised; not counted as failures)

- No browser-rendered check
- Picker/company names still from seed per plan §3.8
- `useLiveBars` interval choices and empty-chain-summary paths unexercised

---

## Required remediation before re-verification

1. Fix or update `MockActiveUniverseApi.test.ts` so the §3.8 guard does not false-positive on explanatory comments, **or** reword the `Watchlist.tsx` comment to avoid the `ActiveUniverse` substring while preserving intent.
2. Wrap `PositionPlanSheet.ui.test.tsx` renders with `QueryClientProvider` (and any MSW handlers `useOptionMarks` needs), matching patterns used elsewhere in the suite.
