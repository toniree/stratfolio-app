import type { Idea, ThesisView } from '@/api/types'
import type { IdeasApi } from '@/api/portfolioApi'
import { latency } from '@/api/mock/latency'
import { DEMO_IDEAS } from '@/api/mock/seededData'

/**
 * The scripted thesis feed.
 *
 * Since APP-111 the seam speaks `ThesisView` — the fields plt actually records
 * — so this projects each demo `Idea` into one and hands the original back on
 * `ThesisView.idea`. That is what keeps the demo's rich tiles rendering while a
 * live thesis, which has no price or target band to give, renders plainly
 * instead of having five numbers invented for it.
 */
function toThesisView(idea: Idea): ThesisView {
  return {
    id: idea.id,
    symbol: idea.symbol,
    // Long premium in the demo book is directional by contract right; a
    // scripted put thesis is a bearish thesis.
    direction: idea.option?.right === 'PUT' ? 'BEARISH' : 'BULLISH',
    rationale: idea.ai?.thesis[0] ?? idea.ai?.recommendationNote ?? idea.tags.join(' · '),
    // Fractional, exactly like the wire (§7.4): the mock must produce the same
    // view model as the adapter, or render-time formatting goes untested in
    // the mode the demo actually runs in.
    confidence: idea.ai ? idea.ai.conviction / 100 : undefined,
    evidence:
      idea.catalysts.length > 0
        ? idea.catalysts.map((catalyst, index) => ({
            label: `Catalyst ${index + 1}`,
            value: catalyst,
          }))
        : undefined,
    invalidationConditions: idea.risks.length > 0 ? idea.risks.slice() : undefined,
    expectedCatalyst: idea.catalysts[0],
    horizon: idea.ai?.horizon,
    source: idea.source ?? 'ai',
    createdAt: idea.ai?.updatedAt ?? new Date().toISOString(),
    provenance: 'mock',
    idea: { ...idea, provenance: 'mock' },
  }
}

export class MockIdeasApi implements IdeasApi {
  async getTheses(): Promise<ThesisView[]> {
    await latency(280)
    // Highest conviction first — the feed leads with what the model believes
    // most. A thesis with no assessment sorts last rather than as a zero: the
    // absence of a score is not a low score.
    return DEMO_IDEAS.slice()
      .sort((a, b) => (b.ai?.conviction ?? -1) - (a.ai?.conviction ?? -1))
      .map(toThesisView)
  }

  async getThesis(id: string): Promise<ThesisView | undefined> {
    await latency(120)
    const idea = DEMO_IDEAS.find((i) => i.id === id)
    return idea ? toThesisView(idea) : undefined
  }
}

export const mockIdeasApi = new MockIdeasApi()
