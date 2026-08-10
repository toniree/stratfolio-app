import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlannerIdea } from '@/api/newsTypes'
import { PlannerPage } from '@/routes/PlannerPage'
import { usePlanExecutionStore } from '@/store/planExecutionStore'

const plans = [
  { id: 'active-ai', source: 'ai', symbol: 'AI' },
  { id: 'disabled-user', source: 'user', symbol: 'YOU' },
] as PlannerIdea[]

const createMutation = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
}))

vi.mock('@/hooks/queries', () => ({
  usePlannerIdeas: () => ({ data: plans, isLoading: false }),
  useCreatePlannerIdea: () => createMutation,
}))

vi.mock('@/components/plan/PlannerIdeaTile', () => ({
  PlannerIdeaTile: ({ idea, disabled }: { idea: PlannerIdea; disabled?: boolean }) => (
    <div data-disabled={disabled || undefined}>{idea.id}</div>
  ),
  DirectionChip: () => null,
  SourceBadge: () => null,
}))

vi.mock('@/components/plan/CreateIdeaModal', () => ({
  CreateIdeaModal: () => null,
}))

describe('PlannerPage filters', () => {
  beforeEach(() => {
    usePlanExecutionStore.setState({ disabledIds: ['disabled-user'] })
    createMutation.mutateAsync.mockReset()
    createMutation.mutateAsync.mockResolvedValue({ id: 'created-plan' })
  })

  it('uses the summary strip as the only filter and includes disabled plans', () => {
    render(
      <MemoryRouter>
        <PlannerPage />
      </MemoryRouter>,
    )

    expect(screen.getAllByRole('tab')).toHaveLength(4)
    expect(screen.getByRole('tab', { name: /All plans/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /AI plans/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Your plans/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Disabled/ })).toBeInTheDocument()
    expect(screen.getByText('active-ai')).toBeInTheDocument()
    expect(screen.getByText('disabled-user')).toHaveAttribute('data-disabled', 'true')

    fireEvent.click(screen.getByRole('tab', { name: /Disabled/ }))
    expect(screen.queryByText('active-ai')).not.toBeInTheDocument()
    expect(screen.getByText('disabled-user')).toBeInTheDocument()
  })

  it('creates an AI-organized plan from the chat composer', async () => {
    render(
      <MemoryRouter>
        <PlannerPage />
      </MemoryRouter>,
    )

    expect(screen.queryByText('Trade Planner')).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'Trade plan prompt' }), {
      target: { value: '5000 on SNDK earnings run-up, sell when doubles' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() =>
      expect(createMutation.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'SNDK',
          maxAmount: 5000,
          originalPrompt: '5000 on SNDK earnings run-up, sell when doubles',
        }),
      ),
    )
  })
})
