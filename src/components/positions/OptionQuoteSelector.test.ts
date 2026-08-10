import { describe, expect, it } from 'vitest'
import { optionQuoteValue } from '@/components/positions/OptionQuoteSelector'

describe('optionQuoteValue', () => {
  it('builds a valid quote book around the mark', () => {
    const mark = 10
    const bid = optionQuoteValue('bid', mark, 9.5)
    const ask = optionQuoteValue('ask', mark, 9.5)

    expect(bid).toBeLessThan(mark)
    expect(ask).toBeGreaterThan(mark)
    expect((bid + ask) / 2).toBeCloseTo(mark)
    expect(optionQuoteValue('mark', mark, 9.5)).toBe(mark)
    expect(optionQuoteValue('last', mark, 9.5)).toBeGreaterThan(9.5)
    expect(optionQuoteValue('last', mark, 9.5)).toBeLessThan(mark)
  })
})
