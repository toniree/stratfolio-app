import { create } from 'zustand'
import { researchApi } from '@/api'
import { findPreset } from '@/api/researchPresets'
import type { BacktestRunView, QueueBacktestInput } from '@/api/researchTypes'

/**
 * The Research desk's run registry (APP-122).
 *
 * It used to *be* the engine: a PRNG, a strategy library of ten studies bkt
 * cannot express, and `simulateRun()` shaping a CAGR out of a hash. All of
 * that moved behind the `researchApi` seam — the demo engine into
 * `MockResearchApi`, the real one into `HttpResearchApi` over
 * `POST /api/v1/backtests` — and what is left here is state: which runs this
 * session knows about, and their status.
 *
 * **Why the runs live here rather than in TanStack Query.** bkt has no
 * list-backtests route, and a run id exists only in the POST response
 * (`api/backtests.py`). A queued run is therefore session state by nature,
 * exactly like the bkt execution outcomes order history retains (HKP-BKT-4).
 * `canListPastRuns` is what the page reads to say so out loud instead of
 * rendering an empty desk as an empty research history.
 */

/** True when the desk is bound to bkt rather than the demo engine (D2) —
 *  derived from the bound seam, not from an env flag read at render. */
export function isResearchLive(): boolean {
  return researchApi.provenance === 'live'
}

interface ResearchState {
  runs: BacktestRunView[]
  /** True once `hydrate()` has resolved — an empty desk before that is
   *  "not loaded", which is not the same claim as "no runs exist". */
  hydrated: boolean
  hydrating: boolean
  /** Whether the bound seam can enumerate runs it did not just create. */
  canListPastRuns: boolean
  /** A submit that failed outright (network, 422 from bkt's validators). */
  submitError?: string
  hydrate: () => Promise<void>
  queueRun: (input: QueueBacktestInput) => Promise<string | undefined>
  clearSubmitError: () => void
}

function placeholder(id: string, input: QueueBacktestInput): BacktestRunView {
  const preset = findPreset(input.presetId)
  return {
    id,
    name: preset?.name ?? 'Backtest',
    status: 'running',
    // The seam's own claim about the run, not a global flag: a mock run and a
    // bkt run can never be confused for one another on the same desk (D10).
    provenance: researchApi.provenance,
    createdBy: 'user',
    startedAt: new Date().toISOString(),
    request: {
      presetId: input.presetId,
      presetName: preset?.name ?? input.presetId,
      right: preset?.right ?? 'CALL',
      selection: preset?.selection ?? 'DELTA_BAND',
      fidelity: preset?.fidelity ?? 'strategy-faithful',
      targetDeltaRange: preset?.targetDeltaRange,
      targetDelta: preset?.targetDelta,
      minContractOi: preset?.minContractOi ?? 0,
      minDte: preset?.minDte ?? 1,
      maxDte: preset?.maxDte ?? 45,
      quantity: preset?.quantity ?? 1,
      profitTargetPct: preset?.profitTargetPct,
      stopLossPct: preset?.stopLossPct,
      maxHoldingDays: preset?.maxHoldingDays,
      forceCloseDte: preset?.forceCloseDte ?? 0,
      symbols: input.symbols,
      start: input.start,
      end: input.end,
      initialCapital: input.initialCapital,
      fillProtocol: 'two_quote_band',
    },
  }
}

export const useResearchStore = create<ResearchState>((set, get) => ({
  runs: [],
  hydrated: false,
  hydrating: false,
  canListPastRuns: researchApi.canListPastRuns,

  hydrate: async () => {
    if (get().hydrated || get().hydrating) return
    set({ hydrating: true })
    try {
      const runs = await researchApi.getRuns()
      set({ runs: [...runs, ...get().runs.filter((run) => !runs.some((r) => r.id === run.id))] })
    } finally {
      set({ hydrated: true, hydrating: false })
    }
  },

  clearSubmitError: () => set({ submitError: undefined }),

  queueRun: async (input) => {
    set({ submitError: undefined })
    let id: string
    try {
      const submitted = await researchApi.submitRun(input)
      id = submitted.id
    } catch (error) {
      // No id, no run: the submission never became one. Surfaced, never
      // swallowed into a card that would sit "running" forever.
      set({ submitError: error instanceof Error ? error.message : 'The backtest was refused.' })
      return undefined
    }

    // The id is recorded *before* the poll: under the V1 runner the work is
    // already done by the time the POST answers, and this response is the only
    // place the id ever appears.
    set((state) => ({ runs: [placeholder(id, input), ...state.runs] }))

    try {
      const progress = await researchApi.getRun(id)
      set((state) => ({
        runs: state.runs.map((run) =>
          run.id === id
            ? progress === undefined
              ? { ...run, status: 'failed', error: 'bkt has no record of this run.' }
              : {
                  ...run,
                  status: progress.status,
                  result: progress.result,
                  simulated: progress.simulated,
                  error: progress.error,
                }
            : run,
        ),
      }))
    } catch (error) {
      set((state) => ({
        runs: state.runs.map((run) =>
          run.id === id
            ? {
                ...run,
                status: 'failed',
                error:
                  error instanceof Error
                    ? `The run was submitted but could not be read back: ${error.message}`
                    : 'The run was submitted but could not be read back.',
              }
            : run,
        ),
      }))
    }
    return id
  },
}))
