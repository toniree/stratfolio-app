import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ideasApi, newsApi, plannerApi, portfolioApi } from '@/api'
import type { OrderRequest, PerformancePeriod } from '@/api/types'
import type { CreatePlannerIdeaInput, PlannerIdea, UpdatePlannerIdeaInput } from '@/api/newsTypes'
import { useOrderToastStore } from '@/store/orderToastStore'

export const queryKeys = {
  accounts: ['accounts'] as const,
  positions: (accountId: string) => ['positions', accountId] as const,
  meta: (accountId: string) => ['portfolio-meta', accountId] as const,
  outlook: (accountId: string) => ['portfolio-outlook', accountId] as const,
  performance: (accountId: string, period: PerformancePeriod) =>
    ['performance', accountId, period] as const,
  ideas: ['ideas'] as const,
  activity: ['activity'] as const,
  orders: ['orders'] as const,
  news: ['news'] as const,
  article: (id: string) => ['news', id] as const,
  plannerIdeas: ['planner-ideas'] as const,
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

export function useIdeas() {
  return useQuery({ queryKey: queryKeys.ideas, queryFn: () => ideasApi.getIdeas() })
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
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['positions'] })
      void qc.invalidateQueries({ queryKey: ['portfolio-meta'] })
      void qc.invalidateQueries({ queryKey: ['performance'] })
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
