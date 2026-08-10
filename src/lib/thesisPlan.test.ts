import { describe, expect, it } from 'vitest'
import type { Idea } from '@/api/types'
import { thesisToPlannerInput } from '@/lib/thesisPlan'

const idea = {
  symbol: 'NVDA',
  company: 'NVIDIA',
  assetType: 'option',
  contractDetail: "Jan 15 '27 · $150 Call",
  entryLow: 8,
  entryHigh: 10,
  targetLow: 20,
  targetHigh: 24,
  catalysts: ['Blackwell demand remains supply constrained.'],
  risks: ['The position is crowded.'],
  option: { right: 'CALL' },
  ai: {
    horizon: 'Three months',
    recommendationNote: 'Scale into the entry band.',
    thesis: ['Committed supply supports the setup.'],
  },
} as Idea

describe('thesisToPlannerInput', () => {
  it('creates a funded plan and preserves the user refinement', () => {
    const input = thesisToPlannerInput(idea, 'Only enter below $9.')

    expect(input.maxAmount).toBe(1000)
    expect(input.originalPrompt).toBe('Only enter below $9.')
    expect(input.notes).toContain('User refinement: Only enter below $9.')
    expect(input.title).toBe('Committed supply supports the setup.')
    expect(input.relatedNews).toBe(idea.catalysts[0])
  })
})
