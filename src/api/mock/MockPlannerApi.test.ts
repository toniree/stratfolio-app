import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MockPlannerApi } from '@/api/mock/MockPlannerApi'
import type { CreatePlannerIdeaInput } from '@/api/newsTypes'

vi.mock('@/api/mock/latency', () => ({
  latency: () => Promise.resolve(),
}))

const STORAGE_KEY = 'stratfolio.planner.userIdeas.v1'

const baseInput: CreatePlannerIdeaInput = {
  symbol: ' nvda ',
  direction: 'LONG',
  title: '  AI infrastructure leader  ',
  notes: '  Durable demand and pricing power.  ',
  entryLow: 100,
  entryHigh: 110,
  targetLow: 120,
  targetHigh: 130,
  stop: 92,
  horizon: '',
}

describe('MockPlannerApi', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('normalizes a new idea, derives its company and computes expected upside', async () => {
    const api = new MockPlannerApi()

    const idea = await api.createIdea(baseInput)

    expect(idea).toMatchObject({
      source: 'user',
      symbol: 'NVDA',
      company: 'NVIDIA Corp.',
      title: 'AI infrastructure leader',
      notes: 'Durable demand and pricing power.',
      horizon: '6–12 months',
      status: 'draft',
      author: 'You',
    })
    expect(idea.expectedUpsidePct).toBeCloseTo(((125 - 105) / 105) * 100, 6)
  })

  it('persists created ideas and deletes only the requested user idea', async () => {
    const firstApi = new MockPlannerApi()
    const seededUserCount = (await firstApi.getIdeas()).filter((idea) => idea.source === 'user').length
    const created = await firstApi.createIdea(baseInput)

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown[]
    expect(persisted).toHaveLength(seededUserCount + 1)

    const reloadedApi = new MockPlannerApi()
    await expect(reloadedApi.getIdea(created.id)).resolves.toMatchObject({ symbol: 'NVDA' })

    await reloadedApi.deleteIdea(created.id)

    await expect(reloadedApi.getIdea(created.id)).resolves.toBeUndefined()
    const afterDelete = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown[]
    expect(afterDelete).toHaveLength(seededUserCount)
  })

  it('returns a positive expected move for a short thesis with a lower target', async () => {
    const api = new MockPlannerApi()

    const idea = await api.createIdea({
      ...baseInput,
      symbol: 'TSLA',
      direction: 'SHORT',
      entryLow: 300,
      entryHigh: 320,
      targetLow: 240,
      targetHigh: 260,
    })

    expect(idea.expectedUpsidePct).toBeCloseTo(Math.abs(((250 - 310) / 310) * 100), 6)
  })

  it('edits and caps a plan watch list at three unique options', async () => {
    const api = new MockPlannerApi()
    const created = await api.createIdea(baseInput)

    const updated = await api.updateIdea(created.id, {
      watchedOptions: ['Jan call', 'Feb call', 'Jan call', 'Mar put', 'Apr put'],
    })

    expect(updated.watchedOptions).toEqual(['Jan call', 'Feb call', 'Mar put'])
    await expect(api.getIdea(created.id)).resolves.toMatchObject({
      watchedOptions: ['Jan call', 'Feb call', 'Mar put'],
    })
  })

  it('persists AI-adjusted prompt and plan fields', async () => {
    const api = new MockPlannerApi()
    const created = await api.createIdea(baseInput)

    const updated = await api.updateIdea(created.id, {
      originalPrompt: 'Open with max $1,500 and enter near $8.',
      notes: 'AI-adjusted from your prompt.',
      maxAmount: 1500,
      entryLow: 7.84,
      entryHigh: 8.16,
      risk: 'Exit if the catalyst breaks.',
    })

    expect(updated).toMatchObject({
      originalPrompt: 'Open with max $1,500 and enter near $8.',
      notes: 'AI-adjusted from your prompt.',
      maxAmount: 1500,
      entryLow: 7.84,
      entryHigh: 8.16,
      risks: ['Exit if the catalyst breaks.'],
    })
  })

  it('persists position-specific plan metadata', async () => {
    const api = new MockPlannerApi()
    const idea = await api.createIdea({
      ...baseInput,
      positionId: 'pos-nvda-call',
      assetType: 'option',
      contractDetail: "$150 Call · Jan 15 '27",
      originalPrompt: '  Trim before earnings.  ',
      maxAmount: 2500,
      risk: '  Earnings volatility.  ',
      relatedNews: '  Blackwell supply update.  ',
    })

    expect(idea).toMatchObject({
      positionId: 'pos-nvda-call',
      assetType: 'option',
      contractDetail: "$150 Call · Jan 15 '27",
      originalPrompt: 'Trim before earnings.',
      maxAmount: 2500,
      risks: ['Earnings volatility.'],
      relatedNews: 'Blackwell supply update.',
      categories: ['options'],
    })
  })

  it('falls back to seeded ideas when persisted state is malformed', async () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json')

    const ideas = await new MockPlannerApi().getIdeas()

    expect(ideas.length).toBeGreaterThan(0)
    expect(ideas.some((idea) => idea.source === 'user')).toBe(true)
    expect(ideas.some((idea) => idea.source === 'ai')).toBe(true)
  })

  it('adds the required WMT earnings demo plan to older persisted state', async () => {
    localStorage.setItem(STORAGE_KEY, '[]')

    const ideas = await new MockPlannerApi().getIdeas()

    expect(ideas).toContainEqual(
      expect.objectContaining({
        id: 'plan-user-wmt-surprise-beat-trim',
        positionId: 'pos-wmt-sep',
        originalPrompt: 'Surprise beat? Sell 30% in the first hour; hold the rest until expiry.',
      }),
    )
    expect(ideas).toContainEqual(
      expect.objectContaining({
        id: 'plan-user-wmt-earnings-close',
        positionId: 'pos-wmt-sep',
        originalPrompt: 'Close on Aug 20 at open if earnings missed.',
      }),
    )
    expect(ideas).toContainEqual(
      expect.objectContaining({
        id: 'plan-user-pltr-trim-195',
        positionId: 'pos-pltr-jan',
        originalPrompt: 'Trim 50% when PLTR is around $195.',
      }),
    )
  })
})
