import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

/**
 * A TanStack provider for component tests.
 *
 * Any component that reaches a query hook — directly or through one nested
 * several levels down, which is how `useOptionMarks` arrived in the plan sheet
 * — throws "No QueryClient set" without a provider above it. Passing this as
 * `render(ui, { wrapper })` also keeps the wrapper across `rerender`, which a
 * hand-rolled JSX wrapper in the render call does not.
 *
 * A fresh client per render keeps caches from leaking between tests, and
 * retries are off so a deliberately failing call resolves immediately instead
 * of stalling the test for three backoff rounds.
 */
export function QueryWrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
