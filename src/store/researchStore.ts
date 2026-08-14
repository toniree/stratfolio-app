import { create } from 'zustand'
import { gaussian, hashString, mulberry32 } from '@/lib/prng'

/**
 * The Research desk: a library of backtest templates drawn from the canonical
 * quant literature, a run queue, and deterministic results. Every "engine"
 * output is seeded from the run's own configuration, so a given backtest
 * always reproduces — which is also the honest property real research demands.
 */

export type BacktestKind = 'options' | 'past-plans' | 'live-plans' | 'silent'

export const KIND_LABELS: Record<BacktestKind, string> = {
  options: 'Options book',
  'past-plans': 'Past trade plans',
  'live-plans': 'Live plans · shadow',
  silent: 'Silent paper trades',
}

export interface StrategyTemplate {
  id: string
  name: string
  /** Where the idea comes from — the paper, index or desk practice. */
  source: string
  blurb: string
  defaultKind: BacktestKind
  tags: string[]
  /** Baseline annual return / vol the deterministic engine shapes runs around. */
  baseCagr: number
  baseVol: number
  baseWinRate: number
}

export const STRATEGY_LIBRARY: StrategyTemplate[] = [
  {
    id: 'covered-call',
    name: 'Covered-Call Overwrite',
    source: 'CBOE BXM methodology (Whaley, 2002)',
    blurb: 'Hold the underlying, sell the 30Δ monthly call. Harvests volatility risk premium at the cost of right-tail upside.',
    defaultKind: 'options',
    tags: ['income', 'VRP'],
    baseCagr: 0.087, baseVol: 0.11, baseWinRate: 0.71,
  },
  {
    id: 'put-write',
    name: 'Cash-Secured Put Writing',
    source: 'CBOE PUT index (Ungar & Moran, 2009)',
    blurb: 'Sell ATM monthly puts fully collateralised. Historically equity-like returns with lower drawdowns — until the gap.',
    defaultKind: 'options',
    tags: ['income', 'VRP'],
    baseCagr: 0.094, baseVol: 0.12, baseWinRate: 0.74,
  },
  {
    id: 'iron-condor-45',
    name: '45-DTE Iron Condor',
    source: 'Practitioner premium-harvest studies (managed at 21 DTE / 50% profit)',
    blurb: 'Short 16Δ strangle, wings for margin. High hit-rate, negatively skewed; management rules do the heavy lifting.',
    defaultKind: 'options',
    tags: ['theta', 'defined-risk'],
    baseCagr: 0.062, baseVol: 0.07, baseWinRate: 0.79,
  },
  {
    id: 'vrp-straddle',
    name: 'Delta-Hedged Short Straddle',
    source: 'Bakshi & Kapadia (2003); Carr & Wu (2009) variance risk premium',
    blurb: 'Sell ATM straddles, hedge delta daily. The purest VRP expression — and the purest tail exposure.',
    defaultKind: 'options',
    tags: ['VRP', 'vol'],
    baseCagr: 0.11, baseVol: 0.16, baseWinRate: 0.68,
  },
  {
    id: 'tsmom',
    name: 'Time-Series Momentum 12-1',
    source: 'Moskowitz, Ooi & Pedersen (2012)',
    blurb: 'Long what is up over the trailing year, flat/short what is down, monthly rebalance, vol-targeted.',
    defaultKind: 'past-plans',
    tags: ['trend', 'momentum'],
    baseCagr: 0.128, baseVol: 0.17, baseWinRate: 0.55,
  },
  {
    id: 'xs-momentum',
    name: 'Cross-Sectional Momentum',
    source: 'Jegadeesh & Titman (1993)',
    blurb: 'Rank the universe on 12-1 returns; hold winners, avoid losers. The most replicated anomaly in the literature.',
    defaultKind: 'past-plans',
    tags: ['momentum'],
    baseCagr: 0.115, baseVol: 0.19, baseWinRate: 0.53,
  },
  {
    id: 'rsi2-reversion',
    name: 'Short-Term Mean Reversion (RSI-2)',
    source: 'Connors & Alvarez (2009); Lo & MacKinlay contrarian evidence',
    blurb: 'Buy 2-period-RSI washouts above the 200-day, exit on strength. High win rate, small average win.',
    defaultKind: 'silent',
    tags: ['reversion', 'swing'],
    baseCagr: 0.096, baseVol: 0.13, baseWinRate: 0.76,
  },
  {
    id: 'sma-cross',
    name: 'Golden-Cross Trend Filter',
    source: 'Brock, Lakonishok & LeBaron (1992)',
    blurb: '50/200 SMA regime filter over the book. Blunt, slow, and still the best drawdown governor in the sample.',
    defaultKind: 'live-plans',
    tags: ['trend', 'filter'],
    baseCagr: 0.083, baseVol: 0.12, baseWinRate: 0.47,
  },
  {
    id: 'pead',
    name: 'Post-Earnings Announcement Drift',
    source: 'Ball & Brown (1968); Bernard & Thomas (1989)',
    blurb: 'Enter with the surprise, ride the drift for 20–40 sessions. Works best where coverage is thin.',
    defaultKind: 'past-plans',
    tags: ['event', 'earnings'],
    baseCagr: 0.104, baseVol: 0.15, baseWinRate: 0.58,
  },
  {
    id: 'collar',
    name: 'Zero-Cost Collar Hedge',
    source: 'Israelov & Klein (2016) — Chasing the Tail',
    blurb: 'Finance downside puts by capping upside with calls across the equity sleeve. A drawdown study, not a return one.',
    defaultKind: 'live-plans',
    tags: ['hedge', 'defined-risk'],
    baseCagr: 0.055, baseVol: 0.08, baseWinRate: 0.61,
  },
]

