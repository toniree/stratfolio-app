import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { handlers } from '@/test/msw/handlers'

export const server = setupServer(...handlers)

/**
 * Wire MSW into a test file.
 *
 * `onUnhandledRequest: 'error'` is the point of the rig: an adapter that calls
 * a route nobody has pinned a fixture for fails loudly instead of quietly
 * returning `undefined` and letting a `?? 0` downstream invent a number.
 *
 * The adapters build same-origin URLs (`/plt/...`), which `fetch` in jsdom
 * resolves against `location.origin`, so handlers are declared with bare paths.
 */
export function useMswServer() {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())
}
