import { describe, expect, it } from 'vitest'
import type { Position } from '@/api/types'
import type { PlannerIdea } from '@/api/newsTypes'
import { positionPlanPresentation } from '@/components/positions/PositionPlanSheet'

const position = {
  symbol: 'NVDA',
  option: { earningsDate: '2026-11-18' },
  ai: {
    recommendationNote: 'Protect gains into strength.',
    horizon: 'Three months',
    targetLow: 18,
    targetHigh: 24,
  },
} as Position

describe('positionPlanPresentation', () => {
  it('always supplies an AI plan when no saved plan exists', () => {
    expect(positionPlanPresentation(position)).toMatchObject({
      source: 'ai',
      title: 'Trim half before earnings on a run-up',
      trigger: 'Before Nov 18 earnings',
      target: '$18.00 – $24.00',
    })
  })

  it('preserves the source and content of a saved user plan', () => {
    const saved = {
      source: 'user',
      title: 'My earnings trim',
      notes: 'Sell five contracts before the print.',
      horizon: 'Before earnings',
      targetLow: 20,
      targetHigh: 25,
    } as PlannerIdea

    expect(positionPlanPresentation(position, saved)).toMatchObject({
      source: 'user',
      title: 'My earnings trim',
      notes: 'Sell five contracts before the print.',
    })
  })
})
