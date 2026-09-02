import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BacktestRunCard } from '@/components/research/BacktestRunCard'
import { toBacktestResultView } from '@/api/http/adapters/backtest'
import type { BktBacktestResult } from '@/api/http/wire/bkt'
import type { BacktestRunView } from '@/api/researchTypes'
import { BACKTEST_COMPLETED_FIXTURE, BACKTEST_LEGACY_FIXTURE } from '@/test/msw/fixtures/bkt'

/**
 * The §19 evidence panels (APP-122).
 *
 * These assertions are about honesty, not layout: a withheld statistic must
 * read as withheld, an absent block must read as absent, and a disclosure must
 * appear in the backend's own words.
 */

const REQUEST: BacktestRunView['request'] = {
  presetId: 'long-call-delta-band',
  presetName: 'Long call · 0.35–0.65Δ band',
  right: 'CALL',
  selection: 'DELTA_BAND',
  fidelity: 'strategy-faithful',
  targetDeltaRange: [0.35, 0.65],
  minContractOi: 10,
  minDte: 1,
  maxDte: 45,
  quantity: 1,
  profitTargetPct: 1,
  stopLossPct: 0.5,
  maxHoldingDays: 10,
  forceCloseDte: 1,
  symbols: ['AAPL', 'SPY'],
  start: '2024-01-02',
  end: '2024-06-28',
  initialCapital: 100_000,
  fillProtocol: 'two_quote_band',
}

function run(overrides: Partial<BacktestRunView> = {}): BacktestRunView {
  return {
    id: 'run-1',
    name: REQUEST.presetName,
    status: 'done',
    provenance: 'live',
    createdBy: 'user',
    startedAt: '2026-09-01T12:00:00Z',
    request: REQUEST,
    result: toBacktestResultView(BACKTEST_COMPLETED_FIXTURE.result as BktBacktestResult),
    ...overrides,
  }
}

function openEvidence() {
  fireEvent.click(screen.getByRole('button', { name: /Evidence/ }))
}

