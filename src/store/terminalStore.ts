import { create } from 'zustand'

/** An option the terminal chart is focused on instead of the underlying. */
export interface TerminalContract {
  strike: number
  right: 'CALL' | 'PUT'
  /** e.g. `Sep 18 '26` — matches the chain's expiry label. */
  expiryLabel: string
  /** Unix seconds of expiration; drives time-to-expiry in repricing. */
  expiryTime: number
  dte: number
}

/**
 * Desktop terminal state: which symbol the big chart (and the rail watchlist
 * highlight) is focused on, and — when a chain row is tapped — which option
 * contract the chart is showing instead of the underlying.
 */
interface TerminalState {
  symbol: string
  contract: TerminalContract | null
  setSymbol: (symbol: string) => void
  setContract: (contract: TerminalContract | null) => void
}

export const useTerminalStore = create<TerminalState>((set) => ({
  symbol: 'NVDA',
  contract: null,
  // A new symbol is a new book — any focused contract belongs to the old one.
  setSymbol: (symbol) => set({ symbol, contract: null }),
  setContract: (contract) => set({ contract }),
}))
