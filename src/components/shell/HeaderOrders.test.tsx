import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { Order } from '@/api/types'

const ORDERS: Order[] = [
  {
    id: 'o-filled',
    symbol: 'MU',
    company: "MU $150 C · Jan 15 '27",
    side: 'BUY',
    quantity: 3,
    price: 16.2,
    estimatedValue: 4860,
    status: 'FILLED',
    submittedAt: '2026-08-24T13:45:02Z',
    provenance: 'live',
  },
  {
    id: 'o-pending',
    symbol: 'NVDA',
    side: 'BUY',
    quantity: 4,
    price: 15.75,
    estimatedValue: 6400,
    status: 'SUBMITTED',
    submittedAt: '2026-08-30T17:20:00Z',
    provenance: 'live',
  },
  {
    id: 'o-nofill',
    symbol: 'AMD',
    side: 'BUY',
    quantity: 2,
    status: 'NO_FILL',
    submittedAt: '2026-08-31T18:00:00Z',
    provenance: 'live',
  },
  {
    id: 'o-rejected',
    symbol: 'COIN',
    side: 'BUY',
    quantity: 1,
    status: 'REJECTED',
    rejectionReasons: ['DTE_LT_1'],
    submittedAt: '2026-08-31T09:14:00Z',
    provenance: 'live',
  },
]

const getOrders = vi.fn(async (): Promise<Order[]> => ORDERS)
vi.mock('@/api', () => ({ portfolioApi: { getOrders: () => getOrders() } }))

const { HeaderOrders } = await import('@/components/shell/HeaderOrders')

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

/**
 * The header used to render four hard-coded option orders — invented
 * contracts, sizes, totals and brokerages, two of them permanently "PENDING"
 * — in the chrome of every screen. These tests pin it to the order seam.
 */
describe('HeaderOrders', () => {
  it('renders real orders from the seam rather than a hard-coded fixture', async () => {
    render(<HeaderOrders />, { wrapper })

    const trigger = await screen.findByRole('button', { name: /Recent orders/i })
    expect(trigger).toHaveTextContent('PENDING')
    expect(trigger).toHaveTextContent('NVDA')
    expect(trigger).toHaveTextContent('QTY 4')
    expect(trigger).toHaveTextContent('AMT $6,400')
  })

  it('renders each outcome distinctly — a NO_FILL is neither pending nor a fill', async () => {
    render(<HeaderOrders />, { wrapper })
    const trigger = await screen.findByRole('button', { name: /Recent orders/i })
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })

    const menu = within(screen.getByRole('menu'))
    expect(menu.getByText('FILLED')).toBeInTheDocument()
    // bkt returns NO_FILL on a *successful* 201 with nothing opened (§7.8).
    expect(menu.getByText('NO FILL')).toBeInTheDocument()
    expect(menu.getByText('REJECTED')).toBeInTheDocument()
  })

  it('shows a dash rather than $0 where there is genuinely no price', async () => {
    render(<HeaderOrders />, { wrapper })
    const trigger = await screen.findByRole('button', { name: /Recent orders/i })
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })

    const menu = within(screen.getByRole('menu'))
    // The NO_FILL and REJECTED rows have no price and no notional between
    // them; a $0.00 would claim a free trade happened.
    expect(menu.getAllByText('—').length).toBeGreaterThanOrEqual(4)
    expect(menu.queryByText('$0.00')).not.toBeInTheDocument()
  })

  it('labels the list honestly — NO_FILL history is not durable (HKP-BKT-4)', async () => {
    render(<HeaderOrders />, { wrapper })
    const trigger = await screen.findByRole('button', { name: /Recent orders/i })
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })
    expect(within(screen.getByRole('menu')).getByText(/Fills & pending plans/i)).toBeInTheDocument()
  })

  it('renders nothing at all when there are no orders', async () => {
    getOrders.mockResolvedValueOnce([])
    const { container } = render(<HeaderOrders />, { wrapper })
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })
})
