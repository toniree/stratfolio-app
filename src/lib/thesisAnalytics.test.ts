import { describe, expect, it } from 'vitest'
import type { Idea } from '@/api/types'
import { thesisAnalytics } from '@/lib/thesisAnalytics'

const callIdea = {
  id: 'idea-nvda-call',
  symbol: 'NVDA',
  company: 'NVIDIA',
  assetType: 'option',
  categories: ['options'],
  forYou: true,
  referencePrice: 140,
  entryLow: 8,
  entryHigh: 10,
  targetLow: 20,
  targetHigh: 24,
  expectedUpsidePct: 120,
  catalysts: ['Committed supply.'],
  risks: ['Crowded.'],
  tags: [],
  option: {
    right: 'CALL',
    strike: 150,
    expiry: '2027-01-15',
    expiryLabel: "Jan 15 '27",
    extrinsicBase: 9,
  },
  ai: {
    conviction: 88,
    convictionDelta: 4,
    recommendation: 'BUY',
    recommendationNote: 'Scale in.',
    horizon: 'Three months',
    upsideTarget: 24,
    downsideRisk: 0,
    riskRewardRatio: 2.4,
    targetLow: 20,
    targetHigh: 24,
    thesis: ['Supply is committed.'],
    updatedAt: '2026-08-08T00:00:00.000Z',
  },
} satisfies Idea

const history = Array.from({ length: 60 }, (_, i) => 130 + Math.sin(i / 4) * 8 + i * 0.15)

describe('thesisAnalytics for an option thesis', () => {
  const a = thesisAnalytics(callIdea, 142, history)

  it('derives break-even from the strike plus the debit paid', () => {
    // Debit is the midpoint of the 8–10 entry band.
    expect(a.debit).toBe(9)
    expect(a.breakeven).toBe(159)
  })

  it('states the move required to break even against the move being priced', () => {
    expect(a.requiredMovePct).toBeCloseTo(((159 - 142) / 142) * 100, 6)
    expect(a.expectedMovePct).toBeGreaterThan(0)
    expect(a.cushion).toBeCloseTo(a.expectedMovePct / a.requiredMovePct, 6)
  })

  it('keeps probabilities inside their bounds and ranks touch above finish', () => {
    expect(a.pop).toBeGreaterThan(0)
    expect(a.pop).toBeLessThan(100)
    expect(a.probTouchTarget).toBeGreaterThan(0)
    expect(a.probTouchTarget).toBeLessThanOrEqual(100)
    expect(a.ivRank).toBeGreaterThan(0)
    expect(a.ivRank).toBeLessThan(100)
  })

  it('computes reward-to-risk and sizing from the debit', () => {
    // Target midpoint is 22 against a debit of 9 → 1.44R.
    expect(a.rMultiple).toBeCloseTo((22 - 9) / 9, 6)
    expect(a.contracts).toBe(3)
    expect(a.netDebit).toBe(9 * 100 * 3)
    expect(a.maxLoss).toBe(a.netDebit)
    expect(a.targetProfit).toBe(22 * 100 * 3 - a.netDebit)
  })

  it('bleeds theta and reports it as a share of the debit', () => {
    expect(a.theta).toBeLessThan(0)
    expect(a.thetaPctOfDebit).toBeGreaterThan(0)
  })

  it('expresses the model as an edge against the entry debit', () => {
    expect(a.modelValue).toBeGreaterThan(0)
    const expected = (a.modelValue / 9 - 1) * 100
    expect(a.modelEdgePct).toBeCloseTo(expected, 6)
  })

  it('carries a long-call delta between zero and one', () => {
    expect(a.delta).toBeGreaterThan(0)
    expect(a.delta).toBeLessThan(1)
  })
})

describe('thesisAnalytics for an equity thesis', () => {
  const equityIdea = {
    ...callIdea,
    id: 'idea-nvda-shares',
    assetType: 'stock',
    option: undefined,
    entryLow: 138,
    entryHigh: 142,
    targetLow: 168,
    targetHigh: 176,
    ai: { ...callIdea.ai, downsideRisk: 126 },
  } satisfies Idea

  it('falls back to entry-versus-stop economics with no greeks', () => {
    const a = thesisAnalytics(equityIdea, 142, history)
    expect(a.kind).toBe('equity')
    expect(a.breakeven).toBe(140)
    expect(a.delta).toBe(1)
    expect(a.theta).toBe(0)
    // Reward 32 over risk 14 → a shade above 2R.
    expect(a.rMultiple).toBeCloseTo((172 - 140) / (140 - 126), 6)
  })
})

describe('thesisAnalytics determinism', () => {
  it('returns identical figures for identical inputs', () => {
    const first = thesisAnalytics(callIdea, 142, history)
    const second = thesisAnalytics(callIdea, 142, history)
    expect(first).toEqual(second)
  })
})
