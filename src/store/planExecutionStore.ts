import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PlanExecutionState {
  disabledIds: string[]
  disablePlan: (id: string) => void
  activatePlan: (id: string) => void
}

/** Shared automatic-execution state used by the home table and Planner. */
export const usePlanExecutionStore = create<PlanExecutionState>()(
  persist(
    (set) => ({
      disabledIds: [],
      disablePlan: (id) =>
        set((state) => ({ disabledIds: [...new Set([...state.disabledIds, id])] })),
      activatePlan: (id) =>
        set((state) => ({ disabledIds: state.disabledIds.filter((planId) => planId !== id) })),
    }),
    { name: 'stratfolio.disabled-plans.v1' },
  ),
)