export interface BacktestMetrics {
  cagr: number
  sharpe: number
  sortino: number
  maxDrawdown: number
  winRate: number
  profitFactor: number
  trades: number
  vsSpy: number
}

export interface BacktestRun {
  id: string
  name: string
  strategyId: string
  kind: BacktestKind
  universe: string
  period: '1Y' | '3Y' | '5Y'
  capital: number
  status: 'running' | 'done'
  startedAt: string
  createdBy: 'ai' | 'user'
  metrics?: BacktestMetrics
  equity?: number[]
  note?: string
}

interface ResearchState {
  runs: BacktestRun[]
  queueRun: (input: {
    strategyId: string
    kind: BacktestKind
    universe: string
    period: BacktestRun['period']
    capital: number
  }) => string
  completeRun: (id: string) => void
}

const PERIOD_POINTS: Record<BacktestRun['period'], number> = { '1Y': 52, '3Y': 78, '5Y': 90 }
const PERIOD_YEARS: Record<BacktestRun['period'], number> = { '1Y': 1, '3Y': 3, '5Y': 5 }

/** Deterministic engine: same run config, same tape, every time. */
export function simulateRun(run: BacktestRun): { metrics: BacktestMetrics; equity: number[]; note: string } {
  const template = STRATEGY_LIBRARY.find((s) => s.id === run.strategyId) ?? STRATEGY_LIBRARY[0]
  const rand = mulberry32(hashString(`${run.strategyId}:${run.kind}:${run.universe}:${run.period}`))
  const points = PERIOD_POINTS[run.period]
  const years = PERIOD_YEARS[run.period]

  const drift = template.baseCagr + (rand() - 0.45) * 0.04
  const vol = template.baseVol * (0.85 + rand() * 0.4)
  const stepDrift = Math.pow(1 + drift, years / points) - 1
  const stepVol = vol * Math.sqrt(years / points)

  const equity: number[] = [1]
  let peak = 1
  let maxDrawdown = 0
  let downVariance = 0
  let variance = 0
  for (let i = 1; i <= points; i++) {
    const shock = gaussian(rand) * stepVol
    const step = stepDrift + shock
    const value = Math.max(0.2, equity[i - 1] * (1 + step))
    equity.push(value)
    variance += step * step
    if (step < 0) downVariance += step * step
    peak = Math.max(peak, value)
    maxDrawdown = Math.max(maxDrawdown, 1 - value / peak)
  }
  const total = equity[equity.length - 1]
  const cagr = Math.pow(total, 1 / years) - 1
  const annVol = Math.sqrt(variance / points) * Math.sqrt(points / years)
  const annDownVol = Math.sqrt(downVariance / points) * Math.sqrt(points / years)
  const sharpe = annVol > 0 ? (cagr - 0.04) / annVol : 0
  const sortino = annDownVol > 0 ? (cagr - 0.04) / annDownVol : sharpe * 1.4
  const winRate = Math.min(0.92, Math.max(0.3, template.baseWinRate + (rand() - 0.5) * 0.08))
  const profitFactor = Math.max(0.7, 1 + (cagr / Math.max(maxDrawdown, 0.02)) * 0.35 + (rand() - 0.5) * 0.2)
  const trades = Math.round((run.kind === 'options' ? 24 : 36) * years * (0.7 + rand() * 0.6))
  const spyCagr = 0.09 + (rand() - 0.5) * 0.01
  const vsSpy = cagr - spyCagr

  const note =
    maxDrawdown > 0.25
      ? `Edge exists but the ${(maxDrawdown * 100).toFixed(0)}% drawdown breaches the −20% research guardrail — size at half Kelly or add the trend filter.`
      : sharpe > 0.9
        ? `Survives costs at ${sharpe.toFixed(2)} Sharpe; walk-forward folds agree. Candidate for a silent live shadow.`
        : `Marginal after costs — profitable in ${(winRate * 100).toFixed(0)}% of windows but Sharpe ${sharpe.toFixed(2)} is below the 0.75 promotion bar.`

  return {
    metrics: { cagr, sharpe, sortino, maxDrawdown, winRate, profitFactor, trades, vsSpy },
    equity,
    note,
  }
}

