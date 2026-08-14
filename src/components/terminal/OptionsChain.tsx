import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronUp, Minus, SendHorizonal, Sparkles } from 'lucide-react'
import { cn } from '@/lib/cn'
import { blackScholes } from '@/lib/blackScholes'
import { chainImpliedVol } from '@/lib/terminalSeries'
import { useTerminalStore } from '@/store/terminalStore'

/**
 * Compact options chain for the terminal chart's right gutter: one expiry at a
 * time (15 to pick from), 15 strikes centred on spot, calls' bid/ask on the
 * left of the strike ladder and puts' on the right. Everything is priced with
 * the app's Black–Scholes module off the live quote, with a volatility smile
 * seeded per symbol so the surface holds still while the mids tick.
 */

const STRIKE_ROWS = 15
const EXPIRY_COUNT = 15

interface Expiry {
  date: Date
  label: string
  dte: number
  years: number
}

/** Next 8 weekly Fridays, then monthly (third-Friday) expiries after those. */
function buildExpiries(now: Date): Expiry[] {
  const out: Date[] = []
  const friday = new Date(now)
  friday.setHours(16, 0, 0, 0)
  friday.setDate(friday.getDate() + ((5 - friday.getDay() + 7) % 7 || 7))
  for (let i = 0; i < 8; i++) {
    out.push(new Date(friday))
    friday.setDate(friday.getDate() + 7)
  }
  let month = friday.getMonth()
  let year = friday.getFullYear()
  while (out.length < EXPIRY_COUNT) {
    const third = thirdFriday(year, month)
    if (third > out[out.length - 1]) out.push(third)
    month += 1
    if (month > 11) {
      month = 0
      year += 1
    }
  }
  return out.slice(0, EXPIRY_COUNT).map((date) => {
    const dte = Math.max(1, Math.round((date.getTime() - now.getTime()) / 86_400_000))
    return {
      date,
      dte,
      years: Math.max(dte / 365, 1 / 365),
      label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }).replace(', ', " '"),
    }
  })
}

function thirdFriday(year: number, month: number): Date {
  const first = new Date(year, month, 1, 16, 0, 0, 0)
  const offset = (5 - first.getDay() + 7) % 7
  return new Date(year, month, 1 + offset + 14, 16, 0, 0, 0)
}

function strikeStep(spot: number): number {
  if (spot < 25) return 1
  if (spot < 100) return 2.5
  if (spot < 250) return 5
  if (spot < 600) return 10
  if (spot < 1200) return 25
  return 50
}

function buildStrikes(spot: number): number[] {
  const step = strikeStep(spot)
  const atm = Math.round(spot / step) * step
  const half = Math.floor(STRIKE_ROWS / 2)
  return Array.from({ length: STRIKE_ROWS }, (_, i) => atm + (i - half) * step)
}

/** Shared with the terminal chart so chain quotes and the option chart agree. */
const impliedVol = chainImpliedVol

interface QuotePair {
  bid: number
  ask: number
}

function quoteFor(mid: number, spot: number): QuotePair {
  const spread = Math.max(0.02, mid * 0.028 + spot * 0.0002)
  const bid = Math.max(0, mid - spread / 2)
  return { bid, ask: bid + spread }
}

const money = (v: number) => (v >= 1000 ? v.toFixed(0) : v.toFixed(2))

type Right = 'CALL' | 'PUT'

interface ContractAnalysis {
  label: string
  question: string
  pricedAt: number
  entry: number
  bid: number
  ask: number
  spreadPct: number
  targetPremium: number
  targetPct: number
  underlyingAtTarget: number
  stopPremium: number
  stopPct: number
  breakeven: number
  maxLossPerContract: number
  gainAtTargetPerContract: number
  pop: number
  delta: number
  thetaPerContract: number
  thetaBleedPct: number
  risks: string[]
}

