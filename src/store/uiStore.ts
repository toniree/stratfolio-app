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