describe('a live backtest run', () => {
  it('shows the run’s headline metrics from bkt, not a portfolio return', () => {
    render(<BacktestRunCard run={run()} />)
    expect(screen.getByText('+$119.70')).toBeInTheDocument()
    // Win rate and fill rate are both 50% here, and both are bkt's numbers.
    expect(screen.getAllByText('50%')).toHaveLength(2)
  })

  it('renders a thin bucket as insufficient data, never as a 0% win rate (D4)', () => {
    render(<BacktestRunCard run={run()} />)
    openEvidence()
    // Two delta buckets, two tickers, two exit reasons — all under five trades.
    const withheld = screen.getAllByText(/insufficient data \(n=1\)/)
    expect(withheld.length).toBeGreaterThanOrEqual(6)
    // `unknown` is a real bucket: a trade with no recorded delta is counted,
    // not dropped to make the table tidy.
    expect(screen.getByText('unknown')).toBeInTheDocument()
  })

  it('renders the execution block, the refusal reasons and the pending count', () => {
    render(<BacktestRunCard run={run()} />)
    openEvidence()
    // Once in the by-reason roll-up, once on the refused entry itself.
    expect(screen.getAllByText('ENTRY_PRICE_ABOVE_BAND')).toHaveLength(2)
    expect(screen.getAllByText('CONTRACT_NOT_QUOTED')).toHaveLength(2)
    // Not a refusal — the window ended (§19.1) — so it is stated separately.
    expect(screen.getByText(/had no next session to fill against/)).toBeInTheDocument()
  })

  it('states the per-run trade-quality artifacts and where the pooled medians live', () => {
    render(<BacktestRunCard run={run()} />)
    openEvidence()
    expect(screen.getByText(/per-trade artifacts/i)).toBeInTheDocument()
    expect(screen.getByText(/pooled out-of-sample windows/i)).toBeInTheDocument()
  })

  it('renders the pooled trade-quality block only when the run states one', () => {
    const result = toBacktestResultView({
      ...(BACKTEST_COMPLETED_FIXTURE.result as BktBacktestResult),
      metrics: {
        ...(BACKTEST_COMPLETED_FIXTURE.result as BktBacktestResult).metrics,
        trade_quality: {
          trade_count: 2,
          median_capture: null,
          capture_note: 'no closed trade had a positive MFE: there was no run-up to capture',
          capture_excluded_non_positive_mfe: 2,
          median_mfe: '25.00',
          median_mae: '-102.50',
          median_fill_minus_mid: '0.03',
          no_fill_by_reason: {},
        },
      },
    })
    render(<BacktestRunCard run={run({ result })} />)
    openEvidence()
    expect(screen.getByText(/Pooled trade quality/)).toBeInTheDocument()
    // The withheld median states bkt's reason instead of showing 0.00.
    expect(screen.getByText(/no run-up to capture/)).toBeInTheDocument()
    expect(screen.getByText(/excluded from the capture/)).toBeInTheDocument()
  })

  it('prints the fill-protocol disclosure verbatim', () => {
    render(<BacktestRunCard run={run()} />)
    openEvidence()
    expect(screen.getByText('fill_protocol')).toBeInTheDocument()
    expect(screen.getAllByText('two_quote_band').length).toBeGreaterThan(0)
  })

  it('prints an entry gate and a gate-params clause verbatim when one arrives', () => {
    const result = toBacktestResultView({
      ...(BACKTEST_COMPLETED_FIXTURE.result as BktBacktestResult),
      entry_gate: 'TAPE',
      gate_params_unevaluated: ['signal_weights', 'min_edge'],
    })
    render(<BacktestRunCard run={run({ result })} />)
    openEvidence()
    expect(screen.getByText('entry_gate')).toBeInTheDocument()
    expect(screen.getByText('TAPE')).toBeInTheDocument()
    expect(screen.getByText('gate_params_unevaluated')).toBeInTheDocument()
    expect(screen.getByText('signal_weights')).toBeInTheDocument()
  })

  it('shows the preset parameters read-only — no inputs anywhere', () => {
    const { container } = render(<BacktestRunCard run={run()} />)
    openEvidence()
    expect(screen.getByText('Selection & rules')).toBeInTheDocument()
    expect(screen.getByText('0.35 – 0.65')).toBeInTheDocument()
    expect(container.querySelectorAll('input, select, textarea')).toHaveLength(0)
  })
})

describe('graceful absence and provenance', () => {
  it('tags a legacy-protocol run and renders the missing panels as missing', () => {
    const result = toBacktestResultView(BACKTEST_LEGACY_FIXTURE.result as BktBacktestResult)
    render(<BacktestRunCard run={run({ result })} />)
    expect(screen.getByText('Legacy protocol')).toBeInTheDocument()
    openEvidence()
    expect(screen.getByText(/predates BKT-020/)).toBeInTheDocument()
    expect(screen.getAllByText(/predates the §19.4 buckets/).length).toBeGreaterThan(0)
  })

  it('labels a demo-engine run and never shows it bkt panels', () => {
    render(
      <BacktestRunCard
        run={run({
          provenance: 'mock',
          result: undefined,
          simulated: {
            cagr: 0.12,
            sharpe: 0.8,
            sortino: 1.1,
            maxDrawdown: 0.21,
            winRate: 0.41,
            profitFactor: 1.3,
            trades: 64,
            vsSpy: 0.03,
            equity: [1, 1.05, 1.12],
            note: 'Simulated: marginal after costs.',
          },
        })}
      />,
    )
    expect(screen.getByText('Simulated')).toBeInTheDocument()
    expect(screen.getByText(/Demo engine/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Evidence/ })).not.toBeInTheDocument()
  })

  it('renders a failed run with bkt’s own reason and the id that identifies it', () => {
    render(
      <BacktestRunCard
        run={run({ status: 'failed', result: undefined, error: 'market data unavailable' })}
      />,
    )
    expect(screen.getByText('market data unavailable')).toBeInTheDocument()
    expect(screen.getByText(/run run-1/)).toBeInTheDocument()
  })
})
