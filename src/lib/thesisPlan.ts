import type { CreatePlannerIdeaInput } from '@/api/newsTypes'
import type { Idea } from '@/api/types'

/**
 * Turns an accepted discovery thesis into an editable, user-owned plan.
 *
 * `idea.ai` is optional (D3). Without a recorded assessment there is no model
 * sentence to seed the title, prompt or notes with, so those fall back to the
 * ticker and to whatever the user typed — never to a plausible-sounding line
 * the model never produced. `horizon` likewise stays empty rather than
 * inheriting a made-up window.
 */
export function thesisToPlannerInput(idea: Idea, reason: string): CreatePlannerIdeaInput {
  const refinement = reason.trim()
  const contractMultiplier = idea.assetType === 'option' ? 100 : 1
  const proposedCapital = idea.entryHigh * contractMultiplier
  const ai = idea.ai
  const note = ai?.recommendationNote

  return {
    symbol: idea.symbol,
    company: idea.company,
    assetType: idea.assetType,
    contractDetail: idea.contractDetail,
    direction: idea.option?.right === 'PUT' ? 'SHORT' : 'LONG',
    intent: 'open',
    title: ai?.thesis[0] ?? note ?? `${idea.symbol} plan`,
    originalPrompt: refinement || note,
    notes: [note, refinement ? `User refinement: ${refinement}` : undefined]
      .filter(Boolean)
      .join('\n\n'),
    maxAmount: Math.max(500, Math.round(proposedCapital / 50) * 50),
    entryLow: idea.entryLow,
    entryHigh: idea.entryHigh,
    targetLow: idea.targetLow,
    targetHigh: idea.targetHigh,
    stop: Math.max(0.01, Number((idea.entryLow * 0.65).toFixed(2))),
    horizon: ai?.horizon ?? '',
    risk: idea.risks[0],
    relatedNews: idea.catalysts[0],
    watchedOptions: idea.contractDetail ? [idea.contractDetail] : undefined,
  }
}
