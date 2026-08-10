import type { CreatePlannerIdeaInput } from '@/api/newsTypes'
import { SYMBOL_MAP } from '@/api/mock/seededData'
import { adjustPlanFromPrompt, parseMaxAmountFromPrompt } from '@/lib/planPrompt'

export function plannerInputFromPrompt(prompt: string): CreatePlannerIdeaInput | undefined {
  const cleanPrompt = prompt.trim()
  const symbol = findSymbol(cleanPrompt)
  if (!symbol) return undefined

  const spec = SYMBOL_MAP.get(symbol)
  if (!spec) return undefined
  const adjustment = adjustPlanFromPrompt(cleanPrompt)
  const maxAmount = parseMaxAmountFromPrompt(cleanPrompt) ?? parseLeadingAmount(cleanPrompt) ?? 1000
  const entryMid = midpoint(adjustment.entryLow, adjustment.entryHigh) ?? spec.open
  const doubles = /\b(?:double|doubles|2x)\b/i.test(cleanPrompt)
  const targetMid =
    midpoint(adjustment.targetLow, adjustment.targetHigh) ?? (doubles ? entryMid * 2 : entryMid * 1.25)
  const explicitClose = /^\s*(?:close|trim|exit|sell)\b/i.test(cleanPrompt)

  return {
    symbol,
    company: spec.company,
    assetType: 'stock',
    direction: /\b(?:short|bearish|put)\b/i.test(cleanPrompt) ? 'SHORT' : 'LONG',
    intent: explicitClose ? 'close' : 'open',
    title: `${symbol} AI-organized trade plan`,
    originalPrompt: cleanPrompt,
    notes: cleanPrompt,
    maxAmount: explicitClose ? undefined : maxAmount,
    entryLow: adjustment.entryLow ?? round(entryMid * 0.98),
    entryHigh: adjustment.entryHigh ?? round(entryMid * 1.02),
    targetLow: adjustment.targetLow ?? round(targetMid * 0.95),
    targetHigh: adjustment.targetHigh ?? round(targetMid * 1.05),
    stop: adjustment.stop ?? round(entryMid * 0.85),
    horizon: /\bearnings\b/i.test(cleanPrompt) ? 'Through the next earnings catalyst' : '3–6 months',
    risk: `AI-inferred risk limit near ${round(entryMid * 0.85)}; review before enabling execution.`,
  }
}

function findSymbol(prompt: string): string | undefined {
  return prompt
    .toUpperCase()
    .match(/\b[A-Z.]{1,6}\b/g)
    ?.find((token) => SYMBOL_MAP.has(token))
}

function parseLeadingAmount(prompt: string): number | undefined {
  const match = prompt.match(/^\s*\$?\s*([\d,]+(?:\.\d{1,2})?)(?:\s+|$)/)
  const amount = match ? Number(match[1].replaceAll(',', '')) : Number.NaN
  return Number.isFinite(amount) && amount > 0 ? amount : undefined
}

function midpoint(low?: number, high?: number): number | undefined {
  return low !== undefined && high !== undefined ? (low + high) / 2 : undefined
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}
