import type { PlannerIdea, PlannerIntent } from '@/api/newsTypes'

export function planIntent(plan: PlannerIdea): PlannerIntent {
  if (plan.intent) return plan.intent
  return /\b(close|trim|exit|sell)\b/i.test(
    `${plan.originalPrompt ?? ''} ${plan.title} ${plan.notes}`,
  )
    ? 'close'
    : 'open'
}

export function watchedPlanOptions(plan: PlannerIdea): string[] {
  if (plan.watchedOptions?.length) return plan.watchedOptions.slice(0, 3)
  if (plan.assetType === 'option' && plan.contractDetail) return [plan.contractDetail]
  return []
}
