import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface NotificationPreferencesState {
  newsEnabled: boolean
  planExecutedEnabled: boolean
  planExecutionSoonEnabled: boolean
  aiTradeEnabled: boolean
  setNewsEnabled: (enabled: boolean) => void
  setPlanExecutedEnabled: (enabled: boolean) => void
  setPlanExecutionSoonEnabled: (enabled: boolean) => void
  setAiTradeEnabled: (enabled: boolean) => void
}

/** Notification choices persist independently from transient shell UI. */
export const useNotificationPreferencesStore = create<NotificationPreferencesState>()(
  persist(
    (set) => ({
      newsEnabled: true,
      planExecutedEnabled: true,
      planExecutionSoonEnabled: true,
      aiTradeEnabled: true,
      setNewsEnabled: (newsEnabled) => set({ newsEnabled }),
      setPlanExecutedEnabled: (planExecutedEnabled) => set({ planExecutedEnabled }),
      setPlanExecutionSoonEnabled: (planExecutionSoonEnabled) =>
        set({ planExecutionSoonEnabled }),
      setAiTradeEnabled: (aiTradeEnabled) => set({ aiTradeEnabled }),
    }),
    { name: 'stratfolio.notification-preferences.v1' },
  ),
)
