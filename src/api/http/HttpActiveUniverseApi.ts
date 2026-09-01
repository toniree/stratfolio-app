import type { ActiveUniverse, UniverseEntry } from '@/api/types'
import type { ActiveUniverseApi, AddUniverseSymbolInput } from '@/api/portfolioApi'
import { request } from '@/api/http/client'
import type {
  PltAddWatchlistEntry,
  PltUpdateWatchlistEntry,
  PltWatchlistEntry,
  PltWatchlistList,
} from '@/api/http/wire/watchlist'
import { toActiveUniverse, toUniverseEntry } from '@/api/http/adapters/universe'

/**
 * The live ActiveUniverse, over plt `/api/v1/watchlist*`.
 *
 * The watchlist API is one of the few backend surfaces that is complete and
 * browser-ready today (gaps doc, "Non-gaps") — the app simply never called it.
 * Its semantics are real, not cosmetic, and the adapter preserves them:
 *
 * - Removal is a **soft exclude**, never a delete. plt keeps the row and
 *   records who excluded it, so a later AI promotion cannot silently
 *   re-enrol a symbol the user dropped — a plain add on an excluded symbol is
 *   refused with `USER_EXCLUDED_REQUIRES_RESTORE`.
 * - Capacity is finite and enforced. An add can be refused with 409
 *   `AT_CAPACITY_NO_EVICTABLE_SLOT`; the caller surfaces the refusal rather
 *   than pretending the symbol was added.
 * - Pinning goes through PATCH, which is also how a restore is expressed.
 */
export class HttpActiveUniverseApi implements ActiveUniverseApi {
  async getUniverse(): Promise<ActiveUniverse> {
    // The list response already carries the capacity block, so this is one
    // call, not two.
    const wire = await request<PltWatchlistList>('plt', '/api/v1/watchlist')
    return toActiveUniverse(wire)
  }

  async addSymbol(symbol: string, input: AddUniverseSymbolInput): Promise<UniverseEntry> {
    const body: PltAddWatchlistEntry = {
      source: input.source,
      // plt ignores `pinned` for any source other than USER; sending it
      // anyway would misrepresent what the request asked for.
      pinned: input.source === 'USER' ? input.pinned : undefined,
      reason: input.reason,
    }
    const wire = await request<PltWatchlistEntry>('plt', `/api/v1/watchlist/${encode(symbol)}`, {
      method: 'POST',
      body,
    })
    return toUniverseEntry(wire)
  }

  async setPinned(symbol: string, pinned: boolean): Promise<UniverseEntry> {
    const body: PltUpdateWatchlistEntry = { pinned }
    const wire = await request<PltWatchlistEntry>('plt', `/api/v1/watchlist/${encode(symbol)}`, {
      method: 'PATCH',
      body,
    })
    return toUniverseEntry(wire)
  }

  async restoreSymbol(symbol: string): Promise<UniverseEntry> {
    const body: PltUpdateWatchlistEntry = { restore: true }
    const wire = await request<PltWatchlistEntry>('plt', `/api/v1/watchlist/${encode(symbol)}`, {
      method: 'PATCH',
      body,
    })
    return toUniverseEntry(wire)
  }

  async excludeSymbol(symbol: string, reason?: string): Promise<UniverseEntry> {
    // DELETE takes `reason` as a query param and has no body. It soft-excludes
    // and returns the surviving entry.
    const wire = await request<PltWatchlistEntry>('plt', `/api/v1/watchlist/${encode(symbol)}`, {
      method: 'DELETE',
      query: { reason },
    })
    return toUniverseEntry(wire)
  }
}

/** Symbols are path segments; a stray slash or space must not build a URL that
 *  hits a different route. */
function encode(symbol: string): string {
  return encodeURIComponent(symbol.trim().toUpperCase())
}

export const httpActiveUniverseApi = new HttpActiveUniverseApi()
