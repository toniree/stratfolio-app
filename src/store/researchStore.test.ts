import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BacktestRunProgress, BacktestRunView, QueueBacktestInput } from '@/api/researchTypes'

/**
 * The run registry (APP-122).
 *
 * The behaviours under test are the ones bkt's shape forces on the client: the
 * id arrives with the POST and is the only handle the run will ever have, so it
 * is recorded before anything is polled; a submission that never became a run
 * surfaces instead of leaving a card spinning; and a run that was submitted but
 * could not be read back says exactly that, rather than being reported as a
 * failed backtest.
 */

const seam = {
  provenance: 'live' as const,
  canListPastRuns: false,
  getRuns: vi.fn<() => Promise<BacktestRunView[]>>(async () => []),
  submitRun: vi.fn<(input: QueueBacktestInput) => Promise<{ id: string }>>(async () => ({
    id: 'bkt-run-1',
  })),
  getRun: vi.fn<(id: string) => Promise<BacktestRunProgress | undefined>>(async (id) => ({
    id,
    status: 'done',
  })),
}

vi.mock('@/api', () => ({ researchApi: seam }))

const { useResearchStore } = await import('@/store/researchStore')

const INPUT: QueueBacktestInput = {
  presetId: 'long-call-delta-band',
  symbols: ['SPY'],
  start: '2024-01-02',
  end: '2024-06-28',
  initialCapital: 100_000,
}

beforeEach(() => {
  useResearchStore.setState({ runs: [], hydrated: false, hydrating: false, submitError: undefined })
  seam.getRuns.mockClear()
  seam.submitRun.mockClear()
  seam.getRun.mockClear()
})

describe('queueRun', () => {
  it('records the run id from the submission before polling it', async () => {
    const seen: string[][] = []
    seam.getRun.mockImplementationOnce(async (id) => {
      seen.push(useResearchStore.getState().runs.map((run) => run.id))
      return { id, status: 'done' }
    })

    const id = await useResearchStore.getState().queueRun(INPUT)
    expect(id).toBe('bkt-run-1')
    // The id was already on the desk when the first poll went out: the POST
    // response is the only place it ever appears.
    expect(seen[0]).toEqual(['bkt-run-1'])
    expect(useResearchStore.getState().runs[0].status).toBe('done')
    expect(useResearchStore.getState().runs[0].provenance).toBe('live')
  })

  it('carries the preset’s read-only parameters onto the run', async () => {
    await useResearchStore.getState().queueRun(INPUT)
    const { request } = useResearchStore.getState().runs[0]
    expect(request.selection).toBe('DELTA_BAND')
    expect(request.targetDeltaRange).toEqual([0.35, 0.65])
    expect(request.minContractOi).toBe(10)
    expect(request.symbols).toEqual(['SPY'])
  })

  it('surfaces a refused submission and creates no run', async () => {
    seam.submitRun.mockRejectedValueOnce(new Error('422 SYMBOL_DAY_LIMIT_EXCEEDED'))
    const id = await useResearchStore.getState().queueRun(INPUT)
    expect(id).toBeUndefined()
    expect(useResearchStore.getState().runs).toEqual([])
    expect(useResearchStore.getState().submitError).toMatch(/SYMBOL_DAY_LIMIT_EXCEEDED/)
  })

  it('keeps the run and says the read-back failed, not that the backtest failed', async () => {
    seam.getRun.mockRejectedValueOnce(new Error('network down'))
    await useResearchStore.getState().queueRun(INPUT)
    const run = useResearchStore.getState().runs[0]
    expect(run.id).toBe('bkt-run-1')
    expect(run.status).toBe('failed')
    expect(run.error).toMatch(/submitted but could not be read back/)
  })

  it('marks a run bkt has no record of, rather than leaving it running', async () => {
    seam.getRun.mockResolvedValueOnce(undefined)
    await useResearchStore.getState().queueRun(INPUT)
    expect(useResearchStore.getState().runs[0].status).toBe('failed')
  })
})

describe('hydrate', () => {
  it('asks the seam once and marks the desk loaded', async () => {
    await useResearchStore.getState().hydrate()
    await useResearchStore.getState().hydrate()
    expect(seam.getRuns).toHaveBeenCalledTimes(1)
    expect(useResearchStore.getState().hydrated).toBe(true)
  })
})
