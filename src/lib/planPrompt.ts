import type { PlannerIntent, UpdatePlannerIdeaInput } from '@/api/newsTypes'

const MONEY = String.raw`\$?\s*([\d,]+(?:\.\d{1,2})?)`

export interface PlanSizingContext {
  /** Total account value: open positions plus cash. */
  balance: number
  /** Cash currently available in the selected account. */
  cash: number
}

export function parseMaxAmountFromPrompt(
  prompt: string,
  sizing?: PlanSizingContext,
): number | undefined {
  const relativeAmount = sizing ? parseRelativeAmount(prompt, sizing) : undefined
  if (relativeAmount) return relativeAmount

  const patterns = [
    new RegExp(String.raw`\b(?:max(?:imum)?(?:\s+amount)?|cap)\s*(?:of|at|is|:)?\s*${MONEY}`, 'i'),
    new RegExp(String.raw`\bup\s+to\s+${MONEY}(?:\s+per\s+trade)?`, 'i'),
    new RegExp(String.raw`${MONEY}\s*(?:max(?:imum)?|cap)(?:\s+per\s+trade)?\b`, 'i'),
  ]

  for (const pattern of patterns) {
    const match = prompt.match(pattern)
    const amount = match ? Number(match[1].replaceAll(',', '')) : Number.NaN
    if (Number.isFinite(amount) && amount > 0) return amount
  }

  return parseBareAmount(prompt)
}

/**
 * A sizeable bare number in a plan prompt is conventionally the capital cap.
 * Keep the threshold strict so quantities, percentages, and short horizons do
 * not accidentally become dollar sizing.
 */
function parseBareAmount(prompt: string): number | undefined {
  const candidates = prompt.matchAll(/(?:^|[^\d./%])\$?\s*([\d,]+(?:\.\d{1,2})?)(?![\d/%])/g)
  for (const match of candidates) {
    const amount = Number(match[1].replaceAll(',', ''))
    if (Number.isFinite(amount) && amount > 30) return amount
  }
  return undefined
}

export function adjustPlanFromPrompt(
  prompt: string,
  sizing?: PlanSizingContext,
): UpdatePlannerIdeaInput {
  const cleanPrompt = prompt.trim()
  const intent = parseIntent(cleanPrompt)
  const maxAmount = parseMaxAmountFromPrompt(cleanPrompt, sizing)
  const entry =
    parseLevel(cleanPrompt, /\b(?:entry|enter|buy)\b/i) ??
    parseLevel(cleanPrompt, /\bopen\b/i)
  const target = parseLevel(cleanPrompt, /\b(?:target|exit|trim|sell)\b/i)
  const stop = parseLevel(cleanPrompt, /\b(?:stop(?:\s+loss)?|risk\s+floor)\b/i)

  return {
    originalPrompt: cleanPrompt,
    ...(intent ? { intent } : {}),
    ...(maxAmount ? { maxAmount } : {}),
    ...(entry ? rangeFields('entry', entry) : {}),
    ...(target ? rangeFields('target', target) : {}),
    ...(stop ? { stop } : {}),
  }
}

function parseRelativeAmount(prompt: string, sizing: PlanSizingContext): number | undefined {
  const basePattern = String.raw`(?:of|from)\s+(?:my\s+|the\s+)?(?:account\s+|portfolio\s+|available\s+)?(capital|balance|cash)\b`
  const percent = prompt.match(new RegExp(String.raw`\b(\d+(?:\.\d+)?)\s*(?:%|percent)\s+${basePattern}`, 'i'))
  const fraction = prompt.match(new RegExp(String.raw`\b(\d+)\s*\/\s*(\d+)\s+${basePattern}`, 'i'))

  let ratio: number | undefined
  let baseName: string | undefined
  if (percent) {
    ratio = Number(percent[1]) / 100
    baseName = percent[2]
  } else if (fraction) {
    const denominator = Number(fraction[2])
    ratio = denominator > 0 ? Number(fraction[1]) / denominator : undefined
    baseName = fraction[3]
  }

  if (!ratio || !Number.isFinite(ratio) || ratio <= 0 || !baseName) return undefined
  const base = baseName.toLowerCase() === 'cash' ? sizing.cash : sizing.balance
  const amount = Math.round(base * ratio * 100) / 100
  return Number.isFinite(amount) && amount > 0 ? amount : undefined
}

function parseIntent(prompt: string): PlannerIntent | undefined {
  if (/\b(?:close|trim|exit|sell|take\s+profit)\b/i.test(prompt)) return 'close'
  if (/\b(?:open|add|buy|enter|start)\b/i.test(prompt)) return 'open'
  return undefined
}

function parseLevel(prompt: string, prefix: RegExp): number | undefined {
  const prefixMatch = prompt.match(prefix)
  if (!prefixMatch || prefixMatch.index === undefined) return undefined
  const remainder = prompt.slice(prefixMatch.index + prefixMatch[0].length)
  const amountMatch = remainder.match(/^\s*(?:at|near|around|below|above|to|of|:)?\s*\$?\s*([\d,]+(?:\.\d{1,2})?)/i)
  const amount = amountMatch ? Number(amountMatch[1].replaceAll(',', '')) : Number.NaN
  return Number.isFinite(amount) && amount > 0 ? amount : undefined
}

function rangeFields(kind: 'entry' | 'target', midpoint: number) {
  const low = roundCurrency(midpoint * 0.98)
  const high = roundCurrency(midpoint * 1.02)
  return kind === 'entry'
    ? { entryLow: low, entryHigh: high }
    : { targetLow: low, targetHigh: high }
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}
