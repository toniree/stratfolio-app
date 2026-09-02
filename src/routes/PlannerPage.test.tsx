import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlannerIdea } from '@/api/newsTypes'
import { PlannerPage } from '@/routes/PlannerPage'
import { usePlanExecutionStore } from '@/store/planExecutionStore'

const plans = [
  { id: 'active-ai', source: 'ai', symbol: 'AI' },
  { id: 'disabled-user', source: 'user', symbol: 'YOU' },
] as PlannerIdea[]

vi.mock('@/hooks/queries', () => ({
  usePlannerIdeas: () => ({ data: plans, isLoading: false }),
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

  it('no longer offers the client-side AI composer', () => {
    render(
      <MemoryRouter>
        <PlannerPage />
      </MemoryRouter>,
    )

    // The composer was a regex over the prompt that invented an entry band, a
    // target band, a stop and a horizon from a seeded open price. The real
    // composer is service-ai's (HKP-AI-3a, Wave C).
    expect(screen.queryByRole('textbox', { name: 'Trade plan prompt' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument()
  })
})
