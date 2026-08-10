import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { FloatingAssistant } from '@/components/assistant/FloatingAssistant'
import { useAssistantChatStore } from '@/store/assistantChatStore'

function renderAt(pathname = '/app/portfolio') {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <FloatingAssistant />
    </MemoryRouter>,
  )
}

describe('FloatingAssistant', () => {
  beforeEach(() => {
    useAssistantChatStore.setState({
      messages: [{ id: 'assistant-1', role: 'assistant', text: 'Your thread is preserved.' }],
      mode: 'window',
      thinking: false,
    })
  })

  it('minimizes to a continuation bubble and restores the same thread', async () => {
    renderAt()

    expect(screen.getByRole('region', { name: 'StratFolio assistant chat' })).toBeInTheDocument()
    expect(screen.getByText('Your thread is preserved.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Minimize assistant chat' }))
    const bubble = await screen.findByRole('button', { name: 'Continue assistant chat' })
    fireEvent.click(bubble)

    await waitFor(() => {
      expect(
        screen.getByRole('region', { name: 'StratFolio assistant chat' }),
      ).toBeInTheDocument()
    })
    expect(screen.getByText('Your thread is preserved.')).toBeInTheDocument()
  })
})

describe('FloatingAssistant context', () => {
  it('stays out of the way on the settings page', () => {
    useAssistantChatStore.setState({
      messages: [{ id: 'assistant-1', role: 'assistant', text: 'Still here.' }],
      mode: 'window',
      thinking: false,
    })

    render(
      <MemoryRouter initialEntries={['/app/profile']}>
        <FloatingAssistant />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('region', { name: 'StratFolio assistant chat' })).toBeNull()
  })

  it('summarises the referenced thesis once and links through to it', () => {
    const reference = {
      kind: 'thesis' as const,
      id: 'idea-nvda-call',
      label: "NVDA $150C JAN 15 '27",
      detail: 'Long call · BUY',
      to: '/app/thesis/idea-nvda-call',
    }
    useAssistantChatStore.setState({
      messages: [
        { id: 'user-1', role: 'user', text: 'why not AMD?', reference },
        { id: 'assistant-1', role: 'assistant', text: 'Because…', reference },
      ],
      mode: 'window',
      thinking: false,
    })

    render(
      <MemoryRouter initialEntries={['/app/portfolio']}>
        <FloatingAssistant />
      </MemoryRouter>,
    )

    // One card for the run of turns, not one per message.
    const links = screen.getAllByRole('link', { name: /NVDA \$150C/ })
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', '/app/thesis/idea-nvda-call')
    expect(screen.getByText('Trade thesis')).toBeInTheDocument()
  })
})
