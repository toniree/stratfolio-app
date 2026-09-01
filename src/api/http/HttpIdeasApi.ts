import type { ThesisView } from '@/api/types'
import type { IdeasApi } from '@/api/portfolioApi'
import { request } from '@/api/http/client'
import { ApiError } from '@/api/http/problem'
import { PLT_LIST_LIMIT_MAX, type PltThesis } from '@/api/http/wire/plt'
import { sortThesesNewestFirst, toThesisView } from '@/api/http/adapters/thesis'

/** plt's list default is 50; the app asks for the cap because the thesis feed
 *  is the whole surface, not a page of it, and no cursor exists (HKP-PLT-8). */
const THESIS_LIST_LIMIT = PLT_LIST_LIMIT_MAX

/**
 * The live theses domain, over service-plt (APP-111).
 *
 * Read-only. plt does own `POST /api/v1/theses`, but nothing in the app
 * authors a thesis — the model does, through service-ai — and accept/reject is
 * not a thesis write at all: plt has no disposition field (HKP-PLT-3), so
 * APP-113 records the user's decision locally plus a schema-valid activity row.
 */
export class HttpIdeasApi implements IdeasApi {
  async getTheses(): Promise<ThesisView[]> {
    const wire = await request<PltThesis[]>('plt', '/api/v1/theses', {
      query: { limit: THESIS_LIST_LIMIT },
    })
    return sortThesesNewestFirst(wire.map(toThesisView))
  }

  async getThesis(id: string): Promise<ThesisView | undefined> {
    try {
      const wire = await request<PltThesis>('plt', `/api/v1/theses/${encodeURIComponent(id)}`)
      return toThesisView(wire)
    } catch (error) {
      // A thesis that rolled off (or an id from a stale link) is "not found",
      // which the detail route renders as such — not an error banner.
      if (error instanceof ApiError && error.status === 404) return undefined
      throw error
    }
  }
}

export const httpIdeasApi = new HttpIdeasApi()
