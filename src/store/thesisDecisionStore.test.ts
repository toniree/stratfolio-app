import { beforeEach, describe, expect, it } from 'vitest'
import { useThesisDecisionStore } from '@/store/thesisDecisionStore'

describe('thesisDecisionStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useThesisDecisionStore.setState({ decisions: {} })
  })

  it('stores the decision and optional learning reason', () => {
    useThesisDecisionStore.getState().decide('idea-1', 'rejected', 'Already overexposed.')

    expect(useThesisDecisionStore.getState().decisions['idea-1']).toEqual({
      decision: 'rejected',
      reason: 'Already overexposed.',
    })
  })
})
