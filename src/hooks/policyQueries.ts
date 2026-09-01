import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { executionPolicyApi } from '@/api'
import { policyWithKey } from '@/api/http/adapters/executionPolicy'
import { ApiError } from '@/api/http/problem'
import type { ExecutionApprovalMode, ExecutionPolicy, TradingWindow } from '@/api/types'
import { useUiStore } from '@/store/uiStore'

/**
 * The three settings the platform service enforces (APP-114, contracts §16).
 *
 * Everything here is live-only by construction. `executionPolicyApi` is `null`
 * in mock mode, the query is disabled, and callers fall back to the in-memory
 * toggle — which is what those settings always were, and which the UI now says
 * out loud instead of implying a kill switch that never existed.
 */

export const policyQueryKeys = {
  executionPolicy: ['execution-policy'] as const,
}

/** True when a server, not this browser, decides whether the AI may execute. */
export function isPolicyServerEnforced(): boolean {
  return executionPolicyApi !== null
}

export function useExecutionPolicy() {
  return useQuery({
    queryKey: policyQueryKeys.executionPolicy,
    queryFn: () => executionPolicyApi!.getPolicy(),
    enabled: executionPolicyApi !== null,
    // Read fresh when a settings surface opens: this is the state of a switch
    // someone else may have flipped, not a cacheable preference.
    staleTime: 0,
  })
}

export type PolicyChange =
  | { aiTradingEnabled: boolean }
  | { approvalMode: ExecutionApprovalMode }
  | { tradingWindow: TradingWindow }

/**
 * Write one policy key, optimistically.
 *
 * Optimistic because a switch that lags a round trip feels broken, and rolled
 * back on failure because a switch that *looks* flipped while the server still
 * holds the old value is worse than a slow one. A 422
 * (`CONFIG_VALUE_INVALID`) is the case that matters: plt refused the value, the
 * stored one is unchanged, and the control must snap back to it.
 */
export function useSetExecutionPolicy() {
  const qc = useQueryClient()
  return useMutation<void, Error, PolicyChange, { previous?: ExecutionPolicy }>({
    mutationFn: async (change: PolicyChange) => {
      const api = executionPolicyApi
      if (!api) throw new Error('The execution policy is not server-enforced in this build.')
      if ('aiTradingEnabled' in change) return api.setAiTradingEnabled(change.aiTradingEnabled)
      if ('approvalMode' in change) return api.setApprovalMode(change.approvalMode)
      return api.setTradingWindow(change.tradingWindow)
    },
    onMutate: async (change) => {
      await qc.cancelQueries({ queryKey: policyQueryKeys.executionPolicy })
      const previous = qc.getQueryData<ExecutionPolicy>(policyQueryKeys.executionPolicy)
      if (previous) {
        qc.setQueryData(policyQueryKeys.executionPolicy, policyWithKey(previous, change))
      }
      return { previous }
    },
    onError: (_error, _change, context) => {
      // Restore the whole snapshot, not just the one field: `unsetKeys` and
      // `invalidKeys` moved with it.
      if (context?.previous) {
        qc.setQueryData(policyQueryKeys.executionPolicy, context.previous)
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: policyQueryKeys.executionPolicy })
    },
  })
}

/** plt's own code for a value it refused to store. */
export function isConfigValueRejection(error: unknown): boolean {
  return error instanceof ApiError && error.rejectionReasons.includes('CONFIG_VALUE_INVALID')
}

export interface AiTradingSwitch {
  enabled: boolean
  /** A server enforces this, so flipping it off stops execution service-side. */
  serverEnforced: boolean
  setEnabled: (enabled: boolean) => void
  pending: boolean
  /** The write was refused and the switch has snapped back to the server's value. */
  failed: boolean
}

/**
 * The master AI-trading switch, wherever it is rendered.
 *
 * One hook for both modes so no component has to know which it is in — but the
 * `serverEnforced` flag is deliberately exposed rather than hidden, because the
 * two states mean genuinely different things and the copy differs. In live mode
 * the in-memory `uiStore` value is not consulted at all: plt is the state.
 */
export function useAiTradingSwitch(): AiTradingSwitch {
  const localEnabled = useUiStore((state) => state.aiTradingEnabled)
  const setLocalEnabled = useUiStore((state) => state.setAiTradingEnabled)
  const policy = useExecutionPolicy()
  const setPolicy = useSetExecutionPolicy()

  if (!isPolicyServerEnforced()) {
    return {
      enabled: localEnabled,
      serverEnforced: false,
      setEnabled: setLocalEnabled,
      pending: false,
      failed: false,
    }
  }

  return {
    // Until plt has answered, the switch shows the backend's own default
    // rather than this browser's memory of it (§16: an unset key trades as it
    // always did).
    enabled: policy.data?.aiTradingEnabled ?? true,
    serverEnforced: true,
    setEnabled: (enabled: boolean) => setPolicy.mutate({ aiTradingEnabled: enabled }),
    pending: setPolicy.isPending,
    failed: setPolicy.isError,
  }
}
