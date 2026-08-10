import { latency } from '@/api/mock/latency'
import type { AssistantApi, AssistantReply } from '@/api/portfolioApi'

type Intent = 'exit-timing' | 'roll-trim' | 'thesis-check' | 'macro' | 'risk' | 'generic'

function classify(question: string): { intent: Intent; symbol?: string } {
  const q = question.toLowerCase()
  // Allow a plural ("my PLTRs") — people pluralise tickers constantly and the
  // symbol-specific answer is much better than the generic one.
  const symbolMatch = question
    .toUpperCase()
    .match(/\b(SNDK|MU|PLTR|NVDA|TSLA|AAPL|MSFT|AMD|SOFI|SPY|MRVL|VRT|SMCI|WDC|TSM|ASML|COIN|AVGO|CRDO|UBER|NEE|ARM)S?\b/)
  const symbol = symbolMatch?.[1]

  if (/\b(sell|exit|take profit|when should i|get out|close)\b/.test(q)) {
    return { intent: 'exit-timing', symbol }
  }
  if (/\b(roll|trim|add|average|size|scale)\b/.test(q)) return { intent: 'roll-trim', symbol }
  if (/\b(why|thesis|conviction|view|think about)\b/.test(q)) return { intent: 'thesis-check', symbol }
  if (/\b(memory|selloff|macro|china|korea|capex|rates|fed|cycle)\b/.test(q)) {
    return { intent: 'macro', symbol }
  }
  if (/\b(risk|downside|lose|wrong|hedge)\b/.test(q)) return { intent: 'risk', symbol }
  return { intent: 'generic', symbol }
}

const BY_SYMBOL: Record<string, string> = {
  PLTR:
    'You hold 30 of the Jan 15 $95 calls at $6.20 — roughly 25% out of the money with the November 4 print and the February guide both inside the contract. The rating is HOLD, not SELL: US commercial customer count is compounding at 64% and that is the healthiest line in the P&L. The risk here is valuation, which is precisely why it is expressed as defined-risk premium rather than stock. Exit against the catalyst — trim into the November print rather than through it, because implied volatility is what you are being paid for.',
  SNDK:
    'You are in SanDisk twice: 18 of the Nov 20 $135 calls at $8.40 and 25 of the Dec 18 $150 calls at $7.60. The November leg is the better expression — closer to the money and it spans the Oct 29 print with three weeks of cushion. Plan: trim half the November calls above $24 and let the balance run into earnings. The December leg is underwater and struck 11% higher; hold it, but do not average down. If NAND contract pricing prints negative twice, both legs come off.',
  MU:
    'The Micron Jan 15 $155 calls are the highest-conviction contract in the book at 86/100 — 16 contracts at $5.85, about 30% out of the money. The whole point of January rather than October is that it spans two prints, Sep 24 and Dec 17, so one soft quarter does not end the trade. Scale out in thirds above $26. The pre-committed invalidation is two consecutive negative DRAM contract prints, at which point you sell whatever premium is left rather than hoping.',
  NVDA:
    'You hold 9 of the Dec 18 $220 calls at $10.60. The rating is TRIM, and that is a sizing decision rather than a conviction downgrade — conviction is 88/100 and rose 6 today. The NVDA complex is the largest single-name exposure in the book and above the 20% concentration guardrail. Take a third off into the Nov 18 print; close the balance if it is up more than 120%.',
  TSLA:
    'The TSLA position is 8 of the Jan 15 $280 puts at $18.40 — the only bearish expression in the book, and the one contract that does not move with the semis sleeve. Four consecutive months of double-digit European registration declines against four new sub-€30k competitors is a demand problem, not a pricing one. Hold: the contract spans both the October print and the January delivery number.',
  SMCI:
    'SMCI is the worst position you own: 40 of the Nov 20 $55 calls at $3.40, deep out of the money with conviction at 38/100 and a REDUCE rating. Server assembly captures AI volume without capturing pricing power, and gross margin has compressed four quarters running. The contract needs a 34% move to matter and the premium is decaying against it — treat this as the funding source for additions elsewhere.',
  WDC:
    'You hold 22 of the Dec 18 $115 calls at $5.20. This is the indiscriminate part of the memory selloff — WDC was sold with the NAND complex despite nearline HDD being a separate, contracted, currently tight market. Pricing for the period is already agreed, which makes the Oct 22 print closer to a known-catalyst event. Take half off above $15 and let the rest run.',
  VRT:
    'The Vertiv Feb 19 $195 calls are the diversifying leg — 14 contracts at $9.30. Power and thermal is the physical bottleneck on the AGI buildout, and this is the one contract in the sleeve that does not trade with the Korean liquidation flow. Two prints inside one premium. Trim a third above $28 and carry the balance to the February guide.',
  AMD:
    'The AMD Oct 16 $185 calls are a structural error rather than a thesis error: that expiry falls eleven days before the Oct 27 print that would deliver the MI400 catalyst. You are holding a catalyst trade that expires before the catalyst. Roll out to January. Implied volatility is in the 38th percentile so the roll is not expensive.',
}

