import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Session, User } from '@/api/types'

interface AuthState {
  session: Session | null
  hydrated: boolean
  signIn: (session: Session) => void
  signOut: () => void
  user: () => User | null
}

/**
 * Mock session, persisted to localStorage. Deliberately minimal — auth is the
 * last thing built and the least interesting part of the product.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      hydrated: false,
      signIn: (session) => set({ session }),
      signOut: () => set({ session: null }),
      user: () => get().session?.user ?? null,
    }),
    {
      name: 'stratfolio.session.v1',
      partialize: (state) => ({ session: state.session }) as AuthState,
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true
      },
    },
  ),
)
