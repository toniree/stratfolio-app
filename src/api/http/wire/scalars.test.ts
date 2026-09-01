import { describe, expect, it } from 'vitest'
import {
  convictionFromConfidence,
  decimal,
  instant,
  integer,
  percentPointsFromFraction,
  requiredDecimal,
  stringList,
  text,
} from '@/api/http/wire/scalars'

/**
 * Footgun checklist coverage (plan §7). Each block names the footgun it
 * guards; the point of the tests is that *absence* survives the decode.
 */
describe('wire scalars', () => {
  describe('§7.2 — plt non_null omission: absent is not zero', () => {
    it.each([undefined, null, '', '   ', 'not-a-number', Number.NaN, Number.POSITIVE_INFINITY])(
      'decodes %p as undefined, never 0',
      (value) => {
        expect(decimal(value as never)).toBeUndefined()
      },
    )

    it('keeps a real zero as zero', () => {
      // plt does send `realized_pnl: 0` on an open trade — a measured zero,
      // which must not be confused with an omitted field.
      expect(decimal(0)).toBe(0)
      expect(decimal('0.00')).toBe(0)
    })

    it('throws rather than substituting zero for a required field', () => {
      expect(() => requiredDecimal(undefined, 'entry_price')).toThrow(/entry_price/)
    })
  })

  describe('§7.3 — money arrives as a JSON number (plt) or a decimal string (mnd)', () => {
    it('decodes both encodings identically', () => {
      expect(decimal(16.2)).toBe(16.2)
      expect(decimal('16.20')).toBe(16.2)
      expect(decimal(' 150 ')).toBe(150)
    })

    it('truncates integers without rounding a count up', () => {
      expect(integer('3')).toBe(3)
      expect(integer(3.9)).toBe(3)
      expect(integer(undefined)).toBeUndefined()
    })
  })

  describe('§7.4 — confidence is 0..1 on the wire, conviction is 0–100 in the app', () => {
    it('scales a fractional confidence exactly once', () => {
      expect(convictionFromConfidence(0.72)).toBe(72)
      expect(convictionFromConfidence('0.5')).toBe(50)
      expect(convictionFromConfidence(0)).toBe(0)
      expect(convictionFromConfidence(1)).toBe(100)
    })

    it('clamps rather than trusting an out-of-range provider value', () => {
      // A provider that ever sent 0..100 would otherwise produce a 7,200-point
      // conviction badge.
      expect(convictionFromConfidence(72)).toBe(100)
      expect(convictionFromConfidence(-0.2)).toBe(0)
    })

    it('returns undefined for an absent confidence rather than 0/100', () => {
      expect(convictionFromConfidence(undefined)).toBeUndefined()
      expect(convictionFromConfidence(null)).toBeUndefined()
    })
  })

  describe('§7.1 — profit_target_pct / stop_loss_pct are fractions, not percent points', () => {
    it('converts 0.35 to 35 percent points', () => {
      expect(percentPointsFromFraction(0.35)).toBeCloseTo(35, 10)
      expect(percentPointsFromFraction('0.5')).toBeCloseTo(50, 10)
    })

    it('leaves an omitted legacy field undefined', () => {
      // Legacy plans omit these entirely; a 0 would render "stop at 0%".
      expect(percentPointsFromFraction(undefined)).toBeUndefined()
    })
  })

  describe('strings, timestamps and lists', () => {
    it('treats a blank string as absent', () => {
      expect(text('  ')).toBeUndefined()
      expect(text('MU')).toBe('MU')
    })

    it('rejects an unparseable timestamp instead of passing it through', () => {
      expect(instant('2026-08-24T13:45:02Z')).toBe('2026-08-24T13:45:02Z')
      expect(instant('yesterday')).toBeUndefined()
      expect(instant(undefined)).toBeUndefined()
    })

    it('returns undefined for an empty or missing list, not []', () => {
      expect(stringList(undefined)).toBeUndefined()
      expect(stringList([])).toBeUndefined()
      // §7.5: rejection reason codes may repeat, and duplicates are preserved.
      expect(stringList(['DTE_LT_1', 'DTE_LT_1'])).toEqual(['DTE_LT_1', 'DTE_LT_1'])
    })
  })
})
