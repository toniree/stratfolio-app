import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OpenOptionTicket } from '@/components/trade/OpenOptionTicket'
import { idempotencyKeys } from '@/api/http/idempotency'
import type { Order, OrderRequest } from '@/api/types'
import type { OptionQuote } from '@/api/marketData/types'

const CONTRACT: OptionQuote = {
  occSymbol: 'NVDA261218C00190000',
  underlyingTicker: 'NVDA',
  right: 'CALL',
  strike: 190,
  expiration: '2026-12-18',
  dte: 109,
  bid: 15.6,
  ask: 16,
  mid: 15.8,
  impliedVolatility: 0.42,
  underlyingPrice: 178.4,
  provenance: 'replay',
}

/** An expiring-today contract: below `min-dte`, so the ticket must not offer
 *  it — a DTE_LT_1 rejection is a round trip wasted on a known refusal. */
const TODAY_CONTRACT: OptionQuote = { ...CONTRACT, occSymbol: 'NVDA-0DTE', dte: 0, strike: 185 }

const submitted: OrderRequest[] = []
let nextOutcome: Order | Error = {
  id: 'ex-1',
  executionId: 'ex-1',
  symbol: 'NVDA',
  side: 'BUY',
  quantity: 4,
  price: 15.8,
  estimatedValue: 6320,
  status: 'FILLED',
  submittedAt: '2026-08-31T15:04:05Z',
  reportedToPlatform: true,
  provenance: 'live',
}

vi.mock('@/hooks/marketQueries', () => ({
  isMarketLive: () => true,
  useMarketSnapshot: () => ({
    data: { chainSummary: { expirations: ['2026-12-18', '2027-01-15'] } },
    isLoading: false,
    isError: false,
  }),
  useLiveChain: () => ({
    data: { contracts: [CONTRACT, TODAY_CONTRACT], provenance: 'replay', staleness: { stale: false } },
    isLoading: false,
    isError: false,
  }),
}))

vi.mock('@/hooks/queries', () => ({
  useSubmitOrder: () => ({
    isPending: false,
    error: null,
    reset: () => {},
    mutateAsync: async (request: OrderRequest) => {
      submitted.push(request)
      if (nextOutcome instanceof Error) throw nextOutcome
      return nextOutcome
    },
  }),
}))

function open() {
  render(<OpenOptionTicket symbol="NVDA" open onOpenChange={() => {}} />)
}

