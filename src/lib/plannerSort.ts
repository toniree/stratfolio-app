import type { PlannerIdea } from '@/api/newsTypes'

/** Demo ranking for plans most likely to satisfy their entry criteria soon. */
export function triggerSoonScore(plan: PlannerIdea): number {
  const statusScore = plan.status === 'ready' ? 60 : plan.status === 'watching' ? 42 : 24
  const convictionScore = (plan.ai?.conviction ?? 55) * 0.35
  const sourcedScore = plan.sourceArticleId || plan.relatedNews ? 6 : 0
  return statusScore + convictionScore + sourcedScore
}

export function sortPlansByTriggerSoon(plans: PlannerIdea[]): PlannerIdea[] {
  return plans.slice().sort((a, b) => {
    const scoreDelta = triggerSoonScore(b) - triggerSoonScore(a)
    if (scoreDelta !== 0) return scoreDelta
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

export function triggerSoonPercent(plan: PlannerIdea): string {
  const probability = Math.round(Math.max(45, Math.min(96, triggerSoonScore(plan))))
  return `${probability}%`
}
