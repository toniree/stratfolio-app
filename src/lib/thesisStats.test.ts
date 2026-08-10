import { describe, expect, it } from 'vitest'
import type { ThesisAnalytics } from '@/lib/thesisAnalytics'
import {
  DEFAULT_THESIS_STATS,
  THESIS_STAT_LIMIT,
  THESIS_STAT_OPTIONS,
  thesisStatLine,
  type ThesisStatField,
} from '@/lib/thesisStats'

const analytics: ThesisAnalytics = {
  kind: 'option',
  spot: 142,
  daysToExpiry: 158,
  years: 158 / 365,
  iv: 34,
  hv: 41,
  ivPremiumPct: -17,
  ivRank: 18,
  expectedMovePct: 11.4,
  requiredMovePct: 8.2,
  cushion: 1.39,
  pop: 41,
  probTouchTarget: 62,
  breakeven: 159,
  debit: 9,
  targetPremium: 22,
  contracts: 3,
  netDebit: 2700,
  maxLoss: 2700,
  targetValue: 6600,
  targetProfit: 3900,
  rMultiple: 2.4,
  expectedValue: 1206,
  delta: 0.52,
  gamma: 0.007,
  vega: 0.31,
  theta: -4.2,
  thetaPctOfDebit: 0.47,
  modelValue: 9.4,
  modelEdgePct: 4.4,
  spreadPct: 1.5,
  openInterest: 12400,
  volume: 3100,
}

describe('thesis stat catalogue', () => {
  it('gives every field a rail label, a name and an explanation', () => {
    for (const option of THESIS_STAT_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(0)
      expect(option.name.length).toBeGreaterThan(0)
      // Explanations carry a decision, so they are never one-liners.
      expect(option.detail.length).toBeGreaterThan(80)
    }
  })

  it('has no duplicate ids or rail labels', () => {
    const ids = THESIS_STAT_OPTIONS.map((option) => option.id)
    const labels = THESIS_STAT_OPTIONS.map((option) => option.label)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('ships a default selection that fits the rail', () => {
    expect(DEFAULT_THESIS_STATS.length).toBeLessThanOrEqual(THESIS_STAT_LIMIT)
    for (const id of DEFAULT_THESIS_STATS) {
      expect(THESIS_STAT_OPTIONS.some((option) => option.id === id)).toBe(true)
    }
  })

  it('formats every field without throwing or emitting NaN', () => {
    for (const option of THESIS_STAT_OPTIONS) {
      const line = thesisStatLine(option.id, analytics)
      expect(line.label).toBe(option.label)
      expect(line.value).not.toMatch(/NaN|Infinity|undefined/)
      expect(line.value.length).toBeGreaterThan(0)
    }
  })

  it('reads cheap premium and a paying structure as favourable', () => {
    expect(thesisStatLine('ivRank', analytics).tone).toBe('up')
    expect(thesisStatLine('ivHv', analytics).tone).toBe('up')
    expect(thesisStatLine('model', analytics).tone).toBe('up')
    expect(thesisStatLine('rr', analytics).tone).toBe('up')
    expect(thesisStatLine('cushion', analytics).tone).toBe('up')
  })

  it('flags rich premium, a heavy burn and a wide market', () => {
    const hostile: ThesisAnalytics = {
      ...analytics,
      ivRank: 82,
      ivPremiumPct: 24,
      modelEdgePct: -6,
      thetaPctOfDebit: 1.8,
      spreadPct: 9,
      cushion: 0.6,
    }
    expect(thesisStatLine('ivRank', hostile).tone).toBe('down')
    expect(thesisStatLine('ivHv', hostile).tone).toBe('down')
    expect(thesisStatLine('model', hostile).tone).toBe('down')
    expect(thesisStatLine('thetaBurn', hostile).tone).toBe('down')
    expect(thesisStatLine('spread', hostile).tone).toBe('down')
    expect(thesisStatLine('cushion', hostile).tone).toBe('down')
  })

  it('states theta as a daily loss and leverage as a multiple of premium', () => {
    expect(thesisStatLine('theta', analytics).value).toBe('−$4.20')
    // 0.52 delta × $142 × 100 controlled against a $900 debit.
    expect(thesisStatLine('leverage', analytics).value).toBe('8.2×')
  })

  it('compacts large counts and dollar values', () => {
    expect(thesisStatLine('openInterest', analytics).value).toBe('12.4K')
    expect(thesisStatLine('ev', analytics).value).toBe('+$1.2K')
  })

  it('covers every declared field id', () => {
    const declared: ThesisStatField[] = THESIS_STAT_OPTIONS.map((option) => option.id)
    expect(declared).toHaveLength(20)
  })
})