/** Deterministic desk-style read on one contract, straight off the pricer. */
function analyzeContract(
  symbol: string,
  spot: number,
  strike: number,
  right: Right,
  expiry: Expiry,
  question: string,
): ContractAnalysis {
  const volatility = impliedVol(symbol, spot, strike, expiry.years)
  const bs = blackScholes({ spot, strike, years: expiry.years, volatility, right })
  const { bid, ask } = quoteFor(bs.price, spot)
  const mid = (bid + ask) / 2
  const spreadPct = mid > 0 ? ((ask - bid) / mid) * 100 : 0
  // Work below mid on wide markets; near mid on tight ones.
  const entry = Math.max(0.05, bid + (ask - bid) * (spreadPct > 6 ? 0.35 : 0.45))

  const otmPct = right === 'CALL' ? (strike / spot - 1) * 100 : (1 - strike / spot) * 100
  const aggressive = otmPct > 4 || expiry.dte <= 10
  const targetPct = aggressive ? 90 : 55
  const stopPct = aggressive ? 45 : 30
  const targetPremium = entry * (1 + targetPct / 100)
  const stopPremium = entry * (1 - stopPct / 100)
  const delta = Math.abs(bs.delta)
  const move = (targetPremium - entry) / Math.max(delta, 0.06)
  const underlyingAtTarget = right === 'CALL' ? spot + move : spot - move
  const breakeven = right === 'CALL' ? strike + entry : strike - entry
  const thetaPerContract = Math.abs(bs.theta) * 100
  const thetaBleedPct = entry > 0 ? (Math.abs(bs.theta) / entry) * 100 : 0

  const risks: string[] = []
  risks.push(
    `Theta bleeds ≈ $${thetaPerContract.toFixed(0)}/day per contract (${thetaBleedPct.toFixed(1)}%/day)${expiry.dte <= 21 ? ' and accelerates into expiry' : ''}.`,
  )
  if (spreadPct > 5)
    risks.push(`Market is ${spreadPct.toFixed(0)}% wide — never pay the ask; work limit orders.`)
  else risks.push('Spread is tight now but widens off-hours; use limits regardless.')
  if (expiry.dte > 25)
    risks.push('An earnings print inside this tenor risks IV crush against the position.')
  else if (otmPct > 4)
    risks.push(`Needs ${symbol} ${right === 'CALL' ? 'up' : 'down'} ${otmPct.toFixed(1)}% just to reach the strike — P(ITM) is ${(bs.probabilityItm * 100).toFixed(0)}%.`)
  else risks.push('Short tenor leaves no room to be early — size to the max loss.')

  return {
    label: `${symbol} $${strike % 1 === 0 ? strike : strike.toFixed(1)}${right === 'CALL' ? 'C' : 'P'} · ${expiry.label}`,
    question,
    pricedAt: spot,
    entry,
    bid,
    ask,
    spreadPct,
    targetPremium,
    targetPct,
    underlyingAtTarget,
    stopPremium,
    stopPct,
    breakeven,
    maxLossPerContract: entry * 100,
    gainAtTargetPerContract: (targetPremium - entry) * 100,
    pop: bs.probabilityItm * 100,
    delta,
    thetaPerContract,
    thetaBleedPct,
    risks,
  }
}

/**
 * Custom expiry dropdown. A native <select> pops its OS menu wherever the
 * platform pleases, which drifts badly away from this compact trigger — so
 * the menu is a real anchored listbox instead.
 */
function ExpiryPicker({
  expiries,
  value,
  onChange,
  className,
}: {
  expiries: Expiry[]
  value: number
  onChange: (index: number) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const current = expiries[value]

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Expiration date"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'num flex items-center gap-1.5 rounded-md border py-1 pr-1.5 pl-2 text-[10.5px] font-bold text-ink outline-none transition-colors',
          open
            ? 'border-brand-300/40 bg-[#182130]'
            : 'border-line bg-[#141b26] hover:border-brand-300/40',
        )}
      >
        {current.label} · {current.dte}d
        <ChevronDown
          size={12}
          className={cn('text-ink-muted transition-transform', open && 'rotate-180')}
        />
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close expiration list"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <ul
            role="listbox"
            aria-label="Expiration dates"
            className="no-scrollbar absolute top-full right-0 z-40 mt-1 max-h-[300px] w-[150px] overflow-y-auto rounded-xl border border-line bg-[#141b26]/97 p-1 shadow-[0_22px_50px_-16px_rgba(0,0,0,0.9)] backdrop-blur-md"
          >
            {expiries.map((exp, i) => (
              <li key={exp.label}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === value}
                  onClick={() => {
                    onChange(i)
                    setOpen(false)
                  }}
                  className={cn(
                    'num flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[10.5px] font-bold transition-colors',
                    i === value
                      ? 'bg-brand-400/[0.16] text-brand-200'
                      : 'text-ink-soft hover:bg-white/[0.05] hover:text-ink',
                  )}
                >
                  {exp.label}
                  <span className={cn('text-[9px] font-semibold', i === value ? 'text-brand-300' : 'text-ink-muted')}>
                    {exp.dte}d
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  )
}

