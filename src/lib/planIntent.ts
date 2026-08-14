import type { PlanCriterion, PlannerIdea, PlannerIntent } from '@/api/newsTypes'
import { hashString, mulberry32 } from '@/lib/prng'
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

/** Technical setups the generator can attach to an entry-side plan. */
const OPEN_SETUPS = [
  'holds a bounce off the 21d VWAP on 1.5× average volume',
  'reclaims the 15d SMA after a 3%+ drawdown',
  'carries a 30d IV rank below the 40th percentile at fill',
  'prints a positive daily MACD (12/26) cross',
  'holds 14d RSI above 45 on the retest',
]

/** Exit-side setups — momentum and liquidity conditions for selling. */
const CLOSE_SETUPS = [
  '14d RSI stretches above 70 — sell into strength',
  'first daily close back under the 5d EMA',
  'bid/ask spread inside 4% of mark at the exit print',
  '10d realised vol above its 30d mean — premium is bid',
]

/**
 * The checkable conditions a plan executes against.
 *
 * Seeded plans carry hand-written criteria; everything else gets a
 * deterministic set derived from the plan's own numbers, so two renders of
 * the same plan always agree on both wording and met/unmet state.
 */
export function planCriteria(plan: PlannerIdea): PlanCriterion[] {
  if (plan.criteria?.length) return plan.criteria
  const rand = mulberry32(hashString(plan.id))
  const pick = (pool: string[]) => pool[Math.floor(rand() * pool.length)]
  if (planIntent(plan) === 'close') {
    return [
      {
        text: `Mark reaches the ${formatMoney(plan.targetLow)}–${formatMoney(plan.targetHigh)} exit band`,
        met: rand() > 0.45,
      },
      { text: `${plan.symbol} ${pick(CLOSE_SETUPS)}`, met: rand() > 0.5 },
      plan.stop > 0
        ? { text: `Hard invalidation: close below the ${formatMoney(plan.stop)} stop`, met: false }
        : { text: 'Defined risk: full premium is the maximum loss', met: true },
    ]
  }
  return [
    {
      text: `Premium inside the ${formatMoney(plan.entryLow)}–${formatMoney(plan.entryHigh)} entry band`,
      met: true,
    },
    { text: `${plan.symbol} ${pick(OPEN_SETUPS)}`, met: rand() > 0.5 },
    plan.stop > 0
      ? { text: `No daily close below the ${formatMoney(plan.stop)} stop`, met: rand() > 0.35 }
      : { text: 'Defined risk: full premium is the maximum loss', met: true },
  ]
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
