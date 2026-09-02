import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { ExecutionApprovalMode, TradingWindow as PolicyTradingWindow } from '@/api/types'

/** The app's spelling of plt's `policy.execution_approval_mode` (`approve` is
 *  `approve_each` on the wire). One definition, shared with the live seam. */
export type ApprovalMode = ExecutionApprovalMode
export type TradingWindow = PolicyTradingWindow

/**
 * AI behaviour preferences.
 *
 * **Two classes of field live here now, and they are not the same thing.**
 *
 * `approvalMode` and `tradingWindow` became server-enforced in AI-021
 * (contracts §16): plt's `user_config` is the system of record and service-ai
 * halts the decision cycle on them. In live mode this store is not consulted
 * for either — the settings screen reads and writes plt directly. They stay
 * here for mock mode, which has no server to enforce anything.
 *
 * The rest are genuinely device-local, and every row in the UI says so:
 *  - `riskAppetite` — no backend key exists.
 *  - `maxAllocationPct` — PolicyGate already enforces its own
 *    `policy.max_portfolio_allocation_pct`, and this is deliberately NOT wired
 *    to it: a per-position ceiling and a portfolio allocation cap are not the
 *    same quantity, and writing one into the other would silently re-scale a
 *    cap that governs real execution.
 *  - `circuitBreakerPct` — explicitly deferred backend-side (§16.3): nothing
 *    measures day P&L server-side and no config key is reserved for it.
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
