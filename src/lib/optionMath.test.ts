import { describe, expect, it } from 'vitest'
import { estimateOptionExit } from '@/lib/optionMath'

describe('option exit estimates', () => {
  it('applies the 100-share multiplier across the full contract quantity', () => {
    const estimate = estimateOptionExit(8.4, 19, 26, 18)

    expect(estimate).toMatchObject({
      exitLow: 19,
      exitHigh: 26,
      profitLow: 19_080,
      profitHigh: 31_680,
    })
    expect(estimate.returnLowPct).toBeCloseTo(126.19, 2)
    expect(estimate.returnHighPct).toBeCloseTo(209.52, 2)
  })

  it('normalizes a reversed exit range and avoids division by zero', () => {
    expect(estimateOptionExit(0, 12, 8, 2)).toEqual({
      exitLow: 8,
      exitHigh: 12,
      profitLow: 1_600,
      profitHigh: 2_400,
      returnLowPct: 0,
      returnHighPct: 0,
    })
  })
})
