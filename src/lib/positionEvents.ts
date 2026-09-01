import type { Position } from '@/api/types'
import type { PlannerIdea } from '@/api/newsTypes'
import type { HistoryPoint } from '@/lib/optionHistory'
import { contractMultiplier } from '@/lib/portfolioMath'
import { formatMoney, formatQty } from '@/lib/format'
import { hashString, mulberry32 } from '@/lib/prng'

export type PositionEventKind =
  | 'open'
  | 'add'
  | 'trim'
  | 'plan_created'
  | 'plan_updated'
  | 'plan_disabled'

export interface PositionEventFact {
  label: string
  value: string
  tone?: 'up' | 'down'
}

export interface PositionEvent {
  id: string
  kind: PositionEventKind
  /** Unix seconds, aligned to a session in the position's history. */
  time: number
  /** Premium at the time of the event, used to place the marker on the line. */
  price: number
  title: string
  summary: string
  facts: PositionEventFact[]
  /** The instruction behind a plan event, shown verbatim. */
  prompt?: string
}

export function isPlanEvent(kind: PositionEventKind): boolean {
  return kind === 'plan_created' || kind === 'plan_updated' || kind === 'plan_disabled'
}

/**
 * The position's audit trail, projected onto its price history.
 *
 * Two very different kinds of marker live here, and they are now gated apart
 * (plan §6, "synthesized fills/order IDs" removed from live views):
 *
 * - **Real** markers come from the position and the user's saved plans: the
 *   opening fill (its time, size and average cost are recorded facts) and
 *   plan lifecycle events.
 * - **Synthetic** markers — scale-ins, trims, order ids, slippage and VWAP
 *   gap — are deterministic fiction for the demo book, which has no order
 *   history behind it. They render only when the position itself is mock
 *   data. A live position shows its real opening fill and nothing invented;
 *   real fill history arrives with the order seam.
 */