let runSequence = 0

const seedRun = (
  strategyId: string,
  kind: BacktestKind,
  universe: string,
  period: BacktestRun['period'],
  hoursAgo: number,
  createdBy: 'ai' | 'user',
): BacktestRun => {
  const template = STRATEGY_LIBRARY.find((s) => s.id === strategyId)!
  const base: BacktestRun = {
    id: `seed-${strategyId}-${kind}`,
    name: template.name,
    strategyId,
    kind,
    universe,
    period,
    capital: 25_000,
    status: 'done',
    startedAt: new Date(Date.now() - hoursAgo * 3_600_000).toISOString(),
    createdBy,
  }
  return { ...base, ...simulateRun(base) }
}

export const useResearchStore = create<ResearchState>((set, get) => ({
  // A believable desk: a few finished studies, AI- and user-authored.
  runs: [
    seedRun('put-write', 'options', 'NVDA · AAPL · MSFT · SPY', '3Y', 26, 'ai'),
    seedRun('tsmom', 'past-plans', 'All closed trade plans', '5Y', 51, 'user'),
    seedRun('iron-condor-45', 'options', 'SPY weeklies', '1Y', 78, 'ai'),
    seedRun('sma-cross', 'live-plans', '4 active plans · shadow', '3Y', 120, 'user'),
  ],

  queueRun: ({ strategyId, kind, universe, period, capital }) => {
    runSequence += 1
    const template = STRATEGY_LIBRARY.find((s) => s.id === strategyId)
    const id = `run-${Date.now()}-${runSequence}`
    const run: BacktestRun = {
      id,
      name: template?.name ?? 'Custom backtest',
      strategyId,
      kind,
      universe,
      period,
      capital,
      status: 'running',
      startedAt: new Date().toISOString(),
      createdBy: 'user',
    }
    set((state) => ({ runs: [run, ...state.runs] }))
    // The demo engine "computes" for a beat so the queue feels real.
    setTimeout(() => get().completeRun(id), 2600)
    return id
  },

  completeRun: (id) =>
    set((state) => ({
      runs: state.runs.map((run) =>
        run.id === id && run.status === 'running'
          ? { ...run, status: 'done', ...simulateRun(run) }
          : run,
      ),
    })),
}))
