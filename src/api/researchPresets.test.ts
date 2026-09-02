import { describe, expect, it } from 'vitest'
import {
  BACKTEST_LIMITS,
  BACKTEST_PRESETS,
  backtestRequestRefusal,
  windowDays,
} from '@/api/researchPresets'
import { toBacktestRequest } from '@/api/http/adapters/backtest'

const WINDOW = { symbols: ['SPY'], start: '2024-01-02', end: '2024-06-28', initialCapital: 100_000 }

describe('the pruned strategy library (HKP-BKT-3)', () => {
  it('offers only presets bkt’s V1 universe can express', () => {
    expect(BACKTEST_PRESETS.length).toBeGreaterThan(0)
    for (const preset of BACKTEST_PRESETS) {
      // Long single-leg CALL/PUT, DTE >= 1 — enforced twice server-side, and a
      // request outside it is rejected before an engine runs.
      expect(['CALL', 'PUT']).toContain(preset.right)
      expect(preset.quantity).toBeGreaterThan(0)
      expect(preset.minDte).toBeGreaterThanOrEqual(1)
      expect(preset.maxDte).toBeGreaterThanOrEqual(preset.minDte)
    }
  })

  it('drops every short, spread and equity study the old library carried', () => {
    const ids = BACKTEST_PRESETS.map((preset) => preset.id)
    for (const gone of [
      'covered-call',
      'put-write',
      'iron-condor-45',
      'vrp-straddle',
      'tsmom',
      'xs-momentum',
      'rsi2-reversion',
      'sma-cross',
      'pead',
      'collar',
    ]) {
      expect(ids).not.toContain(gone)
    }
  })

  it('satisfies the symmetric mode/parameter rule bkt enforces as a 422 (§19.2)', () => {
    for (const preset of BACKTEST_PRESETS) {
      if (preset.selection === 'DELTA_BAND') {
        expect(preset.targetDeltaRange).toBeDefined()
        const [low, high] = preset.targetDeltaRange!
        expect(low).toBeGreaterThanOrEqual(0)
        expect(high).toBeLessThanOrEqual(1)
        expect(low).toBeLessThanOrEqual(high)
        // Stated, not assumed: 0 is a fine floor, an absent one is not.
        expect(typeof preset.minContractOi).toBe('number')
        // A band states no point target.
        expect(preset.targetDelta).toBeUndefined()
        expect(preset.fidelity).toBe('strategy-faithful')
      }
      if (preset.selection === 'NEAREST_DELTA') {
        expect(preset.targetDelta).toBeGreaterThan(0)
        expect(preset.targetDeltaRange).toBeUndefined()
        // NEAREST_DELTA is the baseline mode, and is labelled as one.
        expect(preset.fidelity).toBe('baseline')
      }
    }
  })

  it('produces a body bkt would accept for every preset', () => {
    for (const preset of BACKTEST_PRESETS) {
      const entry = toBacktestRequest(preset, { ...WINDOW, presetId: preset.id }).params.entry
      const bandOk = entry.selection !== 'DELTA_BAND' || entry.target_delta_range !== null
      const pointOk = entry.selection !== 'NEAREST_DELTA' || entry.target_delta !== null
      expect(bandOk && pointOk).toBe(true)
    }
  })
})

describe('bounded-execution caps, mirrored from backtest/service.py', () => {
  it('counts the window inclusively, exactly as validate_request does', () => {
    expect(windowDays('2024-01-01', '2024-01-01')).toBe(1)
    expect(windowDays('2024-01-01', '2024-01-31')).toBe(31)
    expect(windowDays('nonsense', '2024-01-31')).toBeUndefined()
  })

  it('refuses what bkt would refuse, and names the cap', () => {
    expect(backtestRequestRefusal({ symbols: [], start: '2024-01-01', end: '2024-02-01' })).toMatch(
      /at least one symbol/,
    )
    expect(
      backtestRequestRefusal({ symbols: ['SPY'], start: '2024-03-01', end: '2024-01-01' }),
    ).toMatch(/on or after start/)
    expect(
      backtestRequestRefusal({ symbols: ['SPY'], start: '2023-01-01', end: '2024-12-31' }),
    ).toMatch(/WINDOW_TOO_LONG/)
    expect(
      backtestRequestRefusal({
        symbols: Array.from({ length: 10 }, (_, i) => `S${i}`),
        start: '2024-01-01',
        end: '2024-12-01',
      }),
    ).toMatch(/SYMBOL_DAY_LIMIT_EXCEEDED/)
    expect(
      backtestRequestRefusal({ symbols: ['SPY', 'AAPL'], start: '2024-01-02', end: '2024-06-28' }),
    ).toBeUndefined()
  })

  it('states the caps the service actually applies', () => {
    expect(BACKTEST_LIMITS).toEqual({ maxSymbols: 25, maxWindowDays: 400, maxSymbolDays: 2500 })
  })
})
