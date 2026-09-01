import type { PlanCriterion, PlannerIdea, PlannerIntent } from '@/api/newsTypes'
import { formatMoney } from '@/lib/format'

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

/**
 * The conditions recorded with a plan.
 *
 * Two things this deliberately no longer does (plan §6):
 *
 * 1. It does not invent technical setups. It used to pick a phrase like
 *    "holds a bounce off the 21d VWAP" from a pool and attribute it to the
 *    user's plan. The plan never said that.
 * 2. It does not decide whether a criterion is met. It used to coin-flip a
 *    PRNG. **No backend owns typed entry criteria** — plt's and bkt's
 *    structured criteria are *exit* rules and nothing evaluates an entry
 *    condition (HKP-XSV-1) — so `unknown` is the only truthful state for a
 *    derived criterion.
 *
 * What survives is a restatement of the plan's own numbers, which is not new
 * information: the entry/exit band and the stop are fields the user (or plt's
 * `target_entry_min`/`target_entry_max`, which PolicyGate really does
 * validate) already set.
 */
export function planCriteria(plan: PlannerIdea): PlanCriterion[] {
  if (plan.criteria?.length) return plan.criteria
  const bandCriterion: PlanCriterion =
    planIntent(plan) === 'close'
      ? {
          text: `Mark reaches the ${formatMoney(plan.targetLow)}–${formatMoney(plan.targetHigh)} exit band`,
          state: 'unknown',
        }
      : {
          text: `Premium inside the ${formatMoney(plan.entryLow)}–${formatMoney(plan.entryHigh)} entry band`,
          state: 'unknown',
        }
  const riskCriterion: PlanCriterion =
    plan.stop > 0
      ? {
          text:
            planIntent(plan) === 'close'
              ? `Hard invalidation: close below the ${formatMoney(plan.stop)} stop`
              : `No daily close below the ${formatMoney(plan.stop)} stop`,
          state: 'unknown',
        }
      : // Not a market condition — a structural fact about a long option, so
        // it is genuinely known.
        { text: 'Defined risk: full premium is the maximum loss', state: 'met' }
  return [bandCriterion, riskCriterion]
}

export interface PlanExitSummary {
  range: string
  /** Estimated P/L band at the exit range, sized off deployed capital. */
  plLow: number
  plHigh: number
  ratio: string
  time: string
}

/**
 * The exit side of a plan: where it sells, what that is worth against the
 * capital the plan is allowed to deploy, and the risk/reward it implies.
 */
export function planExitSummary(plan: PlannerIdea, deployed?: number): PlanExitSummary {
  const entryMid = (plan.entryLow + plan.entryHigh) / 2
  const targetMid = (plan.targetLow + plan.targetHigh) / 2
  const base =
    deployed && deployed > 0
      ? deployed
      : plan.maxAmount && plan.maxAmount > 0
        ? plan.maxAmount
        : 1000
  const plAt = (target: number) => (entryMid > 0 ? base * (target / entryMid - 1) : 0)
  const risk = plan.stop > 0 ? entryMid - plan.stop : entryMid
  const reward = targetMid - entryMid
  const computed = risk > 0 ? reward / risk : 0
  const ratio = plan.ai?.riskRewardRatio ?? computed
  return {
    range: `${formatMoney(plan.targetLow)}–${formatMoney(plan.targetHigh)}`,
    plLow: plAt(plan.targetLow),
    plHigh: plAt(plan.targetHigh),
    ratio: ratio > 0 ? `${ratio.toFixed(1)} : 1` : '—',
    time: plan.horizon,
  }
}
