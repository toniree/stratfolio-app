import type { WireDecimal } from '@/api/http/wire/scalars'

/**
 * service-plt watchlist (ActiveUniverse) wire DTOs.
 *
 * Pinned to `web/dto/Watchlist*.java`. Same SNAKE_CASE + `non_null` rules as
 * the rest of plt. One field is not mechanical: `protectedFlag` is annotated
 * `@JsonProperty("protected")` because Java cannot name a field `protected`,
 * so the wire key really is `protected`.
 */

export type PltWatchlistEntryKind =
  | 'DEFAULT_PINNED'
  | 'USER_PINNED'
  | 'AI_SELECTED'
  | 'EVENT_PROMOTED'
export type PltWatchlistStatus = 'ACTIVE' | 'USER_EXCLUDED'
export type PltValidationStatus = 'UNVALIDATED' | 'VALID' | 'UNRESOLVABLE'
export type PltInstrumentType = 'EQUITY' | 'ETF' | 'UNKNOWN'
export type PltWatchlistSource = 'USER' | 'AI' | 'NEWS' | 'SYSTEM'

export interface PltWatchlistEntry {
  symbol: string
  instrument_type: PltInstrumentType
  kind: PltWatchlistEntryKind
  status: PltWatchlistStatus
  /** 0..1; absent until the engine has scored the symbol. */
  priority_score?: WireDecimal
  /** Wire key really is `protected` — see the class note above. */
  protected: boolean
  protection_reasons?: string[]
  has_open_trade: boolean
  position_protected: boolean
  added_at?: string
  last_promoted_at?: string
  last_evicted_at?: string
  last_evaluated_at?: string
  reason?: string
  validation_status: PltValidationStatus
}

/** `GET /api/v1/watchlist`. */
export interface PltWatchlistList {
  entries: PltWatchlistEntry[]
  active_count: number
  max: number
  available_slots: number
  protected_count: number
  unresolved_count: number
}

/** `GET /api/v1/watchlist/capacity`. */
export interface PltWatchlistCapacity {
  active_count: number
  max: number
  available_slots: number
  protected_count: number
  unresolved_count: number
}

/** `POST /api/v1/watchlist/{symbol}`. plt honours `pinned` only for
 *  `source: USER`. */
export interface PltAddWatchlistEntry {
  source: PltWatchlistSource
  pinned?: boolean
  reason?: string
}

/** `PATCH /api/v1/watchlist/{symbol}`. */
export interface PltUpdateWatchlistEntry {
  pinned?: boolean
  restore?: boolean
}
