import { describe, expect, it } from 'vitest'
import {
  toBacktestRequest,
  toBacktestResultView,
  toBucketRow,
} from '@/api/http/adapters/backtest'
import { findPreset } from '@/api/researchPresets'
import type { BktBacktestResult } from '@/api/http/wire/bkt'
import {
  BACKTEST_COMPLETED_FIXTURE,
  BACKTEST_LEGACY_FIXTURE,
} from '@/test/msw/fixtures/bkt'

const INPUT = {
  presetId: 'long-call-delta-band',
  symbols: ['spy', ' aapl '],
  start: '2024-01-02',
  end: '2024-06-28',
  initialCapital: 100_000,
}

const RESULT = BACKTEST_COMPLETED_FIXTURE.result as BktBacktestResult

describe('backtest request (contracts §19.2/§19.6)', () => {
  it('sends the DELTA_BAND wire form exactly, target_delta explicitly null', () => {
    const preset = findPreset('long-call-delta-band')!
    const body = toBacktestRequest(preset, INPUT)

    // The pinned shape from §19.6: a band, a stated OI floor, and an explicit
    // null point target. Omitting `target_delta` would default to 0.30
    // server-side and assert a target the request does not mean.
    expect(body.params.entry).toEqual({
      option_type: 'CALL',
      selection: 'DELTA_BAND',
      target_delta: null,
      target_delta_range: ['0.35', '0.65'],
      otm_pct: null,
      min_contract_oi: 10,
      min_dte: 1,
      max_dte: 45,
      quantity: 1,
    })
    // Decimals cross as strings, not JSON numbers.
    expect(body.params.initial_capital).toBe('100000')
    expect(typeof body.params.entry.target_delta_range?.[0]).toBe('string')
  })

  it('keeps the exits as FRACTIONS of entry premium (§7.1/§12.3)', () => {
    const body = toBacktestRequest(findPreset('long-call-delta-band')!, INPUT)
    // 1.0 is +100% of entry premium and 0.5 is −50%. A ×100 here would ask for
    // a 100× profit target and a stop that can never trigger.
    expect(body.params.exit.profit_target_pct).toBe('1')
    expect(body.params.exit.stop_loss_pct).toBe('0.5')
    expect(body.params.exit.max_holding_days).toBe(10)
    expect(body.params.exit.force_close_dte).toBe(1)
  })

  it('sends a point target under NEAREST_DELTA and no band', () => {
    const body = toBacktestRequest(findPreset('long-put-nearest-delta')!, INPUT)
    expect(body.params.entry.selection).toBe('NEAREST_DELTA')
    expect(body.params.entry.target_delta).toBe('0.3')
    expect(body.params.entry.target_delta_range).toBeNull()
    expect(body.params.entry.option_type).toBe('PUT')
  })

  it('normalises symbols and never asks for the autonomous universe rule', () => {
    const body = toBacktestRequest(findPreset('long-call-delta-band')!, INPUT)
    expect(body.symbols).toEqual(['SPY', 'AAPL'])
    // Explicit research over any symbol is allowed by design (§10); asking for
    // `autonomous` would 422 every symbol outside plt's ActiveUniverse.
    expect(body.autonomous).toBe(false)
    expect(body.fill_protocol).toBe('two_quote_band')
  })
})

