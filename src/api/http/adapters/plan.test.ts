import { describe, expect, it } from 'vitest'
import { sortPlansNewestFirst, toPlanStatus, toPlanView } from '@/api/http/adapters/plan'
import { PLATFORM_PLAN_STATUSES } from '@/api/newsTypes'
import {
  THESIS_FIXTURE,
  TRADE_PLANS_FIXTURE,
  TRADE_PLAN_LEGACY_FIXTURE,
  TRADE_PLAN_REJECTED_FIXTURE,
  TRADE_PLAN_VALIDATED_FIXTURE,
} from '@/test/msw/fixtures/plt'

describe('toPlanStatus', () => {
  it('maps the complete backend enum, CANCELLED included', () => {
    expect(toPlanStatus('PROPOSED')).toBe('proposed')
    expect(toPlanStatus('VALIDATED')).toBe('validated')
    expect(toPlanStatus('REJECTED')).toBe('rejected')
    expect(toPlanStatus('EXECUTED')).toBe('executed')
    // Defined in the enum; no plt service path sets it today (HKP-PLT-4).
    expect(toPlanStatus('CANCELLED')).toBe('cancelled')
  })

  it('covers every platform status the app declares', () => {
    const mapped = ['PROPOSED', 'VALIDATED', 'REJECTED', 'EXECUTED', 'CANCELLED'].map(toPlanStatus)
    expect(new Set(mapped)).toEqual(new Set(PLATFORM_PLAN_STATUSES))
  })
})

describe('toPlanView', () => {
  const plan = toPlanView(TRADE_PLAN_VALIDATED_FIXTURE, THESIS_FIXTURE)

  it('keeps structured exits as fractions, not percent points (§7.1)', () => {
    // 0.35 is +35%. Rendering it as "0.35%" is the classic version of this bug.
    expect(TRADE_PLAN_VALIDATED_FIXTURE.profit_target_pct).toBe(0.35)
    expect(plan.profitTargetPct).toBe(0.35)
    expect(plan.stopLossPct).toBe(0.5)
  })

  it('keeps confidence as the 0..1 wire fraction (§7.4)', () => {
    expect(plan.confidence).toBe(0.72)
  })

  it('maps the entry band — the one criterion plt actually validates', () => {
    expect(plan.entryLow).toBe(15)
    expect(plan.entryHigh).toBe(16.5)
  })

  it('invents no title, author, target band, stop or expected upside', () => {
    expect(plan.title).toBeUndefined()
    expect(plan.author).toBeUndefined()
    expect(plan.targetLow).toBeUndefined()
    expect(plan.targetHigh).toBeUndefined()
    expect(plan.stop).toBeUndefined()
    expect(plan.expectedUpsidePct).toBeUndefined()
    // …and no fabricated model assessment either.
    expect(plan.ai).toBeUndefined()
  })

  it('carries contract identity and the derived OCC symbol', () => {
    expect(plan.optionType).toBe('CALL')
    expect(plan.strike).toBe(190)
    expect(plan.expiration).toBe('2026-12-18')
    expect(plan.dte).toBe(109)
    expect(plan.occSymbol).toBe('NVDA261218C00190000')
    expect(plan.contractDetail).toBe('$190 Call · 2026-12-18')
  })

  it('joins the thesis rationale when the plan has no reasoning of its own', () => {
    expect(plan.notes).toBe(THESIS_FIXTURE.rationale)
    expect(plan.thesisId).toBe(TRADE_PLAN_VALIDATED_FIXTURE.thesis_id)
    // Without the join, no invented prose — an empty note, not a made-up one.
    expect(toPlanView(TRADE_PLAN_VALIDATED_FIXTURE).notes).toBe('')
  })

  it('renders rejection reasons verbatim, duplicates included (§7.5)', () => {
    const rejected = toPlanView(TRADE_PLAN_REJECTED_FIXTURE)
    expect(rejected.status).toBe('rejected')
    expect(rejected.rejectionReasons).toEqual(['DTE_LT_1', 'DTE_LT_1', 'INSUFFICIENT_CASH'])
  })

  it('leaves a legacy plan’s absent exit fields undefined, not zero (§7.2)', () => {
    const legacy = toPlanView(TRADE_PLAN_LEGACY_FIXTURE)
    expect(legacy.profitTargetPct).toBeUndefined()
    expect(legacy.stopLossPct).toBeUndefined()
    expect(legacy.maxHoldingDays).toBeUndefined()
    expect(legacy.dteFloor).toBeUndefined()
    expect(legacy.entryLow).toBeUndefined()
  })

  it('reads a PUT plan as short exposure', () => {
    expect(toPlanView(TRADE_PLAN_REJECTED_FIXTURE).direction).toBe('SHORT')
    expect(plan.direction).toBe('LONG')
  })
})

describe('sortPlansNewestFirst', () => {
  it('orders by created_at descending', () => {
    const sorted = sortPlansNewestFirst(TRADE_PLANS_FIXTURE.map((p) => toPlanView(p)))
    expect(sorted.map((p) => p.symbol)).toEqual(['COIN', 'NVDA', 'AMD'])
  })
})
