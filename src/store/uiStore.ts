import { create } from 'zustand'
import type { BrokerageId } from '@/api/types'

export type BrokerageFilterValue = 'all' | BrokerageId

interface UiState {
  /** Which portfolio account is selected — independent of the brokerage filter. */
  accountId: string
  /** Which brokerage the position list is filtered to — independent of the account. */
  brokerageFilter: BrokerageFilterValue
  /** Count of open modals/sheets; the news toast pauses while this is > 0. */
  overlayCount: number
  hasUnreadNews: boolean
  /**
   * The master AI-trading switch — **in mock mode only**.
   *
   * In live mode this value is not read at all: plt's
   * `policy.ai_trading_enabled` is both the state and the enforcement
   * (contracts §16/§17), reached through `useAiTradingSwitch`. A switch only
   * this browser could see was never a kill switch, so nothing should consult
   * this field directly again.
   */
  aiTradingEnabled: boolean
  setAccountId: (id: string) => void
  setBrokerageFilter: (value: BrokerageFilterValue) => void
  pushOverlay: () => void
  popOverlay: () => void
  setHasUnreadNews: (unread: boolean) => void
  setAiTradingEnabled: (enabled: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  accountId: 'demo',
  brokerageFilter: 'all',
  overlayCount: 0,
  hasUnreadNews: true,
  aiTradingEnabled: false,
  setAccountId: (accountId) => set({ accountId }),
  setBrokerageFilter: (brokerageFilter) => set({ brokerageFilter }),
  pushOverlay: () => set((s) => ({ overlayCount: s.overlayCount + 1 })),
  popOverlay: () => set((s) => ({ overlayCount: Math.max(0, s.overlayCount - 1) })),
  setHasUnreadNews: (hasUnreadNews) => set({ hasUnreadNews }),
  setAiTradingEnabled: (aiTradingEnabled) => set({ aiTradingEnabled }),
}))
