import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import type { PortfolioOutlook } from '@/api/types'
import { AIOutlookPanel, MobileAIInsights } from '@/components/portfolio/AIOutlookPanel'
import { useAssistantChatStore } from '@/store/assistantChatStore'

const outlook: PortfolioOutlook = {
  stance: 'Constructive with discipline',
  headline: 'Quality setups remain intact.',
  summary: 'Stay selective while the strongest positions continue to lead.',
  score: 78,
  scoreLabel: 'Portfolio score',
  signals: [
    { label: 'Trend', detail: 'Momentum remains constructive.', tone: 'positive' },
  ],
  updatedAt: '2026-08-08T12:00:00.000Z',
}

describe('MobileAIInsights', () => {
  beforeEach(() => {
    useAssistantChatStore.setState({ messages: [], mode: 'bubble', thinking: false })
  })

  it('opens from the floating AI launcher and minimizes back to it', async () => {
    render(
      <MemoryRouter>
        <MobileAIInsights outlook={outlook} valuations={[]} />
      </MemoryRouter>,
    )

    const launcher = screen.getByRole('button', { name: 'Open StratFolio AI Insights' })
    fireEvent.click(launcher)

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'StratFolio AI sections' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Keys' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Actions' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tests' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Chats' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Minimize StratFolio Insights' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Open StratFolio AI Insights' })).toBeInTheDocument()
  })
})

describe('AIOutlookPanel desktop workspace', () => {
  beforeEach(() => {
    useAssistantChatStore.setState({ messages: [], mode: 'bubble', thinking: false })
  })

  it('opens a dated chat summary and shows the AI actions taken', () => {
    render(
      <MemoryRouter>
        <AIOutlookPanel outlook={outlook} valuations={[]} />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Chats' }))
    fireEvent.click(screen.getByRole('button', { name: /Should we keep the MU calls/i }))

    expect(screen.getByText('AI actions taken')).toBeInTheDocument()
    expect(screen.getByText('Ran an earnings volatility-crush test')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to chats' })).toBeInTheDocument()
  })
})