const GENERIC: Record<Intent, string> = {
  'exit-timing':
    'Exit timing should be decided by the thesis, not the P/L. Every contract in this book has a written invalidation — for the memory legs it is two consecutive negative DRAM contract prints. Set the exit against the catalyst: trim into the earnings print rather than through it, because implied volatility is what you are being paid for, and it collapses the moment the print lands.',
  'roll-trim':
    'Rolling makes sense when the thesis is intact but the calendar is not. The AMD Oct 16 calls are the clearest example — that expiry falls before the Oct 27 print, so you hold a catalyst trade that expires before the catalyst. Roll those to January. Trimming is a different decision: NVDA is above the 20% concentration guardrail, so trim there regardless of how good the thesis looks.',
  'thesis-check':
    'The book runs one coherent macro thesis: memory and AI-infrastructure names are being liquidated by forced sellers into a China domestic-substitute scare that has overshot, while the structural AGI capex build compounds underneath. Every position is a long-dated, slightly-to-genuinely OTM contract spanning at least one earnings print, so downside is capped at premium and the convexity is left open.',
  macro:
    'The mechanic worth understanding is that this is a flow dislocation rather than a fundamental one. Korean institutional unwinds have been dumping memory-complex exposure into a thin tape, and the China AI copycat scare gave that selling a narrative. But domestic NAND and DRAM capacity is trailing-node — it does not touch the enterprise bit demand the AGI buildout actually consumes. Contract pricing has already turned. That gap between the tape and the data is the entry.',
  risk:
    'The honest risks are concentration and correlation. Most of the book is one macro bet — semis, memory and AI infrastructure move together, so a single capex-digestion headline hits everything at once. Every leg is defined-risk by construction, but "defined" still means the full premium. Vertiv and the TSLA put are the deliberate diversifiers because neither trades with the Korean liquidation flow.',
  generic:
    'I can talk through any contract in the book — the thesis behind it, how it is tracking against its catalyst, and what the exit plan is. The sleeve is deliberately built as long-dated OTM contracts spanning earnings prints, so most questions come down to two: is the catalyst still ahead of us, and is the thesis still intact?',
}

/**
 * Mocked portfolio assistant.
 *
 * Intent-matched canned responses in the same analyst voice as the rest of the
 * book, referencing the actual seeded positions so it never contradicts the
 * numbers on screen. Swapping in a real model call means replacing this class
 * only — the component talks to the interface.
 */
export class MockAssistantApi implements AssistantApi {
  async ask(question: string): Promise<AssistantReply> {
    // Deliberately slow enough that the typing indicator is visible.
    await latency(1400)
    const { intent, symbol } = classify(question)

    if (symbol && BY_SYMBOL[symbol]) {
      return { text: BY_SYMBOL[symbol], intent, symbol }
    }
    return { text: GENERIC[intent], intent, symbol }
  }
}

export const mockAssistantApi = new MockAssistantApi()
