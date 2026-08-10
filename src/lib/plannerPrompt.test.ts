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
})
