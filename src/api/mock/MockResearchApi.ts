import type { ResearchApi } from '@/api/portfolioApi'
import type {
  BacktestPreset,
  BacktestRunProgress,
  BacktestRunView,
  QueueBacktestInput,
  SimulatedBacktestSummary,
} from '@/api/researchTypes'
import { BACKTEST_PRESETS, findPreset } from '@/api/researchPresets'
import { latency } from '@/api/mock/latency'
import { gaussian, hashString, mulberry32 } from '@/lib/prng'

/**
 * The demo research engine (APP-122).
 *
 * This is where the old `researchStore.simulateRun()` lives now, unchanged in
 * spirit and confined to the mock binding (plan §6): the scripted demo is a
 * supported product mode, and a research desk with no runs in it is a worse
 * demo than one that says its runs are simulated. Every run it produces is
 * tagged `provenance: 'mock'`, which is what the card renders its "Simulated"
 * chip from.
 *
 * What it does **not** do is imitate §19. It emits a `simulated` summary —
 * CAGR, Sharpe, an equity curve — and never a `result`, because a fabricated
 * `no_fill_by_reason` table or delta bucket would be invented execution
 * evidence wearing the shape of the real thing. The panels that read bkt's
 * evidence therefore simply do not render for a demo run, and the card shows
 * the demo engine's own numbers instead.
 */

const PERIOD_POINTS = 78
const PERIOD_YEARS = 3

/**
 * Per-preset shaping constants for the demo engine.
 *
 * Demo content, so they live here rather than on `BacktestPreset` — a preset is
 * a real bkt request, and a "base CAGR" is not a field bkt has, has ever had,
 * or could honour. Long premium is a low-hit-rate, right-skewed profile, and
 * the numbers say so.
 */
const SHAPE: Record<string, { cagr: number; vol: number; winRate: number }> = {
  'long-call-delta-band': { cagr: 0.14, vol: 0.34, winRate: 0.41 },
  'long-put-delta-band': { cagr: 0.03, vol: 0.31, winRate: 0.36 },
  'long-call-nearest-delta': { cagr: 0.11, vol: 0.38, winRate: 0.38 },
  'long-put-nearest-delta': { cagr: 0.01, vol: 0.35, winRate: 0.34 },
}

/** Deterministic engine: same run config, same tape, every time. */
export function simulateRun(input: {
  presetId: string
  symbols: string[]
  start: string
  end: string
}): SimulatedBacktestSummary {
  const shape = SHAPE[input.presetId] ?? { cagr: 0.09, vol: 0.3, winRate: 0.4 }
  const rand = mulberry32(
    hashString(`${input.presetId}:${input.symbols.join(',')}:${input.start}:${input.end}`),
  )
  const points = PERIOD_POINTS
  const years = PERIOD_YEARS

  const drift = shape.cagr + (rand() - 0.45) * 0.04
  const vol = shape.vol * (0.85 + rand() * 0.4)
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
  const winRate = Math.min(0.92, Math.max(0.3, shape.winRate + (rand() - 0.5) * 0.08))
  const profitFactor = Math.max(0.7, 1 + (cagr / Math.max(maxDrawdown, 0.02)) * 0.35 + (rand() - 0.5) * 0.2)
  const trades = Math.round(24 * years * (0.7 + rand() * 0.6))
  const spyCagr = 0.09 + (rand() - 0.5) * 0.01
  const vsSpy = cagr - spyCagr

  const note =
    maxDrawdown > 0.25
      ? `Simulated: edge exists but the ${(maxDrawdown * 100).toFixed(0)}% drawdown breaches the −20% research guardrail — size at half Kelly or add the trend filter.`
      : sharpe > 0.9
        ? `Simulated: survives costs at ${sharpe.toFixed(2)} Sharpe; walk-forward folds agree. Candidate for a silent live shadow.`
        : `Simulated: marginal after costs — profitable in ${(winRate * 100).toFixed(0)}% of windows but Sharpe ${sharpe.toFixed(2)} is below the 0.75 promotion bar.`

  return { cagr, sharpe, sortino, maxDrawdown, winRate, profitFactor, trades, vsSpy, equity, note }
}

function requestView(preset: BacktestPreset, input: QueueBacktestInput) {
  return {
    presetId: preset.id,
    presetName: preset.name,
    right: preset.right,
    selection: preset.selection,
    fidelity: preset.fidelity,
    targetDeltaRange: preset.targetDeltaRange,
    targetDelta: preset.targetDelta,
    minContractOi: preset.minContractOi,
    minDte: preset.minDte,
    maxDte: preset.maxDte,
    quantity: preset.quantity,
    profitTargetPct: preset.profitTargetPct,
    stopLossPct: preset.stopLossPct,
    maxHoldingDays: preset.maxHoldingDays,
    forceCloseDte: preset.forceCloseDte,
    symbols: input.symbols,
    start: input.start,
    end: input.end,
    initialCapital: input.initialCapital,
    fillProtocol: 'two_quote_band' as const,
  }
}

const DEMO_WINDOW = { start: '2024-01-02', end: '2024-12-31' }

function seedRun(
  presetId: string,
  symbols: string[],
  hoursAgo: number,
  createdBy: 'ai' | 'user',
): BacktestRunView {
  const preset = findPreset(presetId) ?? BACKTEST_PRESETS[0]
  const input: QueueBacktestInput = {
    presetId: preset.id,
    symbols,
    start: DEMO_WINDOW.start,
    end: DEMO_WINDOW.end,
    initialCapital: 100_000,
  }
  return {
    id: `seed-${preset.id}-${symbols.join('-')}`,
    name: preset.name,
    status: 'done',
    provenance: 'mock',
    createdBy,
    startedAt: new Date(Date.now() - hoursAgo * 3_600_000).toISOString(),
    request: requestView(preset, input),
    simulated: simulateRun({ ...input, presetId: preset.id }),
  }
}

let sequence = 0

export class MockResearchApi implements ResearchApi {
  readonly provenance = 'mock' as const

  /** The demo desk keeps its own history, so this one can list. */
  readonly canListPastRuns = true

  private queued = new Map<string, QueueBacktestInput>()

  async getRuns(): Promise<BacktestRunView[]> {
    await latency(200)
    return [
      seedRun('long-call-delta-band', ['NVDA', 'AAPL', 'MSFT'], 26, 'ai'),
      seedRun('long-put-delta-band', ['SPY'], 51, 'user'),
      seedRun('long-call-nearest-delta', ['SPY', 'AAPL'], 78, 'ai'),
    ]
  }

  async submitRun(input: QueueBacktestInput): Promise<{ id: string }> {
    sequence += 1
    const id = `mock-run-${Date.now()}-${sequence}`
    this.queued.set(id, input)
    return { id }
  }

  async getRun(id: string): Promise<BacktestRunProgress | undefined> {
    const input = this.queued.get(id)
    if (!input) return undefined
    // The demo engine "computes" for a beat so the queue feels real.
    await latency(2200)
    return {
      id,
      status: 'done',
      simulated: simulateRun({
        presetId: input.presetId,
        symbols: input.symbols,
        start: input.start,
        end: input.end,
      }),
    }
  }
}

export const mockResearchApi = new MockResearchApi()
