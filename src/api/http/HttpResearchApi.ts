import type { ResearchApi } from '@/api/portfolioApi'
import type { BacktestRunProgress, BacktestRunView, QueueBacktestInput } from '@/api/researchTypes'
import type { BktBacktestRun, BktBacktestSubmitted } from '@/api/http/wire/bkt'
import { request } from '@/api/http/client'
import { ApiError } from '@/api/http/problem'
import { backtestTimeoutMs } from '@/api/http/env'
import { findPreset } from '@/api/researchPresets'
import { toBacktestRequest, toBacktestResultView } from '@/api/http/adapters/backtest'

/**
 * The live research domain, over service-bkt (APP-122).
 *
 * **The 202-but-synchronous footgun (§7.6).** `POST /api/v1/backtests` is
 * shaped like a submission — `202 {id, status: "PENDING"}` — so that a future
 * async runner can replace the handler without changing the wire. It is not
 * one today: `BacktestRunner.submit` validates, writes a PENDING row, runs the
 * engine, runs the baselines including a 200-draw Monte Carlo, and updates the
 * row to COMPLETED, all inside the request. Two consequences the client must
 * respect:
 *
 *  1. The POST needs a **much longer timeout** than any other call in the app
 *     (`backtestTimeoutMs`, five minutes by default). Aborting it does not
 *     cancel anything server-side; it only throws away the id of a run that
 *     happened, which — with no list route — can then never be read back.
 *  2. The first GET is issued **immediately**. The run is already COMPLETED or
 *     FAILED; a polling loop that starts with a delay is waiting for a state
 *     change that has already happened. The bounded retry below exists only so
 *     that the day the runner does go async, this client still works.
 */

/** Bounded retries for the day `submit` becomes genuinely asynchronous. */
const POLL_ATTEMPTS = 20
const POLL_INTERVAL_MS = 1_000

const TERMINAL = new Set(['COMPLETED', 'FAILED'])

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

export class HttpResearchApi implements ResearchApi {
  readonly provenance = 'live' as const

  /**
   * bkt exposes no list-backtests route (`api/backtests.py`: POST and
   * GET-by-id only), and the run id lives in the POST response alone. The desk
   * therefore shows the runs queued in this session, exactly as order history
   * retains bkt's NO_FILL outcomes for the session (HKP-BKT-4) — and says so,
   * rather than presenting an empty list as an empty research history.
   */
  readonly canListPastRuns = false

  async getRuns(): Promise<BacktestRunView[]> {
    return []
  }

  async submitRun(input: QueueBacktestInput): Promise<{ id: string }> {
    const preset = findPreset(input.presetId)
    if (!preset) throw new Error(`Unknown backtest preset: ${input.presetId}`)
    const body = toBacktestRequest(preset, input)
    const submitted = await request<BktBacktestSubmitted>('bkt', '/api/v1/backtests', {
      method: 'POST',
      body,
      timeoutMs: backtestTimeoutMs(),
    })
    return { id: submitted.id }
  }

  async getRun(id: string): Promise<BacktestRunProgress | undefined> {
    for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
      // Immediately, then on an interval: under the V1 runner the very first
      // read is already terminal.
      const run = await this.fetchRun(id)
      if (run === undefined) return undefined
      if (TERMINAL.has(run.status)) return toProgress(run)
      await sleep(POLL_INTERVAL_MS)
    }
    // Still not terminal: report it as still running rather than inventing a
    // failure. Nothing has gone wrong that this client can attest to.
    return { id, status: 'running', backendStatus: 'RUNNING' }
  }

  private async fetchRun(id: string): Promise<BktBacktestRun | undefined> {
    try {
      return await request<BktBacktestRun>('bkt', `/api/v1/backtests/${encodeURIComponent(id)}`)
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return undefined
      throw error
    }
  }
}

function toProgress(run: BktBacktestRun): BacktestRunProgress {
  if (run.status === 'FAILED') {
    return {
      id: run.id,
      status: 'failed',
      backendStatus: run.status,
      // bkt's own failure text, passed through: `str(exc)` from the runner is
      // more use than "something went wrong".
      error: run.error ?? 'The backtest failed and bkt recorded no reason.',
    }
  }
  return {
    id: run.id,
    status: 'done',
    backendStatus: run.status,
    // COMPLETED with no body would be a contract break, not an empty result —
    // surfaced as an error rather than rendered as a run with zero trades.
    result: run.result ? toBacktestResultView(run.result) : undefined,
    error: run.result ? undefined : 'bkt reported COMPLETED with no result body.',
  }
}

export const httpResearchApi = new HttpResearchApi()
