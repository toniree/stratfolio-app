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
  it('passes an optional note through the accept action', () => {
    const onConfirm = vi.fn()
    render(
      <ThesisDecisionModal
        symbol={idea.symbol}
        label={idea.contractDetail ?? idea.company}
        mode="add"
        open
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
      />,
    )

    // Accepting records a decision. It does not create a plan, and the copy
    // must not promise one: the client-side derivation is gone (§3.3).
    expect(screen.getByText(/does not place a trade or create a plan/i)).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText(/why this thesis fits/i), {
      target: { value: 'Cap the position at one contract.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Accept thesis' }))

    expect(onConfirm).toHaveBeenCalledWith('Cap the position at one contract.')
  })

  it('explains that rejection feedback helps the model learn', () => {
    render(
      <ThesisDecisionModal
        symbol={idea.symbol}
        label={idea.contractDetail ?? idea.company}
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