export function OptionsChain({
  symbol,
  spot,
  className,
}: {
  symbol: string
  spot: number | undefined
  className?: string
}) {
  const expiries = useMemo(() => buildExpiries(new Date()), [])
  const [expiryIndex, setExpiryIndex] = useState(2)
  const expiry = expiries[expiryIndex]

  const rows = useMemo(() => {
    if (!spot) return []
    return buildStrikes(spot).map((strike) => {
      const volatility = impliedVol(symbol, spot, strike, expiry.years)
      const call = blackScholes({ spot, strike, years: expiry.years, volatility, right: 'CALL' })
      const put = blackScholes({ spot, strike, years: expiry.years, volatility, right: 'PUT' })
      return {
        strike,
        call: quoteFor(call.price, spot),
        put: quoteFor(put.price, spot),
      }
    })
  }, [symbol, spot, expiry])

  const atmIndex = useMemo(() => {
    if (!spot || rows.length === 0) return -1
    let best = 0
    for (let i = 1; i < rows.length; i++)
      if (Math.abs(rows[i].strike - spot) < Math.abs(rows[best].strike - spot)) best = i
    return best
  }, [rows, spot])

  /* ---------- contract selection + ask-AI dock ---------- */
  const contract = useTerminalStore((s) => s.contract)
  const setContract = useTerminalStore((s) => s.setContract)
  const picked = contract ? { strike: contract.strike, right: contract.right } : null
  const pick = (strike: number, right: Right) =>
    setContract({
      strike,
      right,
      expiryLabel: expiry.label,
      expiryTime: Math.floor(expiry.date.getTime() / 1000),
      dte: expiry.dte,
    })
  const [question, setQuestion] = useState('')
  const [analysis, setAnalysis] = useState<ContractAnalysis | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [thinking, setThinking] = useState(false)
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // A new symbol is a different book: clear selection and any open analysis.
  useEffect(() => {
    setAnalysis(null)
    setPanelOpen(false)
    setThinking(false)
  }, [symbol])

  useEffect(() => () => { if (pendingRef.current) clearTimeout(pendingRef.current) }, [])

  const selected = useMemo(() => {
    if (picked && rows.some((row) => row.strike === picked.strike)) return picked
    if (atmIndex >= 0) return { strike: rows[atmIndex].strike, right: 'CALL' as Right }
    return null
  }, [picked, rows, atmIndex])

  const ask = (event: React.FormEvent) => {
    event.preventDefault()
    const q = question.trim()
    if (!q || !spot || !selected || thinking) return
    setQuestion('')
    setPanelOpen(true)
    setThinking(true)
    if (pendingRef.current) clearTimeout(pendingRef.current)
    pendingRef.current = setTimeout(() => {
      setAnalysis(analyzeContract(symbol, spot, selected.strike, selected.right, expiry, q))
      setThinking(false)
    }, 850)
  }

  return (
    <aside className={cn('flex min-w-0 flex-col', className)} aria-label={`${symbol} options chain`}>
      {/* ---------- expiry picker ---------- */}
      <div className="flex items-center gap-1.5 border-b border-line px-2.5 py-2">
        <span className="text-[9px] font-extrabold tracking-[0.09em] text-ink-muted uppercase">
          Chain
        </span>
        <ExpiryPicker
          expiries={expiries}
          value={expiryIndex}
          onChange={setExpiryIndex}
          className="ml-auto"
        />
      </div>

      {/* ---------- column headers ---------- */}
      <div className="grid grid-cols-[1fr_1fr_minmax(44px,0.9fr)_1fr_1fr] items-center gap-x-1 border-b border-line px-2.5 pt-1.5 pb-1 text-center">
        <span className="col-span-2 text-[8.5px] font-extrabold tracking-[0.08em] text-up/80 uppercase">
          Calls
        </span>
        <span className="text-[8.5px] font-extrabold tracking-[0.08em] text-ink-muted uppercase">
          Strike
        </span>
        <span className="col-span-2 text-[8.5px] font-extrabold tracking-[0.08em] text-down/80 uppercase">
          Puts
        </span>
        <span className="text-[8px] font-semibold text-ink-muted/70">Bid</span>
        <span className="text-[8px] font-semibold text-ink-muted/70">Ask</span>
        <span />
        <span className="text-[8px] font-semibold text-ink-muted/70">Bid</span>
        <span className="text-[8px] font-semibold text-ink-muted/70">Ask</span>
      </div>

      {/* ---------- ladder (+ AI analysis overlay) ---------- */}
      <div className="relative min-h-0 flex-1">
        <div className="no-scrollbar h-full overflow-y-auto py-0.5">
          {rows.map((row, i) => {
            const callItm = spot !== undefined && row.strike < spot
            const putItm = spot !== undefined && row.strike > spot
            const atm = i === atmIndex
            const callPicked = selected?.strike === row.strike && selected.right === 'CALL'
            const putPicked = selected?.strike === row.strike && selected.right === 'PUT'
            return (
              <div
                key={row.strike}
                className={cn(
                  'mx-1 grid grid-cols-[2fr_minmax(44px,0.9fr)_2fr] items-center gap-x-1 rounded-md px-1 py-[1.5px] text-center',
                  atm && 'bg-brand-400/[0.12] ring-1 ring-brand-300/25 ring-inset',
                )}
              >
                <button
                  type="button"
                  onClick={() => pick(row.strike, 'CALL')}
                  aria-pressed={callPicked}
                  aria-label={`Select ${symbol} ${row.strike} call`}
                  className={cn(
                    'grid grid-cols-2 items-center gap-x-1 rounded px-0.5 py-[2px] transition-colors hover:bg-white/[0.05]',
                    callPicked && 'bg-up/[0.12] ring-1 ring-up/40 ring-inset',
                  )}
                >
                  <span className={cn('num text-[9.5px]', callItm ? 'text-up/90' : 'text-ink-soft')}>
                    {money(row.call.bid)}
                  </span>
                  <span className={cn('num text-[9.5px] font-bold', callItm ? 'text-up' : 'text-ink')}>
                    {money(row.call.ask)}
                  </span>
                </button>
                <span
                  className={cn(
                    'num rounded text-[10px] font-extrabold',
                    atm ? 'text-brand-200' : 'text-ink-soft',
                  )}
                >
                  {row.strike % 1 === 0 ? row.strike : row.strike.toFixed(1)}
                </span>
                <button
                  type="button"
                  onClick={() => pick(row.strike, 'PUT')}
                  aria-pressed={putPicked}
                  aria-label={`Select ${symbol} ${row.strike} put`}
                  className={cn(
                    'grid grid-cols-2 items-center gap-x-1 rounded px-0.5 py-[2px] transition-colors hover:bg-white/[0.05]',
                    putPicked && 'bg-down/[0.12] ring-1 ring-down/40 ring-inset',
                  )}
                >
                  <span className={cn('num text-[9.5px]', putItm ? 'text-down/90' : 'text-ink-soft')}>
                    {money(row.put.bid)}
                  </span>
                  <span className={cn('num text-[9.5px] font-bold', putItm ? 'text-down' : 'text-ink')}>
                    {money(row.put.ask)}
                  </span>
                </button>
              </div>
            )
          })}
          {rows.length === 0 ? (
            <p className="px-3 py-6 text-center text-[10px] text-ink-muted">Waiting for quote…</p>
          ) : null}
        </div>

        {/* Analysis slides up over the ladder; minimizing restores the chain. */}
        <AnimatePresence>
          {panelOpen ? (
            <motion.div
              key="contract-analysis"
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 26 }}
              transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
              className="absolute inset-0 z-10 flex flex-col bg-[#10161f]/97 backdrop-blur-[3px]"
              role="region"
              aria-label="StratFolio AI contract analysis"
            >
              <div className="flex items-center gap-1.5 border-b border-line px-2.5 py-1.5">
                <Sparkles size={11} className="shrink-0 text-brand-300" />
                <span className="num min-w-0 truncate text-[10px] font-extrabold text-ink">
                  {analysis?.label ??
                    (selected ? `${symbol} $${selected.strike}${selected.right === 'CALL' ? 'C' : 'P'} · ${expiry.label}` : '')}
                </span>
                <button
                  type="button"
                  onClick={() => setPanelOpen(false)}
                  aria-label="Minimize analysis and show the chain"
                  className="ml-auto grid h-6 w-6 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-white/[0.08] hover:text-ink"
                >
                  <Minus size={13} strokeWidth={2.5} />
                </button>
              </div>

              <div className="no-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto px-2.5 py-2">
                {analysis ? (
                  <>
                    <p className="ml-4 rounded-xl rounded-br-sm bg-brand-500/90 px-2.5 py-1.5 text-[10px] leading-snug font-semibold text-white">
                      {analysis.question}
                    </p>

                    <AnalysisBlock title="Entry">
                      Work ≈ <B>${analysis.entry.toFixed(2)}</B> (bid {analysis.bid.toFixed(2)} /
                      ask {analysis.ask.toFixed(2)}, {analysis.spreadPct.toFixed(0)}% wide) — priced
                      with {symbol} at ${analysis.pricedAt.toFixed(2)}.
                    </AnalysisBlock>
                    <AnalysisBlock title="Exit">
                      Target <B tone="up">${analysis.targetPremium.toFixed(2)}</B> (+
                      {analysis.targetPct}%), ≈ {symbol} at ${analysis.underlyingAtTarget.toFixed(2)}.
                      Stop <B tone="down">${analysis.stopPremium.toFixed(2)}</B> (−{analysis.stopPct}
                      %). Breakeven at expiry ${analysis.breakeven.toFixed(2)}.
                    </AnalysisBlock>
                    <AnalysisBlock title="P&L per contract">
                      Risking <B tone="down">${analysis.maxLossPerContract.toFixed(0)}</B> max to
                      make <B tone="up">+${analysis.gainAtTargetPerContract.toFixed(0)}</B> at
                      target · P(ITM) {analysis.pop.toFixed(0)}% · Δ {analysis.delta.toFixed(2)}.
                    </AnalysisBlock>
                    <AnalysisBlock title="Risks">
                      <ul className="space-y-1">
                        {analysis.risks.map((risk) => (
                          <li key={risk} className="flex gap-1.5">
                            <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-[#f5c26b]" />
                            {risk}
                          </li>
                        ))}
                      </ul>
                    </AnalysisBlock>
                    <p className="px-0.5 text-[8px] text-ink-muted/75">
                      Simulated analysis · not investment advice
                    </p>
                  </>
                ) : (
                  <div className="flex items-center gap-1.5 pt-2 pl-1" aria-label="Analyzing contract">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-brand-300"
                        animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.16 }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* ---------- ask-AI dock ---------- */}
      <form onSubmit={ask} className="border-t border-line px-2 py-1.5">
        <div className="flex items-center gap-1">
          {analysis && !panelOpen ? (
            <button
              type="button"
              onClick={() => setPanelOpen(true)}
              aria-label={`Reopen analysis for ${analysis.label}`}
              className="grid h-7 w-7 shrink-0 place-items-center text-brand-300 transition-colors hover:text-brand-200"
            >
              <ChevronUp size={13} strokeWidth={2.5} />
            </button>
          ) : null}
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask AI about this contract"
            aria-label={
              selected
                ? `Ask AI about the ${symbol} ${selected.strike} ${selected.right.toLowerCase()}`
                : 'Ask AI about this contract'
            }
            className="h-7 min-w-0 flex-1 rounded-lg border border-line bg-black/20 px-2 text-[10px] text-ink placeholder:text-ink-muted focus:border-brand-400/40 focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Send question to StratFolio AI"
            disabled={!question.trim() || thinking || !selected}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-500 text-white transition-opacity disabled:opacity-35"
          >
            <SendHorizonal size={12} />
          </button>
        </div>
        <p className="num mt-1 truncate px-0.5 text-[8px] text-ink-muted/75">
          {selected
            ? `On ${symbol} $${selected.strike % 1 === 0 ? selected.strike : selected.strike.toFixed(1)}${selected.right === 'CALL' ? 'C' : 'P'} · ${expiry.label} — tap a bid/ask to switch`
            : 'Simulated chain · quotes track the live price'}
        </p>
      </form>
    </aside>
  )
}

function B({ children, tone }: { children: React.ReactNode; tone?: 'up' | 'down' }) {
  return (
    <b className={cn('num font-extrabold', tone === 'up' ? 'text-up' : tone === 'down' ? 'text-down' : 'text-ink')}>
      {children}
    </b>
  )
}

function AnalysisBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-white/[0.03] px-2 py-1.5">
      <div className="text-[8px] font-extrabold tracking-[0.08em] text-brand-300 uppercase">
        {title}
      </div>
      <div className="num mt-0.5 text-[9.5px] leading-relaxed text-ink-soft">{children}</div>
    </div>
  )
}
