import { create } from 'zustand'

/**
 * Transient confirmations for actions that change the book — orders sent, plans
 * created or deleted. Deliberately not persisted: these are acknowledgements of
 * something that just happened, not state worth surviving a reload.
 */
export interface OrderToast {
  id: string
  /** Small uppercase label: FILLED, PLAN ADDED, PLAN REMOVED. */
  kind: string
  /** The instrument or plan the action applied to. */
  title: string
  detail?: string
  tone: 'up' | 'down' | 'neutral'
}

interface OrderToastState {
  toasts: OrderToast[]
  notify: (toast: Omit<OrderToast, 'id'>) => void
  dismiss: (id: string) => void
}

export const useOrderToastStore = create<OrderToastState>()((set) => ({
  toasts: [],
  notify: (toast) =>
    set((state) => ({
      // Cap the stack so a burst of plan edits cannot cover the screen.
      toasts: [...state.toasts, { ...toast, id: crypto.randomUUID() }].slice(-3),
    })),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))
