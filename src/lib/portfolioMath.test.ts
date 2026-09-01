import { describe, expect, it } from 'vitest'
import { computeTotals, valuePosition } from '@/lib/portfolioMath'
import type { PriceMap } from '@/api/marketData/MarketDataSimulator'
import type { AIAssessment, Position } from '@/api/types'

const ai: AIAssessment = {
  conviction: 80,
  convictionDelta: 2,
  recommendation: 'HOLD',
  upsideTarget: 120,
  downsideRisk: 80,
  riskRewardRatio: 2,
  horizon: '12 months',
  targetLow: 110,
  targetHigh: 120,
  thesis: [],
  recommendationNote: '',
  updatedAt: new Date().toISOString(),
}

const stock: Position = {
  id: 'p1',
  symbol: 'AAA',
  company: 'Alpha',
  assetType: 'stock',
  brokerageId: 'robinhood',
  quantity: 10,
  avgCost: 90,
  openedAt: new Date().toISOString(),
  ai,
}

const option: Position = {
  ...stock,
  id: 'p2',
  symbol: 'BBB',
  assetType: 'option',
  quantity: 2,
  avgCost: 5,
}

const prices: PriceMap = {
  AAA: {
    symbol: 'AAA',
    price: 100,
    previousClose: 95,
    open: 96,
    dayChange: 5,
    dayChangePct: 5.263,
    history: [95, 100],
  },
  BBB: {
    symbol: 'BBB',
    price: 60,
    previousClose: 50,
    open: 50,
    dayChange: 10,
    dayChangePct: 20,
    history: [50, 60],
  },
}

describe('position valuation', () => {
  it('values a stock against its previous close', () => {
    const v = valuePosition(stock, prices)
    expect(v.marketValue).toBe(1000)
    expect(v.costBasis).toBe(900)
    expect(v.totalReturn).toBe(100)
    expect(v.dayPl).toBeCloseTo(50, 6)
  })

  it('applies the 100x contract multiplier to options', () => {
    const v = valuePosition(option, prices)
    expect(v.multiplier).toBe(100)
    // 20% underlying move at ~4.5x leverage → contract price well above avg cost.
    expect(v.price).toBeGreaterThan(option.avgCost)
    expect(v.costBasis).toBe(option.avgCost * option.quantity * 100)
  })
})

describe('portfolio totals', () => {
  it('reports the largest holding as the concentration figure', () => {
    const totals = computeTotals([stock, option], prices)
    expect(totals.marketValue).toBeGreaterThan(0)
    expect(totals.topWeightPct).toBeGreaterThan(0)
    expect(totals.topWeightPct).toBeLessThanOrEqual(100)
    expect(['AAA', 'BBB']).toContain(totals.topWeightSymbol)
  })

  it('weights conviction by market value', () => {
    const totals = computeTotals([stock], prices)
    expect(totals.weightedConviction).toBeCloseTo(80, 6)
  })

  it('handles an empty portfolio without dividing by zero', () => {
    const totals = computeTotals([], {})
    expect(totals.marketValue).toBe(0)
    expect(totals.dayPlPct).toBe(0)
    expect(totals.totalReturnPct).toBe(0)
    // Undefined, not 0: an empty book has no conviction to average, and a 0
    // would render as "the model has no conviction in your holdings".
    expect(totals.weightedConviction).toBeUndefined()
  })
})
