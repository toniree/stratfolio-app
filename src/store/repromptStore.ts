import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type RepromptEntityKind = 'thesis' | 'position' | 'plan'

/** What a chat turn was about, and where the user can go to see it. */
export interface AssistantReference {
  kind: RepromptEntityKind
  id: string
  /** Short identity, e.g. `NVDA $150C JAN 15 '27`. */
  label: string
  /** One line of supporting detail, e.g. `Long call · BUY · 88/100`. */
  detail?: string
  /** Route to the entity's own page. */
  to: string
}

export interface RepromptRecord {
  id: string
  reference: AssistantReference
  question: string
  answer?: string
  createdAt: string
}

interface RepromptState {
  /** Keyed `kind:id` so a plan and a position can never collide. */
  byEntity: Record<string, RepromptRecord[]>
  record: (reference: AssistantReference, question: string) => string
  attachAnswer: (recordId: string, answer: string) => void
  forEntity: (kind: RepromptEntityKind, id: string) => RepromptRecord[]
  /** Forgets every captured steer — the training-signal half of "reset memory". */
  clearAll: () => void
}

export function entityKey(kind: RepromptEntityKind, id: string): string {
  return `${kind}:${id}`
}

let sequence = 0

/**
 * Every time a user has to steer the model, that intervention is captured
 * against the thing they were steering.
 *
 * A reprompt is the most honest training signal the product gets: the user is
 * telling us, in their own words, what the thesis or plan failed to answer on
 * its own. Storing it against the entity — rather than only in the chat log —
 * is what lets the model learn which of its outputs needed defending.
 */
export const useRepromptStore = create<RepromptState>()(
  persist(
    (set, get) => ({
      byEntity: {},

      record: (reference, question) => {
        sequence += 1
        const id = `reprompt-${Date.now()}-${sequence}`
        const key = entityKey(reference.kind, reference.id)
        const entry: RepromptRecord = {
          id,
          reference,
          question,
          createdAt: new Date().toISOString(),
        }
        set((state) => ({
          byEntity: { ...state.byEntity, [key]: [...(state.byEntity[key] ?? []), entry] },
        }))
        return id
      },

      attachAnswer: (recordId, answer) =>
        set((state) => {
          const next: Record<string, RepromptRecord[]> = {}
          for (const [key, records] of Object.entries(state.byEntity)) {
            next[key] = records.map((record) =>
              record.id === recordId ? { ...record, answer } : record,
            )
          }
          return { byEntity: next }
        }),

      forEntity: (kind, id) => get().byEntity[entityKey(kind, id)] ?? [],

      clearAll: () => set({ byEntity: {} }),
    }),
    { name: 'stratfolio.reprompts.v1' },
  ),
)
