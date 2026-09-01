import type { Idea } from '@/api/types'
import type { IdeasApi } from '@/api/portfolioApi'
import { latency } from '@/api/mock/latency'
import { DEMO_IDEAS } from '@/api/mock/seededData'

export class MockIdeasApi implements IdeasApi {
  async getIdeas(): Promise<Idea[]> {
    await latency(280)
    // Highest conviction first — the feed leads with what the model believes
    // most. An idea with no assessment sorts last rather than as a zero: the
    // absence of a score is not a low score.
    return DEMO_IDEAS.slice()
      .sort((a, b) => (b.ai?.conviction ?? -1) - (a.ai?.conviction ?? -1))
      .map((idea) => ({ ...idea, provenance: 'mock' as const }))
  }

  async getIdea(id: string): Promise<Idea | undefined> {
    await latency(120)
    const idea = DEMO_IDEAS.find((i) => i.id === id)
    return idea ? { ...idea, provenance: 'mock' } : undefined
  }
}

export const mockIdeasApi = new MockIdeasApi()
