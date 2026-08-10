import { describe, expect, it } from 'vitest'
import { adjustPlanFromPrompt, parseMaxAmountFromPrompt } from '@/lib/planPrompt'

describe('plan prompt interpretation', () => {
  it.each([
    ['Open with max $1,500.', 1500],
    ['Cap at 2,250 per trade.', 2250],
    ['Use up to $900 per trade.', 900],
    ['$3,000 max for this setup.', 3000],
  ])('reads max sizing from %s', (prompt, amount) => {
    expect(parseMaxAmountFromPrompt(prompt)).toBe(amount)
  })

  it('translates an edited prompt into deterministic plan adjustments', () => {
    const input = adjustPlanFromPrompt(
      ' Open with max $1,500, enter near $8, target $20, and stop at $6. ',
    )

    expect(input).toMatchObject({
      intent: 'open',
      originalPrompt: 'Open with max $1,500, enter near $8, target $20, and stop at $6.',
      maxAmount: 1500,
      entryLow: 7.84,
      entryHigh: 8.16,
      targetLow: 19.6,
      targetHigh: 20.4,
      stop: 6,
    })
  })
})
