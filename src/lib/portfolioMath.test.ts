import { describe, expect, it } from 'vitest'
import { computeTotals, valuePosition } from '@/lib/portfolioMath'
import { optionMarkKey } from '@/api/http/adapters/market'
import type { OptionMarkMap, PriceMap } from '@/api/marketData/types'
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

/** A seeded demo contract: `extrinsicBase` is what lets the in-browser model
 *  price it at all. A live contract never has one. */
const option: Position = {
  ...stock,
  id: 'p2',
  symbol: 'BBB',
  assetType: 'option',
  quantity: 2,
  avgCost: 5,
  option: {
    right: 'CALL',
    strike: 55,
    expiry: '2026-12-18',
    expiryLabel: "Dec 18 '26",
    extrinsicBase: 3,
  },
  provenance: 'mock',
}

/** The same contract as plt sends it: no model terms, no mark of its own. */
const liveOption: Position = {
  ...option,
  id: 'p3',
  option: {
    right: 'CALL',
    strike: 55,
    expiry: '2026-12-18',
    expiryLabel: "Dec 18 '26",
  },
  provenance: 'live',
}

const SERVER_MARKS: OptionMarkMap = {
  [optionMarkKey({ symbol: 'BBB', right: 'CALL', strike: 55, expiry: '2026-12-18' })]: {
    key: optionMarkKey({ symbol: 'BBB', right: 'CALL', strike: 55, expiry: '2026-12-18' }),
    occSymbol: 'BBB261218C00055000',
    mid: 9.4,
    bid: 9.3,
    ask: 9.5,
    provenance: 'replay',
  },
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
    // Spot 60 vs a 55 strike: intrinsic 5 plus the demo model's extrinsic.
    expect(v.price).toBeGreaterThan(option.avgCost)
    expect(v.costBasis).toBe(option.avgCost * option.quantity * 100)
  })
})

describe('mark preference (APP-108)', () => {
  it('prefers a server chain mid over the in-browser model', () => {
    const modelled = valuePosition(option, prices)
    const marked = valuePosition(option, prices, SERVER_MARKS)

    expect(marked.markSource).toBe('server-chain')
    expect(marked.price).toBe(9.4)
    // The model would have produced something else entirely; the server wins.
    expect(marked.price).not.toBeCloseTo(modelled.price, 6)
    // Real mark → real unrealized P&L: (9.40 − 5.00) × 2 × 100.
    expect(marked.totalReturn).toBeCloseTo(880, 6)
    // The position record's own claim still applies: a demo-book row marked
    // from a real chain is still a demo row, and the weaker claim wins.
    expect(marked.provenance).toBe('mock')
    // A live plt position marked from the replay chain is a replay valuation.
    expect(valuePosition(liveOption, prices, SERVER_MARKS).provenance).toBe('replay')
  })

  it('reports the day change as unavailable under a server mark, not as zero', () => {
    const marked = valuePosition(option, prices, SERVER_MARKS)
    // A chain quotes *now*; the V1 facade exposes no historical chain, so
    // there is no prior mark. 0.00% would read as "unchanged".
    expect(marked.dayChangeBasis).toBe('unavailable')
    expect(marked.dayChange).toBe(0)
  })

  it('ignores a zero mid — an unquoted contract is not a mark of zero', () => {
    const key = optionMarkKey({ symbol: 'BBB', right: 'CALL', strike: 55, expiry: '2026-12-18' })
    const v = valuePosition(option, prices, {
      [key]: { ...SERVER_MARKS[key], mid: 0 },
    })
    expect(v.markSource).toBe('model')
  })

  it('does not cross-mark a different strike or expiry', () => {
    const v = valuePosition(
      { ...option, option: { ...option.option!, strike: 60 } },
      prices,
      SERVER_MARKS,
    )
    expect(v.markSource).toBe('model')
  })

  it('holds a live contract at entry when nothing quotes it, labelled synthetic', () => {
    // No model terms and no server mark: the honest answer is a flat, obviously
    // unmarked position — never an invented premium.
    const v = valuePosition(liveOption, {}, {})
    expect(v.markSource).toBe('entry')
    expect(v.price).toBe(liveOption.avgCost)
    expect(v.totalReturn).toBe(0)
    expect(v.provenance).toBe('synthetic')
    expect(v.dayChangeBasis).toBe('unavailable')
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

  it('withholds the book day P&L when any holding has no prior mark', () => {
    const totals = computeTotals([stock, option], prices, SERVER_MARKS)
    // The stock has a real day change; the marked option does not. A sum of
    // the two would be a partial number wearing a whole one's clothes.
    expect(totals.dayPlAvailable).toBe(false)
    expect(computeTotals([stock], prices).dayPlAvailable).toBe(true)
  })

  it('reports whether the whole book is marked from real quotes', () => {
    expect(computeTotals([option], prices).fullyMarked).toBe(false)
    expect(computeTotals([option], prices, SERVER_MARKS).fullyMarked).toBe(true)
    // One unmarked holding drags the book's claim down to synthetic.
    expect(computeTotals([option, liveOption], prices, SERVER_MARKS).provenance).toBe('mock')
  })
})
