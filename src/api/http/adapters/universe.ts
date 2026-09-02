import type { ActiveUniverse, UniverseCapacity, UniverseEntry } from '@/api/types'
import type {
  PltWatchlistCapacity,
  PltWatchlistEntry,
  PltWatchlistList,
} from '@/api/http/wire/watchlist'
import { decimal, instant, requiredText, text } from '@/api/http/wire/scalars'

/** Pure wire → view-model mapping for the ActiveUniverse. */

export function toUniverseEntry(wire: PltWatchlistEntry): UniverseEntry {
  return {
    symbol: requiredText(wire.symbol, 'symbol'),
    instrumentType: wire.instrument_type,
    kind: wire.kind,
    status: wire.status,
    // Absent until the engine has scored the symbol. A 0 would read as "the
    // model ranked this lowest", which is a different claim.
    priorityScore: decimal(wire.priority_score),
    // Renamed on the way in: the wire key is `protected`, which is a reserved
    // word in enough contexts to be worth not propagating.
    isProtected: wire.protected,
    protectionReasons: wire.protection_reasons ?? [],
    hasOpenTrade: wire.has_open_trade,
    positionProtected: wire.position_protected,
    addedAt: instant(wire.added_at),
    lastPromotedAt: instant(wire.last_promoted_at),
    lastEvictedAt: instant(wire.last_evicted_at),
    lastEvaluatedAt: instant(wire.last_evaluated_at),
    reason: text(wire.reason),
    validationStatus: wire.validation_status,
    provenance: 'live',
  }
}

export function toCapacity(wire: PltWatchlistCapacity | PltWatchlistList): UniverseCapacity {
  return {
    activeCount: wire.active_count,
    max: wire.max,
    availableSlots: wire.available_slots,
    protectedCount: wire.protected_count,
    unresolvedCount: wire.unresolved_count,
  }
}

export function toActiveUniverse(wire: PltWatchlistList): ActiveUniverse {
  return {
    entries: wire.entries.map(toUniverseEntry),
    capacity: toCapacity(wire),
    provenance: 'live',
  }
}

/** Plain-English reasons a symbol is in the universe, for the UI. */
export const UNIVERSE_KIND_LABEL: Record<UniverseEntry['kind'], string> = {
  DEFAULT_PINNED: 'Default',
  USER_PINNED: 'Pinned by you',
  AI_SELECTED: 'AI selected',
  EVENT_PROMOTED: 'Event promoted',
}

export const UNIVERSE_VALIDATION_LABEL: Record<UniverseEntry['validationStatus'], string> = {
  UNVALIDATED: 'Not yet validated',
  VALID: 'Valid',
  // The one that matters operationally: an unresolvable symbol sits in the
  // universe and can never produce a plan.
  UNRESOLVABLE: 'Unresolvable',
}
