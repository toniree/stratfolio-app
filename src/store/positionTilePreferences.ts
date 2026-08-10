import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  DEFAULT_THESIS_STATS,
  THESIS_STAT_LIMIT,
  type ThesisStatField,
} from '@/lib/thesisStats'

export type PositionTileField =
  | 'value'
  | 'quantity'
  | 'return'
  | 'dayPl'
  | 'avgCost'
  | 'mark'

export type OptionQuoteType = 'mark' | 'bid' | 'ask' | 'last'

/** Contract analytics available to the tile's option-stats panel. */
export type OptionStatField =
  | 'delta'
  | 'gamma'
  | 'theta'
  | 'vega'
  | 'iv'
  | 'volume'
  | 'openInterest'
  | 'breakeven'
  | 'dte'
  | 'moneyness'

/** The panel holds five lines at most before it outgrows the tile. */
export const OPTION_STAT_LIMIT = 5

export const DEFAULT_OPTION_STATS: OptionStatField[] = ['delta', 'theta', 'iv', 'dte']

interface PositionTilePreferences {
  fields: PositionTileField[]
  quoteType: OptionQuoteType
  optionStats: OptionStatField[]
  /** Studies shown in the thesis tile's quant rail. */
  thesisStats: ThesisStatField[]
  setFields: (fields: PositionTileField[]) => void
  setQuoteType: (quoteType: OptionQuoteType) => void
  setOptionStats: (stats: OptionStatField[]) => void
  setThesisStats: (stats: ThesisStatField[]) => void
}

/** Two columns only — Value carries its own return percentage inline. */
export const POSITION_TILE_FIELD_COUNT = 2

export const DEFAULT_POSITION_TILE_FIELDS: PositionTileField[] = ['avgCost', 'value']

/** A single persisted fieldset keeps every mobile position card aligned. */
export const usePositionTilePreferences = create<PositionTilePreferences>()(
  persist(
    (set) => ({
      fields: DEFAULT_POSITION_TILE_FIELDS,
      quoteType: 'mark',
      optionStats: DEFAULT_OPTION_STATS,
      thesisStats: DEFAULT_THESIS_STATS,
      setFields: (fields) => set({ fields: fields.slice(0, POSITION_TILE_FIELD_COUNT) }),
      setQuoteType: (quoteType) => set({ quoteType }),
      setOptionStats: (optionStats) =>
        set({ optionStats: optionStats.slice(0, OPTION_STAT_LIMIT) }),
      setThesisStats: (thesisStats) =>
        set({ thesisStats: thesisStats.slice(0, THESIS_STAT_LIMIT) }),
    }),
    // v6 adds the thesis tile's selectable study rail.
    { name: 'stratfolio.position-tile-fields.v6' },
  ),
)
