import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ApprovalMode = 'approve' | 'auto'
export type TradingWindow = 'rth' | 'extended'

export interface AiSettingsState {
  /** 0 = lowest risk / reward, 100 = highest. Drives the agent's structure choice. */
  riskAppetite: number
  /** Whether AI-drafted orders wait for a human tap or fire when criteria hit. */
  approvalMode: ApprovalMode
  /** Ceiling for a single AI-initiated position, as % of buying power. */
  maxAllocationPct: number
  tradingWindow: TradingWindow
  /** Day-loss circuit breaker: the agent stands down past this drawdown. 0 = off. */
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
