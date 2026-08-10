import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThesisDecision = 'added' | 'rejected'

export interface ThesisDecisionRecord {
  decision: ThesisDecision
  reason?: string
}

interface ThesisDecisionState {
  decisions: Record<string, ThesisDecisionRecord>
  decide: (id: string, decision: ThesisDecision, reason?: string) => void
}

/** Keeps handled theses out of the discovery feed across demo refreshes. */
export const useThesisDecisionStore = create<ThesisDecisionState>()(
  persist(
    (set) => ({
      decisions: {},
      decide: (id, decision, reason) =>
        set((state) => ({
          decisions: {
            ...state.decisions,
            [id]: { decision, reason: reason?.trim() || undefined },
          },
        })),
    }),
    { name: 'stratfolio.thesis-decisions.v1' },
  ),
)
