import type { Idea } from '@/api/types'
import type { IdeasApi } from '@/api/portfolioApi'
import { latency } from '@/api/mock/latency'
import { DEMO_IDEAS } from '@/api/mock/seededData'

export class MockIdeasApi implements IdeasApi {
  async getIdeas(): Promise<Idea[]> {
    await latency(280)
    // Highest conviction first — the feed leads with what the model believes most.
    return DEMO_IDEAS.slice().sort((a, b) => b.ai.conviction - a.ai.conviction)
  }

  async getIdea(id: string): Promise<Idea | undefined> {
    await latency(120)
    return DEMO_IDEAS.find((i) => i.id === id)
  }
}

export const mockIdeasApi = new MockIdeasApi()
