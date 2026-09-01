import { describe, expect, it } from 'vitest'
import {
  formatCompact,
  formatConfidence,
  formatHorizon,
  formatMoney,
  formatQty,
  formatRange,
  formatSignedMoney,
  formatSignedPercent,
} from '@/lib/format'

describe('money formatting', () => {
  it('formats currency with two decimals by default', () => {
    expect(formatMoney(1234.5)).toBe('$1,234.50')
  })

  it('drops decimals when asked for whole dollars', () => {
    expect(formatMoney(1234.5, { whole: true })).toBe('$1,235')
  })

  it('uses an explicit sign, and a true minus glyph for losses', () => {
    expect(formatSignedMoney(120.4)).toBe('+$120.40')
    expect(formatSignedMoney(-120.4)).toBe('−$120.40')
  })

  it('signs percentages the same way', () => {
    expect(formatSignedPercent(2.345)).toBe('+2.35%')
    expect(formatSignedPercent(-2.345)).toBe('−2.35%')
  })

  it('compacts large values', () => {
    expect(formatCompact(2_400_000)).toBe('$2.40M')
    expect(formatCompact(48_500)).toBe('$48.5K')
  })

  it('renders a target band', () => {
    expect(formatRange(198, 214)).toBe('$198.00 – $214.00')
  })

  it('keeps whole share counts clean', () => {
    expect(formatQty(68)).toBe('68')
  })
})

describe('formatConfidence — the single render-time ×100 (§7.4)', () => {
  it('renders a 0..1 wire fraction as a percentage', () => {
    expect(formatConfidence(0.72)).toBe('72%')
    expect(formatConfidence(0.725, 1)).toBe('72.5%')
    expect(formatConfidence(0)).toBe('0%')
    expect(formatConfidence(1)).toBe('100%')
  })

  it('clamps a provider that ever sends percent points, rather than printing 7200%', () => {
    expect(formatConfidence(72)).toBe('100%')
    expect(formatConfidence(-1)).toBe('0%')
  })
})

describe('formatHorizon', () => {
  it('renders ISO-8601 durations', () => {
    expect(formatHorizon('P14D')).toBe('14 days')
    expect(formatHorizon('P1D')).toBe('1 day')
    expect(formatHorizon('P2W')).toBe('2 weeks')
    expect(formatHorizon('P1Y2M')).toBe('1 year 2 months')
  })

  it('echoes anything it cannot parse verbatim — the field is free text server-side', () => {
    expect(formatHorizon('Across next 2 earnings')).toBe('Across next 2 earnings')
    expect(formatHorizon('P')).toBe('P')
  })
})
