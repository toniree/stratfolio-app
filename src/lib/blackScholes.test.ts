import { describe, expect, it } from 'vitest'
import {
  blackScholes,
  normalCdf,
  probabilityBeyond,
  probabilityTouch,
  realisedVolatility,
} from '@/lib/blackScholes'

describe('normalCdf', () => {
  it('matches known values of the standard normal', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6)
    expect(normalCdf(1)).toBeCloseTo(0.8413447, 5)
    expect(normalCdf(-1)).toBeCloseTo(0.1586553, 5)
    expect(normalCdf(1.96)).toBeCloseTo(0.9750021, 5)
  })
})

describe('blackScholes', () => {
  // Textbook reference: S=100, K=100, T=1, σ=20%, r=5% → call ≈ 10.4506.
  const base = { spot: 100, strike: 100, years: 1, volatility: 0.2, rate: 0.05 } as const

  it('prices an at-the-money call to the textbook value', () => {
    expect(blackScholes({ ...base, right: 'CALL' }).price).toBeCloseTo(10.4506, 3)
  })

  it('prices the matching put and honours put–call parity', () => {
    const call = blackScholes({ ...base, right: 'CALL' }).price
    const put = blackScholes({ ...base, right: 'PUT' }).price
    // C − P = S − K·e^(−rT)
    expect(call - put).toBeCloseTo(100 - 100 * Math.exp(-0.05), 6)
  })

  it('reports greeks with the expected signs and ranges', () => {
    const call = blackScholes({ ...base, right: 'CALL' })
    const put = blackScholes({ ...base, right: 'PUT' })

    expect(call.delta).toBeGreaterThan(0)
    expect(call.delta).toBeLessThan(1)
    expect(put.delta).toBeLessThan(0)
    expect(call.gamma).toBeGreaterThan(0)
    expect(call.vega).toBeGreaterThan(0)
    // Long premium bleeds: theta is negative per day for a long call.
    expect(call.theta).toBeLessThan(0)
  })

  it('collapses to intrinsic at expiry without dividing by zero', () => {
    const expired = blackScholes({ ...base, years: 0, spot: 120, right: 'CALL' })
    expect(expired.price).toBe(20)
    expect(expired.delta).toBe(1)
    expect(expired.gamma).toBe(0)
    expect(Number.isFinite(expired.theta)).toBe(true)
  })

  it('raises probability of finishing in the money as the strike falls', () => {
    const near = blackScholes({ ...base, strike: 90, right: 'CALL' }).probabilityItm
    const far = blackScholes({ ...base, strike: 130, right: 'CALL' }).probabilityItm
    expect(near).toBeGreaterThan(far)
    expect(far).toBeGreaterThan(0)
  })
})

describe('probability helpers', () => {
  it('treats touching a barrier as roughly twice as likely as finishing beyond it', () => {
    const args = {
      spot: 100,
      barrier: 115,
      years: 0.5,
      volatility: 0.3,
      right: 'CALL' as const,
    }
    const finish = probabilityBeyond(args)
    expect(probabilityTouch(args)).toBeCloseTo(finish * 2, 6)
  })

  it('never reports a probability above one', () => {
    expect(
      probabilityTouch({
        spot: 100,
        barrier: 80,
        years: 1,
        volatility: 0.4,
        right: 'CALL',
      }),
    ).toBe(1)
  })
})

describe('realisedVolatility', () => {
  it('returns zero for a series too short to measure', () => {
    expect(realisedVolatility([100, 101])).toBe(0)
  })

  it('reports a flat series as zero vol and a choppy one as higher', () => {
    const flat = realisedVolatility([100, 100, 100, 100, 100])
    const choppy = realisedVolatility([100, 105, 98, 107, 96, 110])
    expect(flat).toBeCloseTo(0, 6)
    expect(choppy).toBeGreaterThan(flat)
  })
})
