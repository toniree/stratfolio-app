import { describe, expect, it } from 'vitest'
import type { Position } from '@/api/types'
import {
  findPositionPlan,
  findPositionPlans,
  optionOpeningSign,
  positionExecutionCriteria,
  isAiPlanPaused,
} from '@/components/positions/PositionTile'
import type { PlannerIdea } from '@/api/newsTypes'

const basePosition = {
  assetType: 'option',
  openingSide: 'BUY_TO_OPEN',
} as Position

describe('optionOpeningSign', () => {
  it('shows plus for buy-to-open options, including legacy long positions', () => {
    expect(optionOpeningSign(basePosition)).toBe('+')
    expect(optionOpeningSign({ ...basePosition, openingSide: undefined })).toBe('+')
  })

  it('shows minus for sell-to-open options and nothing for stock positions', () => {
    expect(optionOpeningSign({ ...basePosition, openingSide: 'SELL_TO_OPEN' })).toBe('−')
    expect(optionOpeningSign({ ...basePosition, assetType: 'stock' })).toBeNull()
  })
})

describe('findPositionPlan', () => {
  const plan = {
    id: 'plan-coin-put',
    symbol: 'COIN',
    assetType: 'option',
    contractDetail: "$220 Put · Feb 19 '27",
  } as PlannerIdea

  it('matches an option plan only to the exact contract', () => {
    const position = {
      ...basePosition,
      id: 'pos-coin-put',
      symbol: 'COIN',
      contractDetail: "$220 Put · Feb 19 '27",
    }

    expect(findPositionPlan(position, [plan])).toBe(plan)
    expect(findPositionPlan({ ...position, contractDetail: "$280 Put · Feb 19 '27" }, [plan])).toBeUndefined()
  })

  it('returns every plan associated with the exact position', () => {
    const position = {
      ...basePosition,
      id: 'pos-coin-put',
      symbol: 'COIN',
      contractDetail: "$220 Put · Feb 19 '27",
    }
    const second = { ...plan, id: 'plan-coin-put-2', positionId: position.id }
    const otherContract = { ...plan, id: 'other', contractDetail: "$280 Put · Feb 19 '27" }

    expect(findPositionPlans(position, [plan, second, otherContract])).toEqual([plan, second])
  })
})

describe('positionExecutionCriteria', () => {
  it('shows multiple human rules with an AI risk-management criterion', () => {
    const position = {
      ...basePosition,
      id: 'pos-wmt-sep',
      symbol: 'WMT',
      avgCost: 2.7,
    } as Position
    const plan = {
      id: 'plan-wmt',
      positionId: position.id,
      source: 'user',
      originalPrompt: 'Close at the open if earnings miss.',
      title: 'Earnings close rule',
    } as PlannerIdea

    const surpriseBeatPlan = {
      ...plan,
      id: 'plan-wmt-surprise-beat',
      originalPrompt: 'Surprise beat? Sell 30% in the first hour; hold the rest until expiry.',
    }

    expect(positionExecutionCriteria(position, [plan, surpriseBeatPlan])).toEqual([
      { source: 'user', text: 'Close at the open if earnings miss.' },
      {
        source: 'user',
        text: 'Surprise beat? Sell 30% in the first hour; hold the rest until expiry.',
      },
      {
        source: 'ai',
        text: 'Reassess risk if the option mark breaks below $2.11; keep max loss limited to premium.',
      },
    ])
  })
})

describe('isAiPlanPaused', () => {
  it('pauses only unapproved AI criteria while AI Trading is off', () => {
    expect(isAiPlanPaused('ai', false)).toBe(true)
    expect(isAiPlanPaused('ai', true)).toBe(false)
    expect(isAiPlanPaused('user', false)).toBe(false)
  })
})
