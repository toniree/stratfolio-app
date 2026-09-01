import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Idea, ThesisView } from '@/api/types'
import { IdeasPage } from '@/routes/IdeasPage'
import { useThesisDecisionStore } from '@/store/thesisDecisionStore'

/** Two enriched theses (the demo shape) and one live-shaped thesis with no
 *  `idea` at all — the search must treat both the same. */
const theses = [
  {
    id: 'nvda-thesis',
    symbol: 'NVDA',
    source: 'ai',
    idea: { id: 'nvda-thesis', symbol: 'NVDA', company: 'NVIDIA' },
  },
  {
    id: 'tsm-thesis',
    symbol: 'TSM',
    source: 'user',
    idea: { id: 'tsm-thesis', symbol: 'TSM', company: 'Taiwan Semiconductor' },
  },
  { id: 'rejected-thesis', symbol: 'MU', source: 'ai' },
] as ThesisView[]

vi.mock('@/hooks/queries', () => ({
  useTheses: () => ({ data: theses, isLoading: false }),
}))

vi.mock('@/components/thesis/IdeaCard', () => ({
  IdeaCard: ({ idea }: { idea: Idea }) => <div>{idea.id}</div>,
}))

vi.mock('@/components/thesis/ThesisCard', () => ({
  ThesisCard: ({ thesis }: { thesis: ThesisView }) => <div>{thesis.id}</div>,
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