describe('backtest result — §19 evidence', () => {
  const view = toBacktestResultView(RESULT)

  it('parses decimal strings and keeps nulls missing rather than zero', () => {
    expect(view.metrics.totalPnl).toBe(119.7)
    expect(view.metrics.winRate).toBe(0.5)
    // `sharpe_ratio` is null with a reason; a 0 here would read as "no edge".
    expect(view.metrics.sharpeRatio).toBeUndefined()
    expect(view.metrics.sharpeNote).toBe('fewer than 20 trades')
    expect(view.metrics.drawdownBasis).toBe('marked-equity')
  })

  it('renders a thin bucket as withheld statistics, never as zero (§19.4)', () => {
    const unknown = view.buckets.byDelta.find((row) => row.key === 'unknown')
    expect(unknown).toBeDefined()
    expect(unknown!.tradeCount).toBe(1)
    expect(unknown!.winRate).toBeUndefined()
    expect(unknown!.avgPnl).toBeUndefined()
    expect(unknown!.totalPnl).toBeUndefined()
    expect(unknown!.insufficient).toBe(true)
    expect(unknown!.note).toMatch(/fewer than 5 trades/)
  })

  it('keeps `unknown` as a real delta bucket rather than dropping the trade', () => {
    expect(view.buckets.byDelta.map((row) => row.key)).toContain('unknown')
    expect(view.buckets.byTicker.map((row) => row.key)).toEqual(['AAPL', 'SPY'])
    expect(view.buckets.byExitReason.map((row) => row.key)).toEqual([
      'PROFIT_TARGET',
      'STOP_LOSS',
    ])
  })

  it('reads the execution block, refusals by reason and the pending count', () => {
    expect(view.execution?.fillProtocol).toBe('two_quote_band')
    expect(view.execution?.entriesAttempted).toBe(4)
    expect(view.execution?.entriesFilled).toBe(2)
    expect(view.execution?.noFillRate).toBe(0.5)
    expect(view.execution?.noFillByReason).toEqual([
      { reason: 'CONTRACT_NOT_QUOTED', count: 1 },
      { reason: 'ENTRY_PRICE_ABOVE_BAND', count: 1 },
    ])
    // Not a refusal: the window ended (§19.1).
    expect(view.pendingEntriesAtWindowEnd).toBe(2)
  })

  it('keeps per-trade artifacts and never re-derives a P/L bkt did not send', () => {
    const [aapl, spy] = view.trades
    expect(aapl.entryDelta).toBe(0.42)
    expect(aapl.fillMinusMid).toBe(0.05)
    expect(aapl.excess).toBe(-0.05)
    expect(aapl.mfe).toBe(310)
    expect(aapl.sessionsToMfe).toBe(3)
    // No greeks for this contract: missing stays missing, and the trade
    // buckets under `unknown` rather than under a fabricated 0.00 delta.
    expect(spy.entryDelta).toBeUndefined()
    expect(spy.exitReason).toBe('STOP_LOSS')
    // `pnl`/`capture_ratio`/`holding_days` are Python properties and never
    // cross the wire; nothing in the view model claims to have them.
    expect(Object.keys(aapl)).not.toContain('pnl')
    expect(Object.keys(aapl)).not.toContain('captureRatio')
  })

  it('carries the no-fill events with their reason codes verbatim', () => {
    expect(view.noFillEvents.map((event) => event.reason)).toEqual([
      'ENTRY_PRICE_ABOVE_BAND',
      'CONTRACT_NOT_QUOTED',
    ])
    const [band, notQuoted] = view.noFillEvents
    expect(band.excess).toBe(0.4)
    // Nothing to compare against: absent, not zero.
    expect(notQuoted.fillPrice).toBeUndefined()
    expect(notQuoted.bandMax).toBeUndefined()
  })

  it('flattens metrics.v2 with its lineage, and the baselines', () => {
    expect(view.returns?.sharpeAnnualized).toBe(0.41)
    expect(view.returns?.sharpeBasis).toBe('daily-marked-returns')
    expect(view.returns?.nDays).toBe(124)
    expect(view.baselines?.noTradeTotalPnl).toBe(0)
    expect(view.baselines?.randomEntry?.strategyTotalPnlPercentile).toBe(0.72)
  })

  it('discloses the protocol and is not marked legacy', () => {
    expect(view.legacy).toBe(false)
    expect(view.disclosures.fillProtocol).toBe('two_quote_band')
    expect(view.disclosures.entryGate).toBeUndefined()
    expect(view.disclosures.gateParamsUnevaluated).toBeUndefined()
  })
})

