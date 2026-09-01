import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ManualCloseTicket, isManualCloseAvailable } from '@/components/positions/ManualCloseTicket'
import { idempotencyKeys } from '@/api/http/idempotency'
import { ApiError } from '@/api/http/problem'
import type { ExitRequest, Order, Position } from '@/api/types'

/**
 * The live half of the close ticket (APP-114).
 *
 * The mock half is the demo's simulated brokerage flow and is unchanged; these
 * tests are about the three things the live path must not get wrong: what it
 * sends, how it renders an outcome that closed nothing, and how it retries.
 */

const POSITION: Position = {
  id: 'pos-1',
  symbol: 'MU',
  assetType: 'option',
  contractDetail: '$150 Call · Jan 15 27',
  quantity: 3,
  avgCost: 16.2,
  openedAt: '2026-08-24T13:45:02Z',
  silentTradeId: 'aa11bb22-cc33-4d44-8e55-ff66aa77bb88',
  provenance: 'live',
}

const FILLED: Order = {
  id: 'ex-4',
  executionId: 'ex-4',
  symbol: 'MU',
  side: 'SELL',
  quantity: 3,
  price: 18.45,
  estimatedValue: 5535,
  status: 'FILLED',
  submittedAt: '2026-08-31T16:20:00Z',
  exitReason: 'USER_CLOSE',
  reportedToPlatform: true,
  provenance: 'live',
}

const requested: ExitRequest[] = []
let nextOutcome: Order | Error = FILLED

vi.mock('@/api/http/env', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/http/env')>()),
  isLive: () => true,
}))

vi.mock('@/hooks/queries', () => ({
  useRequestExit: () => ({
    isPending: false,
    error: nextOutcome instanceof Error ? nextOutcome : null,
    reset: () => {},
    mutateAsync: async (request: ExitRequest) => {
      requested.push(request)
      if (nextOutcome instanceof Error) throw nextOutcome
      return nextOutcome
    },
  }),
  useSubmitOrder: () => ({ isPending: false, error: null, reset: () => {}, mutateAsync: async () => FILLED }),
}))

function openTicket(position: Position = POSITION) {
  render(
    <ManualCloseTicket position={position} price={18.1} open onOpenChange={() => {}} />,
  )
}

async function hold(expected = 1) {
  const confirm = screen.getByRole('button', { name: /Hold to/ })
  fireEvent.pointerDown(confirm)
  await waitFor(() => expect(requested).toHaveLength(expected), { timeout: 3000 })
  fireEvent.pointerUp(confirm)
}

describe('ManualCloseTicket — live exit', () => {
  beforeEach(() => {
    requested.length = 0
    idempotencyKeys.clear()
    nextOutcome = FILLED
  })

  it('is available in live mode, and only for a position with a silent trade', () => {
    expect(isManualCloseAvailable(POSITION)).toBe(true)
    // No id bkt's exit route can take, so the control is honestly unavailable.
    expect(isManualCloseAvailable({ silentTradeId: undefined })).toBe(false)
  })

  it('offers no limit price and no partial quantity — the model takes neither', () => {
    openTicket()
    expect(screen.queryByLabelText(/limit/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Market$/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
    expect(screen.getByText(/no limit price to set/i)).toBeInTheDocument()
  })

  it('requests the exit with the trade id and one key, and nothing else', async () => {
    openTicket()
    await hold()
    expect(requested[0].silentTradeId).toBe(POSITION.silentTradeId)
    expect(requested[0].idempotencyKey).toMatch(/^exit-/)
  })

  it('shows the model’s fill price and says it is not the mark on screen', async () => {
    openTicket()
    await hold()
    await screen.findByText('Position closed')
    expect(screen.getByText('Model fill price')).toBeInTheDocument()
    expect(screen.getByText(/differs from the .*mark/i)).toBeInTheDocument()
    expect(screen.getByText('USER_CLOSE')).toBeInTheDocument()
  })

  it('renders a NO_FILL as an outcome that left the position open, not an error', async () => {
    nextOutcome = {
      ...FILLED,
      id: 'ex-5',
      status: 'NO_FILL',
      price: undefined,
      estimatedValue: undefined,
      reasonCode: 'SPIKE_NO_FILL',
      sessionOnly: true,
    }
    openTicket()
    await hold()
    await screen.findByText('No fill — still open')
    expect(screen.getByText(/still open and unchanged/i)).toBeInTheDocument()
    expect(screen.getByText('SPIKE_NO_FILL')).toBeInTheDocument()
    // A NO_FILL is retryable as a *new* operation (D6).
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('mints a new key for a deliberate second attempt after a NO_FILL', async () => {
    nextOutcome = { ...FILLED, status: 'NO_FILL', price: undefined, estimatedValue: undefined }
    openTicket()
    await hold(1)
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await hold(2)
    // Same key would replay the recorded NO_FILL forever.
    expect(requested[1].idempotencyKey).not.toBe(requested[0].idempotencyKey)
  })

  it('says a replayed close was not re-simulated', async () => {
    nextOutcome = { ...FILLED, replayed: true }
    openTicket()
    await hold()
    expect(await screen.findByText(/replayed/i)).toBeInTheDocument()
  })

  it('explains each refusal in terms of what was recorded', async () => {
    for (const [status, phrase] of [
      [404, /no such silent trade/i],
      [409, /already closed/i],
      [503, /nothing was recorded/i],
    ] as const) {
      nextOutcome = new ApiError({
        message: 'refused',
        status,
        url: '/bkt/api/v1/executions/exits',
      })
      const view = render(
        <ManualCloseTicket position={POSITION} price={18.1} open onOpenChange={() => {}} />,
      )
      expect(screen.getByText(phrase)).toBeInTheDocument()
      view.unmount()
    }
  })
})
