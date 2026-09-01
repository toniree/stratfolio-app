import type {
  CreatePlannerIdeaInput,
  PlannerIdea,
  UpdatePlannerIdeaInput,
} from '@/api/newsTypes'
import type { PlannerApi } from '@/api/portfolioApi'
import { latency } from '@/api/mock/latency'
import { NEWS_PLANNER_IDEAS, USER_PLANNER_IDEAS } from '@/api/mock/seededNews'
import { SYMBOL_MAP } from '@/api/mock/seededData'

const STORAGE_KEY = 'stratfolio.planner.userIdeas.v1'
const REQUIRED_DEMO_PLAN_IDS = [
  'plan-user-wmt-surprise-beat-trim',
  'plan-user-wmt-earnings-close',
  'plan-user-pltr-trim-195',
] as const

/**
 * Planner ideas: AI-generated (derived from news articles) plus user-authored.
 *
 * User-authored ideas are persisted to localStorage so a created idea survives
 * a reload during a demo. AI ideas stay seeded and immutable.
 */
export class MockPlannerApi implements PlannerApi {
  private aiIdeas = NEWS_PLANNER_IDEAS.map((idea) => ({ ...idea }))
  private userIdeas: PlannerIdea[]

  constructor() {
    this.userIdeas = this.load()
  }

  private load(): PlannerIdea[] {
    if (typeof localStorage === 'undefined') return USER_PLANNER_IDEAS.map((i) => ({ ...i }))
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return USER_PLANNER_IDEAS.map((i) => ({ ...i }))
      const parsed = JSON.parse(raw) as PlannerIdea[]
      if (!Array.isArray(parsed)) return USER_PLANNER_IDEAS.map((i) => ({ ...i }))
      return REQUIRED_DEMO_PLAN_IDS.reduce((ideas, requiredId) => {
        const requiredPlan = USER_PLANNER_IDEAS.find((idea) => idea.id === requiredId)
        if (!requiredPlan) return ideas
        return ideas.some((idea) => idea.id === requiredId)
          ? ideas.map((idea) => (idea.id === requiredId ? { ...idea, ...requiredPlan } : idea))
          : [{ ...requiredPlan }, ...ideas]
      }, parsed)
    } catch {
      return USER_PLANNER_IDEAS.map((i) => ({ ...i }))
    }
  }

  private persist() {
    if (typeof localStorage === 'undefined') return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.userIdeas))
    } catch {
      /* storage full or unavailable — the demo still works in memory */
    }
  }

  async getIdeas(): Promise<PlannerIdea[]> {
    await latency(230)
    return [...this.aiIdeas, ...this.userIdeas]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((idea) => ({ ...idea, provenance: 'mock' as const }))
  }

  async getIdea(id: string): Promise<PlannerIdea | undefined> {
    await latency(110)
    const idea = [...this.aiIdeas, ...this.userIdeas].find((i) => i.id === id)
    return idea ? { ...idea, provenance: 'mock' } : undefined
  }

  async createIdea(input: CreatePlannerIdeaInput): Promise<PlannerIdea> {
    await latency(380)
    const symbol = input.symbol.trim().toUpperCase()
    const spec = SYMBOL_MAP.get(symbol)
    const mid = (input.targetLow + input.targetHigh) / 2
    const entryMid = (input.entryLow + input.entryHigh) / 2
    const expectedUpsidePct = entryMid > 0 ? ((mid - entryMid) / entryMid) * 100 : 0

    const idea: PlannerIdea = {
      id: `plan-user-${Date.now().toString(36)}`,
      source: 'user',
      symbol,
      company: input.company?.trim() || spec?.company || symbol,
      positionId: input.positionId,
      assetType: input.assetType ?? 'stock',
      contractDetail: input.contractDetail?.trim() || undefined,
      direction: input.direction,
      intent: input.intent,
      status: 'draft',
      title: input.title.trim(),
      originalPrompt: input.originalPrompt?.trim() || undefined,
      notes: input.notes.trim(),
      maxAmount: input.maxAmount,
      entryLow: input.entryLow,
      entryHigh: input.entryHigh,
      targetLow: input.targetLow,
      targetHigh: input.targetHigh,
      stop: input.stop,
      horizon: input.horizon.trim() || '6–12 months',
      expectedUpsidePct: input.direction === 'LONG' ? expectedUpsidePct : Math.abs(expectedUpsidePct),
      categories: [input.assetType === 'option' ? 'options' : 'stocks'],
      catalysts: [],
      risks: input.risk?.trim() ? [input.risk.trim()] : [],
      createdAt: new Date().toISOString(),
      author: 'You',
      relatedNews: input.relatedNews?.trim() || undefined,
      watchedOptions: normalizeWatchedOptions(input.watchedOptions),
    }
    this.userIdeas = [idea, ...this.userIdeas]
    this.persist()
    return idea
  }

  async updateIdea(id: string, input: UpdatePlannerIdeaInput): Promise<PlannerIdea> {
    await latency(180)
    const index = this.userIdeas.findIndex((idea) => idea.id === id)
    const aiIndex = this.aiIdeas.findIndex((idea) => idea.id === id)
    const existing = index >= 0 ? this.userIdeas[index] : this.aiIdeas[aiIndex]
    if (!existing) throw new Error('Plan not found.')

    const { risk, watchedOptions, ...planFields } = input
    const definedPlanFields = Object.fromEntries(
      Object.entries(planFields).filter(([, value]) => value !== undefined),
    ) as Partial<PlannerIdea>
    const updated: PlannerIdea = {
      ...existing,
      ...definedPlanFields,
      ...(risk !== undefined ? { risks: risk.trim() ? [risk.trim()] : [] } : {}),
      ...(watchedOptions !== undefined
        ? { watchedOptions: normalizeWatchedOptions(watchedOptions) }
        : {}),
    }
    if (index >= 0) {
      this.userIdeas = this.userIdeas.map((idea, ideaIndex) =>
        ideaIndex === index ? updated : idea,
      )
      this.persist()
    } else {
      this.aiIdeas = this.aiIdeas.map((idea, ideaIndex) =>
        ideaIndex === aiIndex ? updated : idea,
      )
    }
    return updated
  }

  async deleteIdea(id: string): Promise<void> {
    await latency(180)
    this.userIdeas = this.userIdeas.filter((i) => i.id !== id)
    this.persist()
  }
}

export const mockPlannerApi = new MockPlannerApi()

function normalizeWatchedOptions(options: string[] | undefined): string[] | undefined {
  if (!options) return undefined
  const normalized = [...new Set(options.map((option) => option.trim()).filter(Boolean))].slice(0, 3)
  return normalized.length > 0 ? normalized : undefined
}
