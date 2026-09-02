# StratFolio App — Agent Instructions

These instructions apply to every coding-agent task in this repository (Codex, Cursor, Claude, others).

## Start here

1. This repo is the user-facing PWA for the StratFolio backend at `../stratfolio`. Shared engineering policy lives there: read `../stratfolio/AGENTS.md`, `../stratfolio/docs/AI_CONTEXT.md`, and `../stratfolio/.cursor/rules/` before substantial work. Those rules (contracts discipline, definition of done, determinism/evidence, proof cadence) apply here too.
2. The active workstream is the backend hookup. Its plan of record is `docs/plans/BACKEND_HOOKUP_V1_PLAN.md`; the companion backend-gap list is `../stratfolio/docs/plans/APP_HOOKUP_BACKEND_GAPS_V1.md`. Both are DRAFT pending multi-agent review — review instructions are in each doc's final section.
3. Cross-service behavior is bound by `../stratfolio/docs/architecture/BACKEND_V1_SERVICE_CONTRACTS.md`. Code is ground truth over prose; the backend README's gateway/WebSocket claims are aspirational and false.

## Repo invariants

- V1 is silent/paper trading only. Never add a path that could submit a live brokerage order.
- The mock/demo mode must keep working: the data layer swaps per-domain at `src/api/index.ts`; components and hooks stay transport-agnostic.
- Synthetic data is either deleted or visibly labeled "simulated" — never presented beside live data as real.
- Money/percent semantics per the app plan §7 (fractions vs percent points, micros, non_null omission). Missing values stay missing; never fabricate zeros.
