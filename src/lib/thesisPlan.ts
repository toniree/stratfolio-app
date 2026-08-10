import type { CreatePlannerIdeaInput } from '@/api/newsTypes'
import type { Idea } from '@/api/types'

/** Turns an accepted discovery thesis into an editable, user-owned plan. */
export function thesisToPlannerInput(idea: Idea, reason: string): CreatePlannerIdeaInput {
  const refinement = reason.trim()
  const contractMultiplier = idea.assetType === 'option' ? 100 : 1
  const proposedCapital = idea.entryHigh * contractMultiplier

  return {
    symbol: idea.symbol,
    company: idea.company,
    assetType: idea.assetType,
    contractDetail: idea.contractDetail,
    direction: idea.option?.right === 'PUT' ? 'SHORT' : 'LONG',
    intent: 'open',
    title: idea.ai.thesis[0] ?? idea.ai.recommendationNote,
    originalPrompt: refinement || idea.ai.recommendationNote,
    notes: refinement
      ? `${idea.ai.recommendationNote}\n\nUser refinement: ${refinement}`
      : idea.ai.recommendationNote,
    maxAmount: Math.max(500, Math.round(proposedCapital / 50) * 50),
    entryLow: idea.entryLow,
    entryHigh: idea.entryHigh,
    targetLow: idea.targetLow,
    targetHigh: idea.targetHigh,
    stop: Math.max(0.01, Number((idea.entryLow * 0.65).toFixed(2))),
    horizon: idea.ai.horizon,
    risk: idea.risks[0],
    relatedNews: idea.catalysts[0],
    watchedOptions: idea.contractDetail ? [idea.contractDetail] : undefined,
  }
}
