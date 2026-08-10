import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Idea } from '@/api/types'
import { IdeasPage } from '@/routes/IdeasPage'
import { useThesisDecisionStore } from '@/store/thesisDecisionStore'

const ideas = [
  { id: 'nvda-thesis', source: 'ai', symbol: 'NVDA', company: 'NVIDIA' },
  { id: 'tsm-thesis', source: 'user', symbol: 'TSM', company: 'Taiwan Semiconductor' },
  { id: 'rejected-thesis', source: 'ai', symbol: 'MU', company: 'Micron' },
] as Idea[]

vi.mock('@/hooks/queries', () => ({
  useIdeas: () => ({ data: ideas, isLoading: false }),
}))

vi.mock('@/components/thesis/IdeaCard', () => ({
  IdeaCard: ({ idea }: { idea: Idea }) => <div>{idea.id}</div>,
}))

describe('IdeasPage thesis search', () => {
  beforeEach(() => {
    useThesisDecisionStore.setState({
      decisions: { 'rejected-thesis': { decision: 'rejected' } },
    })
  })

  it('searches open theses by ticker and by company, and never surfaces rejected ones', () => {
    render(
      <MemoryRouter>
        <IdeasPage />
      </MemoryRouter>,
    )

    const search = screen.getByLabelText('Search theses by ticker')
    expect(screen.getByText('nvda-thesis')).toBeInTheDocument()
    expect(screen.getByText('tsm-thesis')).toBeInTheDocument()
    expect(screen.queryByText('rejected-thesis')).not.toBeInTheDocument()

    // Ticker match, case-insensitive.
    fireEvent.change(search, { target: { value: 'nvd' } })
    expect(screen.getByText('nvda-thesis')).toBeInTheDocument()
    expect(screen.queryByText('tsm-thesis')).not.toBeInTheDocument()

    // Company name also matches.
    fireEvent.change(search, { target: { value: 'taiwan' } })
    expect(screen.getByText('tsm-thesis')).toBeInTheDocument()
    expect(screen.queryByText('nvda-thesis')).not.toBeInTheDocument()

    // A rejected thesis stays hidden even when its ticker is searched.
    fireEvent.change(search, { target: { value: 'MU' } })
    expect(screen.queryByText('rejected-thesis')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(screen.getByText('nvda-thesis')).toBeInTheDocument()
  })
})