/** Walk the ticket: pick the contract, review, hold to execute. */
async function submit(expected = 1) {
  fireEvent.click(screen.getByRole('button', { name: /\$190/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Review' }))
  const confirm = screen.getByRole('button', { name: /Hold to/ })
  fireEvent.pointerDown(confirm)
  await waitFor(() => expect(submitted).toHaveLength(expected), { timeout: 3000 })
  fireEvent.pointerUp(confirm)
}

describe('OpenOptionTicket', () => {
  beforeEach(() => {
    submitted.length = 0
    idempotencyKeys.clear()
  })

  it('offers only contracts the policy can trade — DTE ≥ 1', () => {
    open()
    expect(screen.getByRole('button', { name: /\$190/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /\$185/ })).not.toBeInTheDocument()
  })

  it('sends the chain’s contract identity, not a browser-derived one', async () => {
    open()
    await submit()
    expect(submitted[0].contract).toMatchObject({
      occSymbol: 'NVDA261218C00190000',
      strike: 190,
      expiry: '2026-12-18',
      dte: 109,
      mid: 15.8,
    })
    expect(submitted[0].intent).toBe('open')
    expect(submitted[0].side).toBe('BUY')
  })

  it('shows no order type, time-in-force or commission — none of them exist', async () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: /\$190/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Review' }))
    const text = document.body.textContent ?? ''
    expect(text).not.toMatch(/good for day|commission|market order/i)
    expect(text).toMatch(/SILENT/)
    expect(text).toMatch(/HIGH_REWARD_HIGH_RISK/)
  })

  it('renders a NO_FILL as a completed outcome, never as an error or a pending fill', async () => {
    nextOutcome = {
      id: 'ex-2',
      symbol: 'NVDA',
      side: 'BUY',
      quantity: 4,
      status: 'NO_FILL',
      submittedAt: '2026-08-31T15:06:11Z',
      reasonCode: 'ENTRY_PRICE_ABOVE_BAND',
      sessionOnly: true,
      provenance: 'live',
    }
    open()
    await submit()
    await screen.findByText('No fill')
    expect(screen.getByText(/nothing was opened/i)).toBeInTheDocument()
    expect(screen.getByText('ENTRY_PRICE_ABOVE_BAND')).toBeInTheDocument()
    expect(screen.queryByText(/awaiting fill/i)).not.toBeInTheDocument()
    expect(screen.getByText(/no durable row/i)).toBeInTheDocument()
  })

  it('renders 422 rejection reasons verbatim, duplicates and all', async () => {
    nextOutcome = {
      id: 'plan-1',
      symbol: 'NVDA',
      side: 'BUY',
      quantity: 4,
      status: 'REJECTED',
      submittedAt: '2026-08-31T15:06:11Z',
      rejectionReasons: ['DTE_LT_1', 'DTE_LT_1', 'INSUFFICIENT_CASH'],
      provenance: 'live',
    }
    open()
    await submit()
    await screen.findByText('Rejected by policy')
    expect(screen.getAllByText('DTE_LT_1')).toHaveLength(2)
    expect(screen.getByText('INSUFFICIENT_CASH')).toBeInTheDocument()
  })

  it('treats a filled-but-unreported execution as recoverable, not a success toast', async () => {
    nextOutcome = {
      id: 'ex-3',
      symbol: 'NVDA',
      side: 'BUY',
      quantity: 4,
      price: 15.8,
      status: 'FILLED',
      submittedAt: '2026-08-31T15:06:11Z',
      reportedToPlatform: false,
      platformError: 'platform unreachable',
      sessionOnly: true,
      provenance: 'live',
    }
    open()
    await submit()
    await screen.findByText(/platform service was not updated/i)
    expect(screen.getByText(/Do not re-submit/i)).toBeInTheDocument()
  })

  it('retires the key after an outcome, so “place another” is a new operation (D6)', async () => {
    nextOutcome = {
      id: 'ex-4',
      symbol: 'NVDA',
      side: 'BUY',
      quantity: 4,
      status: 'NO_FILL',
      submittedAt: '2026-08-31T15:06:11Z',
      sessionOnly: true,
      provenance: 'live',
    }
    open()
    await submit()
    const firstKey = submitted[0].idempotencyKey
    expect(firstKey).toBeTruthy()

    await screen.findByText('No fill')
    fireEvent.click(screen.getByRole('button', { name: 'Place another' }))
    await submit(2)

    // A user's deliberate second attempt after a returned outcome is a new
    // operation. Reusing the key would replay the NO_FILL forever.
    expect(submitted[1].idempotencyKey).not.toBe(firstKey)
  })

  it('reuses the key when the request itself failed — the same operation, retried', async () => {
    nextOutcome = new Error('network down')
    open()
    fireEvent.click(screen.getByRole('button', { name: /\$190/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Review' }))
    const confirm = screen.getByRole('button', { name: /Hold to/ })
    fireEvent.pointerDown(confirm)
    await waitFor(() => expect(submitted).toHaveLength(1))
    fireEvent.pointerUp(confirm)
    fireEvent.pointerDown(confirm)
    await waitFor(() => expect(submitted).toHaveLength(2))

    // Nothing is known about whether the servers acted; the same key lets them
    // replay what they recorded instead of opening a second position.
    expect(submitted[1].idempotencyKey).toBe(submitted[0].idempotencyKey)
  })
})
