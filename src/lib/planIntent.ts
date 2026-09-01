import type { PlanCriterion, PlannerIdea, PlannerIntent } from '@/api/newsTypes'
import { MISSING, formatMoney, formatRange } from '@/lib/format'

export function planIntent(plan: PlannerIdea): PlannerIntent {
  if (plan.intent) return plan.intent
  return /\b(close|trim|exit|sell)\b/i.test(
    `${plan.originalPrompt ?? ''} ${plan.title ?? ''} ${plan.notes}`,
  )
    ? 'close'
    : 'open'
}

/**
 * A plan's display name.
 *
 * plt records **no title and no author** on a trade plan (§3.3), so a live plan
 * is named by the thing it actually is — its contract identity — rather than
 * by a sentence the adapter would have to write on the model's behalf.
 */
export function planTitle(plan: PlannerIdea): string {
  const title = plan.title?.trim()
  if (title) return title
  const contract = plan.contractDetail?.trim()
  return contract ? `${plan.symbol} ${contract}` : plan.symbol
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
  const criteria: PlanCriterion[] = []
  const closing = planIntent(plan) === 'close'
  // A band the plan does not have produces *no criterion*, rather than one
  // reading "reaches the — band": a live plan has an entry band (which
  // PolicyGate really validates) and no target band at all (§3.3).
  const bandLow = closing ? plan.targetLow : plan.entryLow
  const bandHigh = closing ? plan.targetHigh : plan.entryHigh
  if (bandLow !== undefined || bandHigh !== undefined) {
    criteria.push({
      text: closing
        ? `Mark reaches the ${formatRange(plan.targetLow, plan.targetHigh)} exit band`
        : `Premium inside the ${formatRange(plan.entryLow, plan.entryHigh)} entry band`,
      state: 'unknown',
    })
  }
  const riskCriterion: PlanCriterion =
    plan.stop !== undefined && plan.stop > 0
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
  criteria.push(riskCriterion)
  return criteria
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
  // Both bands are optional (§3.3). A missing one yields a missing summary
  // rather than a P/L computed against an entry price of zero.
  const entryMid = midpoint(plan.entryLow, plan.entryHigh)
  const targetMid = midpoint(plan.targetLow, plan.targetHigh)
  const base =
    deployed && deployed > 0
      ? deployed
      : plan.maxAmount && plan.maxAmount > 0
        ? plan.maxAmount
        : 1000
  const plAt = (target?: number) =>
    entryMid !== undefined && entryMid > 0 && target !== undefined
      ? base * (target / entryMid - 1)
      : 0
  const risk =
    entryMid === undefined
      ? undefined
      : plan.stop !== undefined && plan.stop > 0
        ? entryMid - plan.stop
        : entryMid
  const reward =
    targetMid !== undefined && entryMid !== undefined ? targetMid - entryMid : undefined
  const computed = risk !== undefined && risk > 0 && reward !== undefined ? reward / risk : 0
  const ratio = plan.ai?.riskRewardRatio ?? computed
  return {
    range: formatRange(plan.targetLow, plan.targetHigh),
    plLow: plAt(plan.targetLow),
    plHigh: plAt(plan.targetHigh),
    ratio: ratio > 0 ? `${ratio.toFixed(1)} : 1` : MISSING,
    time: plan.horizon ?? MISSING,
  }
}

function midpoint(low?: number, high?: number): number | undefined {
  if (low === undefined && high === undefined) return undefined
  return ((low ?? high!) + (high ?? low!)) / 2
}
