import { beforeEach, describe, expect, it } from 'vitest'
import { usePlanExecutionStore } from '@/store/planExecutionStore'

describe('planExecutionStore', () => {
  beforeEach(() => {
    localStorage.clear()
    usePlanExecutionStore.setState({ disabledIds: [] })
  })

  it('shares reversible disabled-plan state', () => {
    usePlanExecutionStore.getState().disablePlan('plan-1')
    usePlanExecutionStore.getState().disablePlan('plan-1')
    expect(usePlanExecutionStore.getState().disabledIds).toEqual(['plan-1'])

    usePlanExecutionStore.getState().activatePlan('plan-1')
    expect(usePlanExecutionStore.getState().disabledIds).toEqual([])
  })
})
