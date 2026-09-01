import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { activeUniverseApi, ideasApi, newsApi, plannerApi, portfolioApi } from '@/api'
import type { ExitRequest, OrderRequest, PerformancePeriod } from '@/api/types'
import type { CreatePlannerIdeaInput, PlannerIdea, UpdatePlannerIdeaInput } from '@/api/newsTypes'
import type { AddUniverseSymbolInput } from '@/api/portfolioApi'
import { useOrderToastStore } from '@/store/orderToastStore'

export const queryKeys = {
  accounts: ['accounts'] as const,
  positions: (accountId: string) => ['positions', accountId] as const,
  meta: (accountId: string) => ['portfolio-meta', accountId] as const,
  outlook: (accountId: string) => ['portfolio-outlook', accountId] as const,
  performance: (accountId: string, period: PerformancePeriod) =>
    ['performance', accountId, period] as const,
  theses: ['theses'] as const,
  thesis: (id: string) => ['theses', id] as const,
  activity: ['activity'] as const,
  orders: ['orders'] as const,
  news: ['news'] as const,
  article: (id: string) => ['news', id] as const,
  plannerIdeas: ['planner-ideas'] as const,
  activeUniverse: ['active-universe'] as const,
}

export function useAccounts() {
  return useQuery({ queryKey: queryKeys.accounts, queryFn: () => portfolioApi.getAccounts() })
}

export function usePositions(accountId: string) {
  return useQuery({
    queryKey: queryKeys.positions(accountId),
    queryFn: () => portfolioApi.getPositions(accountId),
  })
}

export function usePortfolioMeta(accountId: string) {
  return useQuery({
    queryKey: queryKeys.meta(accountId),
    queryFn: () => portfolioApi.getMeta(accountId),
  })
}

export function usePortfolioOutlook(accountId: string) {
  return useQuery({
    queryKey: queryKeys.outlook(accountId),
    queryFn: () => portfolioApi.getOutlook(accountId),
  })
}

export function usePerformance(accountId: string, period: PerformancePeriod) {
  return useQuery({
    queryKey: queryKeys.performance(accountId, period),
    queryFn: () => portfolioApi.getPerformance(accountId, period),
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * The thesis feed (APP-111).
 *
 * Returns `ThesisView[]` — plt's recorded thesis fields. A row's optional
 * `idea` is the demo enrichment; components branch on its presence, never on
 * the data mode.
 */
export function useTheses() {
  return useQuery({ queryKey: queryKeys.theses, queryFn: () => ideasApi.getTheses() })
}

export function useActivity() {
  return useQuery({ queryKey: queryKeys.activity, queryFn: () => portfolioApi.getActivity() })
}

/**
 * Order history.
 *
 * In live mode this is a merge of plt silent trades, pending/rejected trade
 * plans, and session-retained bkt outcomes that left no durable row
 * (HKP-BKT-4) — so it is a real query, not a read of local state.
 */
export function useOrders() {
  return useQuery({ queryKey: queryKeys.orders, queryFn: () => portfolioApi.getOrders() })
}

export function useNewsArticles() {
  return useQuery({ queryKey: queryKeys.news, queryFn: () => newsApi.getArticles() })
}

export function useNewsArticle(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.article(id ?? ''),
    queryFn: () => newsApi.getArticle(id!),
    enabled: Boolean(id),
  })
}

export function usePlannerIdeas() {
  return useQuery({ queryKey: queryKeys.plannerIdeas, queryFn: () => plannerApi.getIdeas() })
}

export function useSubmitOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (request: OrderRequest) => portfolioApi.submitOrder(request),
    // User-submitted orders confirm inside the ticket. Header acknowledgements
    // are reserved for orders initiated by automation or AI.
    //
    // A submit can change the whole system of record — a fill creates a
    // position, moves cash and cost basis, appends activity, and adds an
    // order row; a NO_FILL or REJECTED still adds an order row and an
    // activity entry. Invalidating only activity left positions and the
    // portfolio hero stale after a fill.
    // Every outcome moves the system of record, including the two that open
    // nothing: a NO_FILL and a REJECTED both leave a trade-plan row and an
    // activity entry behind, so "only invalidate on a fill" would leave the
    // planner and the activity feed stale exactly when the user is looking for
    // an explanation.
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['positions'] })
      void qc.invalidateQueries({ queryKey: ['portfolio-meta'] })
      void qc.invalidateQueries({ queryKey: ['performance'] })
      void qc.invalidateQueries({ queryKey: queryKeys.accounts })
      void qc.invalidateQueries({ queryKey: queryKeys.activity })
      void qc.invalidateQueries({ queryKey: queryKeys.orders })
      void qc.invalidateQueries({ queryKey: queryKeys.plannerIdeas })
    },
  })
}