describe('graceful absence — a pre-§19 run', () => {
  const view = toBacktestResultView(BACKTEST_LEGACY_FIXTURE.result as BktBacktestResult)

  it('marks a single_quote_legacy run as legacy', () => {
    expect(view.legacy).toBe(true)
    expect(view.disclosures.fillProtocol).toBe('single_quote_legacy')
  })

  it('reports the §19.4 buckets as unavailable rather than empty', () => {
    expect(view.bucketsUnavailable).toBe(true)
    expect(view.buckets.byDelta).toEqual([])
    expect(view.execution).toBeUndefined()
  })

  it('does not invent metrics the run never carried', () => {
    expect(view.metrics.tradeCount).toBe(0)
    expect(view.metrics.winRate).toBeUndefined()
    expect(view.metrics.maxDrawdownMarked).toBeUndefined()
    expect(view.metrics.drawdownBasis).toBe('realized-equity')
    expect(view.returns).toBeUndefined()
    expect(view.baselines).toBeUndefined()
  })

  it('treats a result with no fill_protocol at all as legacy, not as two-quote', () => {
    // bkt's model defaults the field to `single_quote_legacy`, so an absent
    // value means "not two-quote" — never "unknown, assume the good one".
    const view = toBacktestResultView({ metrics: {} })
    expect(view.legacy).toBe(true)
    expect(view.disclosures.fillProtocol).toMatch(/unstated/)
  })

  it('passes an entry gate and a gate-params clause through verbatim', () => {
    // Neither is emitted by a backtest run today (§20 / §19.6). When one is,
    // it renders as the backend stated it — including a gate named "TAPE".
    const view = toBacktestResultView({
      fill_protocol: 'two_quote_band',
      entry_gate: 'TAPE',
      gate_params_unevaluated: ['signal_weights', 'min_edge'],
      metrics: {},
    })
    expect(view.disclosures.entryGate).toBe('TAPE')
    expect(view.disclosures.gateParamsUnevaluated).toEqual(['signal_weights', 'min_edge'])
  })
})

describe('the pooled trade-quality block (§19.4)', () => {
  it('is absent unless the result states one — never computed here', () => {
    expect(toBacktestResultView(RESULT).tradeQuality).toBeUndefined()
  })

  it('carries bkt’s medians, its notes and the excluded count verbatim', () => {
    const view = toBacktestResultView({
      fill_protocol: 'two_quote_band',
      metrics: {
        trade_quality: {
          trade_count: 12,
          median_capture: null,
          capture_note: 'no closed trade had a positive MFE: there was no run-up to capture',
          capture_excluded_non_positive_mfe: 12,
          median_mfe: '0',
          median_mae: '-85.5',
          median_fill_minus_mid: '0.05',
          fill_minus_mid_note: null,
          no_fill_count: 3,
          no_fill_rate: '0.2',
          no_fill_by_reason: { ENTRY_PRICE_ABOVE_BAND: 3 },
        },
      },
    })
    // The median is withheld with a reason; a 0.00 in its place would be a
    // different finding entirely.
    expect(view.tradeQuality?.medianCapture).toBeUndefined()
    expect(view.tradeQuality?.captureNote).toMatch(/no run-up to capture/)
    // Excluded trades are counted, not folded in as zero.
    expect(view.tradeQuality?.captureExcludedNonPositiveMfe).toBe(12)
    expect(view.tradeQuality?.medianMae).toBe(-85.5)
    expect(view.tradeQuality?.noFillByReason).toEqual([
      { reason: 'ENTRY_PRICE_ABOVE_BAND', count: 3 },
    ])
  })
})

describe('bucket rows', () => {
  it('does not treat a reported zero as a withheld statistic', () => {
    const row = toBucketRow('0.00-0.15', {
      trade_count: 6,
      total_pnl: '0',
      win_rate: '0',
      avg_pnl: '0',
      note: null,
    })
    // A measured 0% win rate over six trades is a finding; it must not be
    // suppressed by the same rule that hides a thin bucket's ratios.
    expect(row.insufficient).toBe(false)
    expect(row.winRate).toBe(0)
    expect(row.note).toBeUndefined()
  })
})
