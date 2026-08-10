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

  it.each([
    ['Plan 10% of my capital on this', 5000],
    ['Use 2.5 percent of the balance', 1250],
    ['Put 1/4 of available cash into it', 2500],
    ['Max 2 / 5 of portfolio capital', 20000],
  ])('resolves relative sizing from %s', (prompt, amount) => {
    expect(parseMaxAmountFromPrompt(prompt, { balance: 50_000, cash: 10_000 })).toBe(amount)
  })

  it('ignores invalid fractions and does not mistake them for dollar caps', () => {
    expect(parseMaxAmountFromPrompt('Use 1/0 of cash', { balance: 50_000, cash: 10_000 })).toBeUndefined()
  })

  it.each([
    ['Put 500 into this setup', 500],
    ['Open with 2,500 before earnings', 2500],
    ['Risk 30 on this setup', undefined],
    ['Use 30.01 for the plan', 30.01],
  ])('treats bare numbers greater than 30 as sizing: %s', (prompt, amount) => {
    expect(parseMaxAmountFromPrompt(prompt)).toBe(amount)
  })
})
