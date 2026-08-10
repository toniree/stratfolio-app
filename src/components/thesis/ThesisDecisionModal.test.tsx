import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Idea } from '@/api/types'
import { ThesisDecisionModal } from '@/components/thesis/ThesisDecisionModal'

const idea = {
  id: 'idea-nvda-call',
  symbol: 'NVDA',
  company: 'NVIDIA',
  contractDetail: "Jan 15 '27 · $150 Call",
} as Idea

describe('ThesisDecisionModal', () => {
  it('passes an optional plan refinement through the add action', () => {
    const onConfirm = vi.fn()
    render(
      <ThesisDecisionModal
        idea={idea}
        mode="add"
        open
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
      />,
    )

    expect(screen.getByText(/Prompt is optional/i)).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText(/max capital, targets and bands/i), {
      target: { value: 'Cap the position at one contract.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add trade plan' }))

    expect(onConfirm).toHaveBeenCalledWith('Cap the position at one contract.')
  })

  it('explains that rejection feedback helps the model learn', () => {
    render(
      <ThesisDecisionModal
        idea={idea}
        mode="reject"
        open
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    expect(screen.getByText(/helps the model learn/i)).toBeInTheDocument()
    // Destructive styling now comes from the shared button variant.
    expect(screen.getByRole('button', { name: 'Close thesis' })).toHaveClass('bg-red-400/85')
  })
})
