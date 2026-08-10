import { create } from 'zustand'
import { assistantApi } from '@/api'
import { useRepromptStore, type AssistantReference } from '@/store/repromptStore'

export interface AssistantChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  /** The thesis, position or plan this turn was about. */
  reference?: AssistantReference
}

export type AssistantChatMode = 'window' | 'bubble'

interface AssistantChatState {
  messages: AssistantChatMessage[]
  mode: AssistantChatMode
  thinking: boolean
  /** A reply landed while the window was minimised and has not been read. */
  unread: boolean
  /**
   * What the user is currently looking at. Set by detail pages so a question
   * asked from the floating bubble still lands against the right entity.
   */
  context: AssistantReference | null
  setContext: (context: AssistantReference | null) => void
  sendMessage: (question: string, reference?: AssistantReference) => Promise<void>
  openWindow: () => void
  minimize: () => void
}

let messageSequence = 0

/** Session-long assistant thread shared by every route inside AppShell. */
export const useAssistantChatStore = create<AssistantChatState>((set, get) => ({
  messages: [],
  mode: 'bubble',
  thinking: false,
  unread: false,
  context: null,

  setContext: (context) => set({ context }),

  openWindow: () => set({ mode: 'window', unread: false }),
  minimize: () => set({ mode: 'bubble' }),

  sendMessage: async (rawQuestion, explicitReference) => {
    const question = rawQuestion.trim()
    if (!question || get().thinking) return

    // An explicit reference wins; otherwise fall back to whatever page the
    // user is on, so bubble questions still attach to something.
    const reference = explicitReference ?? get().context ?? undefined
    const repromptId = reference
      ? useRepromptStore.getState().record(reference, question)
      : null

    const userMessage: AssistantChatMessage = {
      id: nextMessageId('user'),
      role: 'user',
      text: question,
      reference,
    }
    set((state) => ({
      messages: [...state.messages, userMessage],
      mode: 'window',
      thinking: true,
      unread: false,
    }))

    try {
      const reply = await assistantApi.ask(question)
      if (repromptId) useRepromptStore.getState().attachAnswer(repromptId, reply.text)
      set((state) => ({
        messages: [
          ...state.messages,
          {
            id: nextMessageId('assistant'),
            role: 'assistant',
            text: reply.text,
            reference,
          },
        ],
        thinking: false,
        // Only unread if they walked away while it was thinking.
        unread: state.mode === 'bubble',
      }))
    } catch {
      set((state) => ({
        messages: [
          ...state.messages,
          {
            id: nextMessageId('assistant'),
            role: 'assistant',
            text: 'I could not complete that response. Please try again.',
          },
        ],
        thinking: false,
        unread: state.mode === 'bubble',
      }))
    }
  },
}))

function nextMessageId(role: AssistantChatMessage['role']): string {
  messageSequence += 1
  return `${role}-${Date.now()}-${messageSequence}`
}
