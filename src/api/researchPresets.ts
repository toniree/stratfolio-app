import type { BacktestPreset } from '@/api/researchTypes'

/**
 * The strategy library, pruned to what the engine can actually run (APP-122).
 *
 * The previous library was ten studies from the quant literature — covered
 * calls, cash-secured puts, iron condors, delta-hedged straddles, cross-
 * sectional momentum, PEAD, collars. Every one of them is short premium, a
 * spread, or an equity portfolio, and **service-bkt can express none of them**:
 * its V1 universe is long single-leg CALL/PUT with DTE ≥ 1, enforced twice
 * (`execution/policy.py` and `backtest/models.py`), and a request naming a
 * short, a spread or a sub-1-DTE window is rejected at the API boundary before
 * an engine runs (HKP-BKT-3). A library whose entries 422 is not a library.
 *
 * What is left is four presets that mirror the shipping system:
 *
 *  - two **strategy-faithful** presets in `DELTA_BAND` — the mode an ai
 *    experiment submission uses (contracts §19.6), carrying the champion's own
 *    `target_delta_range` and `min_contract_oi`, so the backtest picks the
 *    contract the live selector would have picked;
 *  - two **baseline** presets in `NEAREST_DELTA` — the pre-BKT-020 point-target
 *    mode, kept because it is the mode the random-entry null and every
 *    pre-§19 run are expressed in. Labelled "baseline" for exactly that reason:
 *    it is not the shipping policy, and a run in this mode is not evidence
 *    about what the live selector would have done (§19.2).
 *
 * The numbers are not invented. They are `StrategyParamsV2`'s defaults
 * (`service-ai/decision/params.py`): band `[0.35, 0.65]`, `min_contract_oi 10`,
 * DTE 1–45, `profit_target_pct 1.0`, `stop_loss_pct_fraction 0.5`,
 * `max_holding_days 10`, `dte_floor 1` (bkt's `force_close_dte`). The exits are
 * **fractions of entry premium** (§7.1/§12.3): 1.0 is +100%, not +1%.
 *
 * Every field here is read-only in the UI. A preset is the claim a run's
 * evidence is about; letting a user retune the band in a text box would produce
 * runs that look like the strategy and are not it.
 */
export const BACKTEST_PRESETS: readonly BacktestPreset[] = [
  {
    id: 'long-call-delta-band',
    name: 'Long call · 0.35–0.65Δ band',
    source: 'contracts §19.2/§19.6 — ai DELTA_BAND selection parity',
    blurb:
      'Buys the call the live selector would buy: inside the |delta| band, above the open-interest floor, ranked max OI → tightest relative spread → lowest strike.',
    right: 'CALL',
    selection: 'DELTA_BAND',
    fidelity: 'strategy-faithful',
    targetDeltaRange: [0.35, 0.65],
    minContractOi: 10,
    minDte: 1,
    maxDte: 45,
    quantity: 1,
    profitTargetPct: 1.0,
    stopLossPct: 0.5,
    maxHoldingDays: 10,
    forceCloseDte: 1,
  },
  {
    id: 'long-put-delta-band',
    name: 'Long put · 0.35–0.65Δ band',
    source: 'contracts §19.2/§19.6 — ai DELTA_BAND selection parity',
    blurb:
      'The bearish half of the same rule. V1 is long premium only, so a PUT study is how a downside thesis is expressed at all.',
    right: 'PUT',
    selection: 'DELTA_BAND',
    fidelity: 'strategy-faithful',
    targetDeltaRange: [0.35, 0.65],
    minContractOi: 10,
    minDte: 1,
    maxDte: 45,
    quantity: 1,
    profitTargetPct: 1.0,
    stopLossPct: 0.5,
    maxHoldingDays: 10,
    forceCloseDte: 1,
  },
  {
    id: 'long-call-nearest-delta',
    name: 'Long call · 0.30Δ point target (baseline)',
    source: 'contracts §19.2 — NEAREST_DELTA, the pre-BKT-020 baseline mode',
    blurb:
      'Closest strike to a single 0.30 |delta|, no liquidity floor. The mode the random-entry null and every pre-§19 run are expressed in — a reference, not the shipping policy.',
    right: 'CALL',
    selection: 'NEAREST_DELTA',
    fidelity: 'baseline',
    targetDelta: 0.3,
    minContractOi: 0,
    minDte: 1,
    maxDte: 45,
    quantity: 1,
    profitTargetPct: 1.0,
    stopLossPct: 0.5,
    maxHoldingDays: 10,
    forceCloseDte: 1,
  },
  {
    id: 'long-put-nearest-delta',
    name: 'Long put · 0.30Δ point target (baseline)',
    source: 'contracts §19.2 — NEAREST_DELTA, the pre-BKT-020 baseline mode',
    blurb:
      'The put side of the point-target baseline. Comparing it against the banded preset is what shows whether the band and the floor are doing anything.',
    right: 'PUT',
    selection: 'NEAREST_DELTA',
    fidelity: 'baseline',
    targetDelta: 0.3,
    minContractOi: 0,
    minDte: 1,
    maxDte: 45,
    quantity: 1,
    profitTargetPct: 1.0,
    stopLossPct: 0.5,
    maxHoldingDays: 10,
    forceCloseDte: 1,
  },
]

