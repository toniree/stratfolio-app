import { describe, expect, it } from 'vitest'
import { plannerInputFromPrompt } from '@/lib/plannerPrompt'

describe('plannerInputFromPrompt', () => {
  it('organizes the Planner composer example into reviewable fields', () => {
    const input = plannerInputFromPrompt(
      '5000 on SNDK earnings run-up, sell when doubles',
    )

    expect(input).toMatchObject({
      symbol: 'SNDK',
      intent: 'open',
      maxAmount: 5000,
      horizon: 'Through the next earnings catalyst',
      originalPrompt: '5000 on SNDK earnings run-up, sell when doubles',
    })
    expect((input?.targetLow ?? 0) / ((input?.entryLow ?? 1))).toBeGreaterThan(1.8)
  })

  it('requires a known ticker', () => {
    expect(plannerInputFromPrompt('buy something good before earnings')).toBeUndefined()
  })

  it('uses a bare number above 30 as the plan amount', () => {
    expect(plannerInputFromPrompt('Put 750 on NVDA for the next catalyst')?.maxAmount).toBe(750)
  })

  it('keeps the default amount for bare numbers at or below 30', () => {
    expect(plannerInputFromPrompt('Put 30 on NVDA for the next catalyst')?.maxAmount).toBe(1000)
  })
})