/**
 * Close a held position at the user's request (APP-114).
 *
 * Its own mutation rather than a flavour of `useSubmitOrder`, because the
 * outcomes mean different things: a `NO_FILL` here leaves the position OPEN
 * and still yours, where a NO_FILL on entry means nothing was opened at all.
 * The invalidation set matches a submit's because a filled close moves
 * everything a filled open does — positions, cash, cost basis, the settled
 * curve, activity — minus the planner, which an exit never touches.
 */
export function useRequestExit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (request: ExitRequest) => portfolioApi.requestExit(request),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['positions'] })
      void qc.invalidateQueries({ queryKey: ['portfolio-meta'] })
      void qc.invalidateQueries({ queryKey: ['performance'] })
      void qc.invalidateQueries({ queryKey: queryKeys.accounts })
      void qc.invalidateQueries({ queryKey: queryKeys.activity })
      void qc.invalidateQueries({ queryKey: queryKeys.orders })
    },
  })
}

export function useAddIdeaToPortfolio(accountId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ ideaId, quantity }: { ideaId: string; quantity: number }) =>
      portfolioApi.addPositionFromIdea(accountId, ideaId, quantity),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['positions'] })
      void qc.invalidateQueries({ queryKey: ['portfolio-meta'] })
      void qc.invalidateQueries({ queryKey: ['performance'] })
      void qc.invalidateQueries({ queryKey: queryKeys.activity })
      void qc.invalidateQueries({ queryKey: queryKeys.orders })
    },
  })
}

export function useCreatePlannerIdea() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreatePlannerIdeaInput) => plannerApi.createIdea(input),
    onSuccess: (idea) => {
      useOrderToastStore.getState().notify({
        kind: idea.source === 'ai' ? 'AI plan added' : 'Plan added',
        title: `${idea.symbol}${idea.contractDetail ? ` ${idea.contractDetail}` : ''}`,
        detail: idea.originalPrompt ?? idea.title,
        tone: 'up',
      })
      void qc.invalidateQueries({ queryKey: queryKeys.plannerIdeas })
    },
  })
}

export function useUpdatePlannerIdea() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePlannerIdeaInput }) =>
      plannerApi.updateIdea(id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.plannerIdeas })
    },
  })
}

export function useDeletePlannerIdea() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => plannerApi.deleteIdea(id),
    onSuccess: (_result, id) => {
      const removed = qc
        .getQueryData<PlannerIdea[]>(queryKeys.plannerIdeas)
        ?.find((idea) => idea.id === id)
      useOrderToastStore.getState().notify({
        kind: 'Plan removed',
        title: removed
          ? `${removed.symbol}${removed.contractDetail ? ` ${removed.contractDetail}` : ''}`
          : 'Trade plan',
        detail: removed?.originalPrompt ?? removed?.title,
        tone: 'down',
      })
      void qc.invalidateQueries({ queryKey: queryKeys.plannerIdeas })
    },
  })
}

/* --------------------------------------------------------------------------
 * ActiveUniverse (plt watchlist).
 *
 * Every mutation invalidates the whole universe rather than patching one
 * entry, because plt's response to one symbol can change others: an add may
 * evict a different symbol to make room, and capacity counts move with any
 * change. Optimistically editing a single row would show a universe plt does
 * not have.
 * ----------------------------------------------------------------------- */

export function useActiveUniverse() {
  return useQuery({
    queryKey: queryKeys.activeUniverse,
    queryFn: () => activeUniverseApi.getUniverse(),
  })
}

function useUniverseMutation<TArgs>(fn: (args: TArgs) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.activeUniverse })
      // Universe changes are recorded as plt activity rows.
      void qc.invalidateQueries({ queryKey: queryKeys.activity })
    },
  })
}

export function useAddUniverseSymbol() {
  return useUniverseMutation(({ symbol, input }: { symbol: string; input: AddUniverseSymbolInput }) =>
    activeUniverseApi.addSymbol(symbol, input),
  )
}

export function useSetUniversePinned() {
  return useUniverseMutation(({ symbol, pinned }: { symbol: string; pinned: boolean }) =>
    activeUniverseApi.setPinned(symbol, pinned),
  )
}

export function useRestoreUniverseSymbol() {
  return useUniverseMutation((symbol: string) => activeUniverseApi.restoreSymbol(symbol))
}

export function useExcludeUniverseSymbol() {
  return useUniverseMutation(({ symbol, reason }: { symbol: string; reason?: string }) =>
    activeUniverseApi.excludeSymbol(symbol, reason),
  )
}