export function findPreset(id: string): BacktestPreset | undefined {
  return BACKTEST_PRESETS.find((preset) => preset.id === id)
}

/**
 * bkt's bounded-execution caps (`backtest/service.py`), restated so the
 * composer can refuse a request *before* it becomes a 422.
 *
 * They are not style limits: the run happens inside the POST, so these are what
 * keeps a synchronous request bounded. Mirroring them here is the same
 * defence-in-depth bkt itself applies — and a user who is told "3 symbols × 400
 * days is 1,200 symbol-days, the cap is 2,500" can fix the request, where
 * `SYMBOL_DAY_LIMIT_EXCEEDED` in a toast teaches nothing.
 */
export const BACKTEST_LIMITS = {
  maxSymbols: 25,
  maxWindowDays: 400,
  maxSymbolDays: 2500,
} as const

export function windowDays(start: string, end: string): number | undefined {
  const from = Date.parse(`${start}T00:00:00Z`)
  const to = Date.parse(`${end}T00:00:00Z`)
  if (Number.isNaN(from) || Number.isNaN(to)) return undefined
  // bkt counts inclusive calendar days: `(end - start).days + 1`.
  return Math.floor((to - from) / 86_400_000) + 1
}

/**
 * Why this request would be refused, in bkt's own terms — or `undefined`.
 *
 * Deliberately the *same* arithmetic as `validate_request`, including the
 * inclusive day count, so the client's verdict and the server's cannot drift
 * into "the app said fine and bkt said no".
 */
export function backtestRequestRefusal(input: {
  symbols: string[]
  start: string
  end: string
}): string | undefined {
  const symbols = input.symbols.filter((symbol) => symbol.trim().length > 0)
  if (symbols.length === 0) return 'Name at least one symbol.'
  const days = windowDays(input.start, input.end)
  if (days === undefined) return 'Start and end must be YYYY-MM-DD dates.'
  if (days < 1) return 'End must be on or after start.'
  if (symbols.length > BACKTEST_LIMITS.maxSymbols) {
    return `bkt runs at most ${BACKTEST_LIMITS.maxSymbols} symbols per request (TOO_MANY_SYMBOLS).`
  }
  if (days > BACKTEST_LIMITS.maxWindowDays) {
    return `Window is ${days} days; bkt caps a run at ${BACKTEST_LIMITS.maxWindowDays} (WINDOW_TOO_LONG).`
  }
  if (symbols.length * days > BACKTEST_LIMITS.maxSymbolDays) {
    return `${symbols.length} symbols × ${days} days = ${symbols.length * days} symbol-days; bkt caps a synchronous run at ${BACKTEST_LIMITS.maxSymbolDays} (SYMBOL_DAY_LIMIT_EXCEEDED).`
  }
  return undefined
}
