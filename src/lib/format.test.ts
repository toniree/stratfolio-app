import { describe, expect, it } from 'vitest'
import {
  formatCompact,
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
