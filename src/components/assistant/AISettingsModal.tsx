import { useMemo, useState } from 'react'
import { BotMessageSquare, Eraser, RotateCcw, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Modal } from '@/components/ui/Modal'
import { blackScholes } from '@/lib/blackScholes'
import { SYMBOL_MAP } from '@/api/mock/seededData'
import { usePrice } from '@/store/priceStore'
import { useTerminalStore } from '@/store/terminalStore'
import { useUiStore } from '@/store/uiStore'
import { useAiSettingsStore, type ApprovalMode, type TradingWindow } from '@/store/aiSettingsStore'
import { useAssistantChatStore } from '@/store/assistantChatStore'
import { useRepromptStore } from '@/store/repromptStore'
import { useOrderToastStore } from '@/store/orderToastStore'

/**
 * Configuration for the StratFolio trading agent, opened from the AI panel's
 * "AI settings" button. The headline control is the risk/reward dial: it
 * translates directly into the option structures the agent drafts, and the
 * example line below it is priced live off the currently charted symbol so
 * the trade-off is concrete rather than abstract.
 */
export function AISettingsModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const risk = useAiSettingsStore((s) => s.riskAppetite)
  const setRisk = useAiSettingsStore((s) => s.setRiskAppetite)
  const approvalMode = useAiSettingsStore((s) => s.approvalMode)
  const setApprovalMode = useAiSettingsStore((s) => s.setApprovalMode)
  const maxAllocationPct = useAiSettingsStore((s) => s.maxAllocationPct)
  const setMaxAllocationPct = useAiSettingsStore((s) => s.setMaxAllocationPct)
  const tradingWindow = useAiSettingsStore((s) => s.tradingWindow)
  const setTradingWindow = useAiSettingsStore((s) => s.setTradingWindow)
  const circuitBreakerPct = useAiSettingsStore((s) => s.circuitBreakerPct)
  const setCircuitBreakerPct = useAiSettingsStore((s) => s.setCircuitBreakerPct)
  const restoreDefaults = useAiSettingsStore((s) => s.restoreDefaults)

  const aiTradingEnabled = useUiStore((s) => s.aiTradingEnabled)
  const setAiTradingEnabled = useUiStore((s) => s.setAiTradingEnabled)

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="AI Settings"
      description="How the StratFolio agent sizes, structures and executes on your behalf. Applies to every plan it drafts."
    >
      <div className="space-y-4">
        <RiskDial value={risk} onChange={setRisk} />

        {/* ---------- execution ---------- */}
        <section className="space-y-2.5">
          <SectionLabel>Execution</SectionLabel>

          <SettingRow
            title="AI Trading"
            detail={
              aiTradingEnabled
                ? 'The agent may execute approved plans automatically.'
                : 'The agent drafts and monitors, but never executes.'
            }
          >
            <button
              type="button"
              role="switch"
              aria-checked={aiTradingEnabled}
              aria-label={`AI Trading ${aiTradingEnabled ? 'on' : 'off'}`}
              onClick={() => setAiTradingEnabled(!aiTradingEnabled)}
              className={cn(
                'relative h-6 w-11 shrink-0 rounded-full transition-colors',
                aiTradingEnabled
                  ? 'bg-emerald-400/35 shadow-[0_0_10px_rgba(47,255,163,0.25)]'
                  : 'bg-line-strong',
              )}
            >
              <span
                className={cn(
                  'absolute top-1 h-4 w-4 rounded-full transition-[left,background-color] duration-200',
                  aiTradingEnabled
                    ? 'left-6 bg-[#42dda0] shadow-[0_0_8px_rgba(47,255,163,0.6)]'
                    : 'left-1 bg-white',
                )}
              />
            </button>
          </SettingRow>

          <SettingRow
            title="Order approval"
            detail={
              /* Nothing server-side enforces this today (HKP-AI-8): approval
                 mode, the trading window and the day-loss breaker all live in
                 this browser, and a client-side kill switch is not a kill
                 switch. Copy that promises orders "firing the moment criteria
                 are met" also described an autonomous entry loop that does
                 not exist (HKP-XSV-1). */
              approvalMode === 'approve'
                ? 'Every AI order waits for your tap. Saved on this device only.'
                : 'Approved plans skip the confirmation step. Saved on this device only — not yet enforced by the platform.'
            }
          >
            <Segmented
              value={approvalMode}
              onChange={(v) => setApprovalMode(v as ApprovalMode)}
              options={[
                { value: 'approve', label: 'Ask me' },
                { value: 'auto', label: 'Auto' },
              ]}
            />
          </SettingRow>

          <SettingRow title="Max size per AI trade" detail="Ceiling per position, as % of buying power.">
            <Segmented
              value={String(maxAllocationPct)}
              onChange={(v) => setMaxAllocationPct(Number(v))}
              options={[
                { value: '1', label: '1%' },
                { value: '2.5', label: '2.5%' },
                { value: '5', label: '5%' },
                { value: '10', label: '10%' },
              ]}
            />
          </SettingRow>

          <SettingRow title="Trading window" detail="When the agent is allowed to route orders.">
            <Segmented
              value={tradingWindow}
              onChange={(v) => setTradingWindow(v as TradingWindow)}
              options={[
                { value: 'rth', label: 'Market hrs' },
                { value: 'extended', label: 'Extended' },
              ]}
            />
          </SettingRow>

          <SettingRow
            title="Daily circuit breaker"
            detail="Past this portfolio day-loss the agent stands down and alerts you."
            icon={<ShieldAlert size={13} className="text-[#f5c26b]" />}
          >
            <Segmented
              value={String(circuitBreakerPct)}
              onChange={(v) => setCircuitBreakerPct(Number(v))}
              options={[
                { value: '0', label: 'Off' },
                { value: '2', label: '−2%' },
                { value: '5', label: '−5%' },
              ]}
            />
          </SettingRow>
        </section>

        {/* ---------- memory ---------- */}
        <section className="space-y-2.5">
          <SectionLabel>Model memory</SectionLabel>
          <ResetMemoryRow />
          <button
            type="button"
            onClick={restoreDefaults}
            className="flex w-full items-center gap-2.5 rounded-2xl border border-line bg-white/[0.03] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06]"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-500/12 text-brand-300">
              <RotateCcw size={14} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-bold text-ink">Restore default settings</span>
              <span className="block text-[10.5px] text-ink-muted">
                Risk dial and execution controls back to StratFolio defaults.
              </span>
            </span>
          </button>
        </section>

        <p className="px-1 text-[9.5px] leading-relaxed text-ink-muted">
          Settings steer the simulated agent in this demo. Nothing here places real orders.
        </p>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Risk / reward dial                                                  */
