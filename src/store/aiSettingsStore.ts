import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ApprovalMode = 'approve' | 'auto'
export type TradingWindow = 'rth' | 'extended'

/**
 * AI behaviour preferences.
 *
 * Every field here is **device-local and unenforced** (HKP-AI-8). Nothing
 * server-side checks approval mode, the trading window or the day-loss
 * breaker, and `POST /api/v1/decision-cycles/run` proceeds straight to a plt
 * plan and a bkt execution regardless. `maxAllocationPct` is a second,
 * unenforced copy of a cap PolicyGate already enforces server-side
 * (`policy.max_portfolio_allocation_pct`) — it should be wired to that key or
 * dropped, not duplicated.
 */
export interface AiSettingsState {
  /** 0 = lowest risk / reward, 100 = highest. Drives the agent's structure choice. */
  riskAppetite: number
  /** Whether AI-drafted orders wait for a human tap. Not server-enforced. */
  approvalMode: ApprovalMode
  /** Ceiling for a single AI-initiated position, as % of buying power. */
  maxAllocationPct: number
  tradingWindow: TradingWindow
  /**
   * Day-loss circuit breaker, in percent. 0 = off.
   *
   * Nothing can trip this yet: there is no server-side day-P&L measurement
   * surface to evaluate it against (HKP-AI-8).
   */
  circuitBreakerPct: number
  setRiskAppetite: (value: number) => void
  setApprovalMode: (value: ApprovalMode) => void
  setMaxAllocationPct: (value: number) => void
  setTradingWindow: (value: TradingWindow) => void
  setCircuitBreakerPct: (value: number) => void
  restoreDefaults: () => void
}

const DEFAULTS = {
  riskAppetite: 40,
  approvalMode: 'approve' as ApprovalMode,
  maxAllocationPct: 5,
  tradingWindow: 'rth' as TradingWindow,
  circuitBreakerPct: 2,
}

/** Persisted knobs for the StratFolio trading agent, edited in AI Settings. */
export const useAiSettingsStore = create<AiSettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setRiskAppetite: (riskAppetite) => set({ riskAppetite }),
      setApprovalMode: (approvalMode) => set({ approvalMode }),
      setMaxAllocationPct: (maxAllocationPct) => set({ maxAllocationPct }),
      setTradingWindow: (tradingWindow) => set({ tradingWindow }),
      setCircuitBreakerPct: (circuitBreakerPct) => set({ circuitBreakerPct }),
      restoreDefaults: () => set({ ...DEFAULTS }),
    }),
    { name: 'stratfolio.ai-settings.v1' },
  ),
)
