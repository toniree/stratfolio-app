import type { PlannerIntent, UpdatePlannerIdeaInput } from '@/api/newsTypes'

const MONEY = String.raw`\$?\s*([\d,]+(?:\.\d{1,2})?)`

export function parseMaxAmountFromPrompt(prompt: string): number | undefined {
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
  return undefined
}

export function adjustPlanFromPrompt(prompt: string): UpdatePlannerIdeaInput {
  const cleanPrompt = prompt.trim()
  const intent = parseIntent(cleanPrompt)
  const maxAmount = parseMaxAmountFromPrompt(cleanPrompt)
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
