import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { PlannerIdea } from '@/api/newsTypes'
import type { PositionValuation } from '@/lib/portfolioMath'
import { UpcomingTradePlans } from '@/components/plan/UpcomingTradePlans'
import { usePlanExecutionStore } from '@/store/planExecutionStore'

function plan(
  id: string,
  status: PlannerIdea['status'],
  source: PlannerIdea['source'] = 'user',
): PlannerIdea {
  return {
    id,
    source,
    symbol: id.toUpperCase(),
    company: `${id} company`,
    assetType: 'stock',
    direction: 'LONG',
    status,
    positionId: `${id}-position`,
    title: id === 'ready' ? 'Close on Aug 20 at open if earnings missed.' : `${id} entry plan`,
    originalPrompt:
      id === 'ready' ? 'Close on Aug 20 at open if earnings missed.' : undefined,
    notes: `${id} criteria are nearly satisfied.`,
    entryLow: 10,
    entryHigh: 12,
    targetLow: 18,
    targetHigh: 20,
    stop: 8,
    horizon: 'This week',
    expectedUpsidePct: 50,
    categories: ['stocks'],
    catalysts: [],
    risks: [],
    createdAt: '2026-08-08T00:00:00.000Z',
    author: 'You',
  }
}

describe('UpcomingTradePlans', () => {
  it('shows two ranked rows by default and can reveal the remaining plan', () => {
    usePlanExecutionStore.setState({ disabledIds: [] })
    const readyValuation = {
      position: { id: 'ready-position', quantity: 6 },
      marketValue: 2400,
      totalReturn: 450,
    } as PositionValuation

    // The prompt editor is a mutation, so the component needs a client.
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const { container } = render(
      <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <UpcomingTradePlans
          plans={[
            plan('draft', 'draft', 'ai'),
            plan('ready', 'ready'),
            plan('watching', 'watching'),
            plan('fourth', 'ready', 'ai'),
          ]}
          valuations={[readyValuation]}
          portfolioValue={100_000}
        />
      </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(screen.getByRole('link', { name: /Plans Executing Soon/ })).toHaveAttribute(
      'href',
      '/app/plan?sort=trigger-soon',
    )
    expect(
      screen.getAllByText(/Trade plans which are active and close to automatic execution/),
    ).toHaveLength(2)
    expect(container.querySelector('.plan-stopwatch-hand')).toBeInTheDocument()
    expect(container.querySelector('.plan-handoff-dots')).not.toBeInTheDocument()
    let rows = Array.from(container.querySelectorAll<HTMLElement>('[data-plan-source] > button'))
    expect(rows).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Show 1 more plans' }))
    rows = Array.from(container.querySelectorAll<HTMLElement>('[data-plan-source] > button'))
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent('READY')
    expect(container.querySelectorAll('[data-plan-source="user"]')).toHaveLength(2)
    expect(container.querySelectorAll('[data-plan-source="ai"]')).toHaveLength(1)
    // Readiness reads as a ring: the figure and its percent sit inside, "chance" beneath.
    expect(rows.every((row) => /\d+%\s*chance/i.test(row.textContent ?? ''))).toBe(true)

    fireEvent.click(rows[0])
    expect(screen.getByText('ready criteria are nearly satisfied.')).toBeInTheDocument()
    expect(screen.getByText('$10.00–$12.00')).toBeInTheDocument()
    expect(screen.getByText('Close')).toBeInTheDocument()
    expect(screen.getByText('Profit')).toBeInTheDocument()
    expect(screen.queryByText('Max')).not.toBeInTheDocument()
    expect(screen.getByText('+$450.00')).toBeInTheDocument()
    expect(screen.getByText('Qty')).toBeInTheDocument()
    expect(screen.getByText('Current value')).toBeInTheDocument()
    expect(screen.getByText('$2,400')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Execute' })).toBeInTheDocument()

    vi.useFakeTimers()
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Disable plan' }))
    act(() => vi.advanceTimersByTime(700))
    expect(screen.getByText(/Disable plan for/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Disable' }))
    expect(container.querySelector('[data-plan-disabled="true"]')).toBeInTheDocument()
    expect(screen.getByText('Disabled')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Execute' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Disable plan' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Activate plan' }))
    expect(container.querySelector('[data-plan-disabled="true"]')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Disable plan' })).toBeInTheDocument()
    vi.useRealTimers()
  })
})