/* ------------------------------------------------------------------ */

const RISK_BANDS = [
  { max: 25, name: 'Capital preserving' },
  { max: 50, name: 'Balanced' },
  { max: 75, name: 'Growth seeking' },
  { max: 101, name: 'Max convexity' },
]

function RiskDial({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const symbol = useTerminalStore((s) => s.symbol)
  const quote = usePrice(symbol)
  const band = RISK_BANDS.find((b) => value < b.max) ?? RISK_BANDS[1]

  const example = useMemo(() => {
    const spot = quote?.price
    if (!spot) return null
    const t = value / 100
    const dte = Math.max(7, Math.round(45 - 38 * t))
    const otmPct = -2 + 24 * t
    const step = spot < 25 ? 1 : spot < 100 ? 2.5 : spot < 250 ? 5 : spot < 600 ? 10 : 25
    const strike = Math.max(step, Math.round((spot * (1 + otmPct / 100)) / step) * step)
    const knob = SYMBOL_MAP.get(symbol)?.volatility ?? 1.2
    const volatility = Math.min(2.5, (0.14 + knob * 0.14) * (1 + 0.4 * Math.abs(otmPct) / 22))
    const bs = blackScholes({ spot, strike, years: dte / 365, volatility, right: 'CALL' })
    return {
      dte,
      strike,
      entry: Math.max(bs.price, 0.05),
      pop: Math.round(bs.probabilityItm * 100),
      target: Math.round(25 + 155 * t),
      stop: Math.round(15 + 45 * t),
    }
  }, [quote?.price, symbol, value])

  return (
    <section className="rounded-2xl border border-line bg-white/[0.03] p-3.5">
      <div className="flex items-baseline justify-between">
        <SectionLabel>Risk / reward appetite</SectionLabel>
        <span className="text-[11px] font-extrabold text-brand-200">{band.name}</span>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Risk and reward appetite"
        className="risk-dial mt-3 w-full"
        style={{ ['--risk-pct' as string]: `${value}%` }}
      />
      <div className="mt-1 flex justify-between text-[9px] font-bold tracking-[0.05em] text-ink-muted uppercase">
        <span>Low risk / reward</span>
        <span>High risk / reward</span>
      </div>

      {example ? (
        <div className="mt-3 rounded-xl border border-brand-400/20 bg-brand-500/[0.07] px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-[8.5px] font-extrabold tracking-[0.08em] text-brand-300 uppercase">
            <BotMessageSquare size={11} />
            Example structure at this setting
          </div>
          <p className="num mt-1.5 text-[11.5px] leading-relaxed font-semibold text-ink">
            {symbol} ${example.strike % 1 === 0 ? example.strike : example.strike.toFixed(1)}C ·{' '}
            {example.dte} DTE · entry ≈ ${example.entry.toFixed(2)}
          </p>
          <p className="num mt-0.5 text-[10.5px] text-ink-soft">
            P(ITM) ≈ {example.pop}% · target{' '}
            <span className="font-bold text-up">+{example.target}%</span> · stop{' '}
            <span className="font-bold text-down">−{example.stop}%</span>
          </p>
        </div>
      ) : null}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Reset memory (two-tap confirm)                                      */
/* ------------------------------------------------------------------ */

function ResetMemoryRow() {
  const [arming, setArming] = useState(false)
  const clearConversation = useAssistantChatStore((s) => s.clearConversation)
  const clearReprompts = useRepromptStore((s) => s.clearAll)
  const notify = useOrderToastStore((s) => s.notify)

  const reset = () => {
    clearConversation()
    clearReprompts()
    setArming(false)
    notify({
      kind: 'AI memory reset',
      title: 'Model memory cleared',
      detail: 'Chat history and captured steers removed. The agent starts fresh.',
      tone: 'down',
    })
  }

  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-white/[0.03] px-3 py-2.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#ff4d5e]/12 text-[#ff8b95]">
        <Eraser size={14} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-bold text-ink">Reset model user memory</span>
        <span className="block text-[10.5px] text-ink-muted">
          Clears chat history and every captured steer the model learned from you.
        </span>
      </span>
      {arming ? (
        <span className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setArming(false)}
            className="rounded-lg border border-line px-2.5 py-1.5 text-[10.5px] font-bold text-ink-soft transition-colors hover:text-ink"
          >
            Keep
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-[#ff4d5e] px-2.5 py-1.5 text-[10.5px] font-bold text-white transition-opacity hover:opacity-90"
          >
            Reset
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setArming(true)}
          className="shrink-0 rounded-lg border border-[#ff4d5e]/35 bg-[#ff4d5e]/10 px-2.5 py-1.5 text-[10.5px] font-bold text-[#ff8b95] transition-colors hover:bg-[#ff4d5e]/18"
        >
          Reset…
        </button>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[9.5px] font-extrabold tracking-[0.09em] text-ink-muted uppercase">
      {children}
    </span>
  )
}

function SettingRow({
  title,
  detail,
  icon,
  children,
}: {
  title: string
  detail: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-white/[0.03] px-3 py-2.5">
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[12.5px] font-bold text-ink">
          {title}
          {icon}
        </span>
        <span className="mt-0.5 block text-[10.5px] leading-snug text-ink-muted">{detail}</span>
      </span>
      {children}
    </div>
  )
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="flex shrink-0 rounded-lg border border-line bg-black/20 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-md px-2 py-1 text-[10px] font-bold whitespace-nowrap transition-colors',
            value === option.value
              ? 'bg-brand-500/25 text-brand-200'
              : 'text-ink-muted hover:text-ink',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