export function positionEvents(
  position: Position,
  plans: PlannerIdea[],
  history: HistoryPoint[],
): PositionEvent[] {
  if (history.length < 4) return []

  // Synthetic markers exist only for the demo book. A live position's
  // provenance is `live`, and inventing scale-ins and order ids for a real
  // holding would put fabricated fills in an audit trail.
  const synthetic = position.provenance === 'mock' || position.provenance === undefined
  const rand = mulberry32(hashString(`${position.id}:events`))
  const multiplier = contractMultiplier(position)
  const unit = position.assetType === 'option' ? 'contracts' : 'shares'
  const events: PositionEvent[] = []

  const openedAt = new Date(position.openedAt).getTime() / 1000
  const openIndex = nearestIndex(history, openedAt)

  // ---- The opening fill -------------------------------------------------
  // The entry marker doubles as the record of the plan that opened the
  // position, when one exists, so clicking it explains the *why* as well as
  // the fill.
  const openPoint = history[openIndex]
  const entryPlan = plans.find((plan) => plan.intent !== 'close')
  events.push({
    id: `${position.id}-open`,
    kind: 'open',
    time: openPoint.time,
    price: openPoint.value,
    title: `Opened ${position.symbol}`,
    summary: `Bought ${formatQty(position.quantity)} ${unit} to open at ${formatMoney(position.avgCost)}.`,
    facts: [
      { label: 'Side', value: 'Buy to open' },
      { label: 'Filled', value: `${formatQty(position.quantity)} ${unit}` },
      { label: 'Avg fill', value: formatMoney(position.avgCost) },
      {
      label: 'Notional',
      value: formatMoney(position.avgCost * position.quantity * multiplier, { whole: true }),
    },
      // Slippage, VWAP gap and an order id are all fiction — the backend has
      // no fill-quality record and plt's order ids are not these.
      ...(synthetic ? executionQuality(rand, position.avgCost, openPoint.value) : []),
      ...(synthetic ? [{ label: 'Order', value: orderId(rand) }] : []),
      ...(entryPlan
        ? [
            { label: 'Entry plan', value: entryPlan.source === 'ai' ? 'StratFolio AI' : 'You' },
            {
              label: 'Planned entry',
              value: `${formatMoney(entryPlan.entryLow)}–${formatMoney(entryPlan.entryHigh)}`,
            },
            { label: 'Planned stop', value: formatMoney(entryPlan.stop) },
          ]
        : []),
    ],
    prompt: entryPlan?.originalPrompt,
  })

  // ---- Scale-ins and trims ----------------------------------------------
  // Entirely invented: the app has no scale-in/trim history for any position.
  const fillCount = synthetic ? 1 + Math.floor(rand() * 3) : 0
  const window = history.length - openIndex - 2
  for (let i = 0; i < fillCount && window > 4; i++) {
    const index = openIndex + 2 + Math.floor(((i + 1) / (fillCount + 1)) * window)
    const point = history[index]
    if (!point) continue
    const trim = rand() > 0.45
    const share = 0.2 + rand() * 0.3
    const size = Math.max(1, Math.round(position.quantity * share))
    const realised = (point.value - position.avgCost) * size * multiplier

    events.push({
      id: `${position.id}-fill-${i}`,
      kind: trim ? 'trim' : 'add',
      time: point.time,
      price: point.value,
      title: trim ? `Trimmed ${formatQty(size)} ${unit}` : `Added ${formatQty(size)} ${unit}`,
      summary: trim
        ? `Sold ${formatQty(size)} ${unit} into strength at ${formatMoney(point.value)}.`
        : `Scaled in ${formatQty(size)} ${unit} at ${formatMoney(point.value)}.`,
      facts: [
        { label: 'Side', value: trim ? 'Sell to close' : 'Buy to open' },
        { label: 'Filled', value: `${formatQty(size)} ${unit}` },
        { label: 'Fill price', value: formatMoney(point.value) },
        { label: '% of position', value: `${Math.round(share * 100)}%` },
        ...(trim
          ? [
              {
                label: 'Realised P/L',
                value: formatMoney(realised, { whole: true }),
                tone: (realised >= 0 ? 'up' : 'down') as 'up' | 'down',
              },
            ]
          : [
              {
                label: 'Added cost',
                value: formatMoney(point.value * size * multiplier, { whole: true }),
              },
            ]),
        ...executionQuality(rand, point.value, point.value),
        { label: 'Order', value: orderId(rand) },
      ],
    })
  }

  // ---- Plan lifecycle ----------------------------------------------------
  plans.slice(0, 3).forEach((plan, i) => {
    // Demo placement: plans are all created "recently", which would stack
    // their markers on the right edge underneath the live price callout.
    // Spreading them across the left half keeps every marker clickable.
    const index = Math.round(history.length * (0.12 + i * 0.13))
    const point = history[Math.min(index, history.length - 1)]
    if (!point) return

    events.push({
      id: `${position.id}-plan-${plan.id}`,
      kind: i === 0 ? 'plan_created' : 'plan_updated',
      time: point.time,
      price: point.value,
      title:
        i === 0 ? `${plan.source === 'ai' ? 'AI' : 'Your'} plan created` : 'Plan updated',
      summary: plan.title,
      prompt: plan.originalPrompt,
      facts: [
        { label: 'Author', value: plan.source === 'ai' ? 'StratFolio AI' : 'You' },
        { label: 'Intent', value: plan.intent === 'close' ? 'Close exposure' : 'Open exposure' },
        { label: 'Trigger', value: `${formatMoney(plan.entryLow)}–${formatMoney(plan.entryHigh)}` },
        { label: 'Target', value: `${formatMoney(plan.targetLow)}–${formatMoney(plan.targetHigh)}` },
        { label: 'Stop', value: formatMoney(plan.stop) },
        ...(plan.maxAmount ? [{ label: 'Max size', value: formatMoney(plan.maxAmount) }] : []),
        { label: 'Status', value: plan.status },
      ],
    })
  })

  return events.sort((a, b) => a.time - b.time)
}

/**
 * Slippage and the gap to the session VWAP — the two numbers a trader checks
 * first when auditing a fill.
 */
function executionQuality(
  rand: () => number,
  fill: number,
  reference: number,
): PositionEventFact[] {
  const slippage = (rand() - 0.5) * Math.max(0.01, reference * 0.006)
  const vwapGap = (rand() - 0.5) * Math.max(0.01, reference * 0.01)
  return [
    {
      label: 'Slippage',
      value: `${slippage >= 0 ? '+' : '−'}${formatMoney(Math.abs(slippage))}`,
      tone: slippage <= 0 ? 'up' : 'down',
    },
    {
      label: 'vs VWAP',
      value: `${vwapGap >= 0 ? '+' : '−'}${((Math.abs(vwapGap) / Math.max(fill, 0.01)) * 100).toFixed(2)}%`,
      tone: vwapGap <= 0 ? 'up' : 'down',
    },
  ]
}

function orderId(rand: () => number): string {
  return `SF-${Math.floor(rand() * 0xfffff).toString(16).toUpperCase().padStart(5, '0')}`
}

function nearestIndex(history: HistoryPoint[], time: number): number {
  let best = 0
  let bestGap = Number.POSITIVE_INFINITY
  history.forEach((point, index) => {
    const gap = Math.abs(point.time - time)
    if (gap < bestGap) {
      bestGap = gap
      best = index
    }
  })
  return Math.min(best, history.length - 1)
}

export function formatEventTimestamp(time: number): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(time * 1000))
}
