import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const navigateSpy = vi.fn()
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<typeof import('react-router-dom')>('react-router-dom')),
  useNavigate: () => navigateSpy,
}))
import type { Idea, ThesisView } from '@/api/types'
import { RecTile } from '@/components/thesis/RecTile'

vi.mock('@/store/priceStore', () => ({
  usePrice: () => ({
    symbol: 'NVDA',
    price: 142,
    previousClose: 140,
    open: 140,
    dayChange: 2,
    dayChangePct: 1.2,
    history: Array.from({ length: 40 }, (_, i) => 132 + Math.sin(i / 3) * 6 + i * 0.2),
  }),
}))

const idea = {
  id: 'idea-nvda-call',
  symbol: 'NVDA',
  company: 'NVIDIA',
  assetType: 'option',
  categories: ['options'],
  forYou: true,
  referencePrice: 140,
  entryLow: 8,
  entryHigh: 10,
  targetLow: 20,
  targetHigh: 24,
  expectedUpsidePct: 120,
  catalysts: ['Blackwell supply is committed through next year.'],
  risks: ['The position is already crowded.'],
  tags: [],
  option: {
    right: 'CALL',
    strike: 150,
    expiry: '2027-01-15',
    expiryLabel: "Jan 15 '27",
    extrinsicBase: 9,
  },
  ai: {
    conviction: 88,
    convictionDelta: 4,
    recommendation: 'BUY',
    recommendationNote: 'Scale into the entry band while the supply thesis remains intact.',
    horizon: 'Three months',
    upsideTarget: 24,
    downsideRisk: 0,
    riskRewardRatio: 2.4,
    targetLow: 20,
    targetHigh: 24,
    thesis: ['Committed supply supports the setup.'],
    updatedAt: '2026-08-08T00:00:00.000Z',
  },
} satisfies Idea

/** The thesis the demo idea hangs off — the shape `MockIdeasApi` produces. */
const thesis: ThesisView = {
  id: idea.id,
  symbol: idea.symbol,
  direction: 'BULLISH',
  rationale: idea.ai.thesis[0],
  // Fractional on the wire and in the view model (§7.4).
  confidence: idea.ai.conviction / 100,
  source: 'ai',
  createdAt: idea.ai.updatedAt,
  provenance: 'mock',
  idea,
}

function renderTile() {
  // The footer's "plan it" action is a mutation, so the tile needs a client.
  // Retries off keeps a failed mutation from stalling a test.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <RecTile thesis={thesis} idea={idea} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('RecTile', () => {
  it('opens on the thesis page and pages through to catalyst and invalidation', () => {
    renderTile()

    expect(screen.getByText('Thesis')).toBeInTheDocument()
    expect(screen.getByText(idea.ai.recommendationNote)).toBeInTheDocument()
    expect(screen.getByText('1/4')).toBeInTheDocument()

    const next = screen.getByRole('button', { name: 'Next thesis page' })
    fireEvent.click(next)
    expect(screen.getByText('Edge')).toBeInTheDocument()

    fireEvent.click(next)
    expect(screen.getByText('Catalyst')).toBeInTheDocument()
    expect(screen.getByText(idea.catalysts[0])).toBeInTheDocument()

    fireEvent.click(next)
    expect(screen.getByText('Invalidation')).toBeInTheDocument()
    expect(screen.getByText(idea.risks[0])).toBeInTheDocument()
  })

  it('wraps the pager backwards from the first page', () => {
    renderTile()

    fireEvent.click(screen.getByRole('button', { name: 'Previous thesis page' }))
    expect(screen.getByText('4/4')).toBeInTheDocument()
    expect(screen.getByText('Invalidation')).toBeInTheDocument()
  })

  it('renders the setup cone with break-even inside it when the move is priced', () => {
    const { container } = renderTile()

    // Break-even is strike 150 + a 9.00 debit = 159, against a spot of 142 and
    // a long-dated contract — comfortably within one sigma.
    const breakeven = container.querySelector('[data-testid="thesis-breakeven"]')
    expect(breakeven).toBeInTheDocument()
    expect(breakeven).toHaveAttribute('data-inside-cone', 'true')
    expect(screen.getByRole('img', { name: /break-even 159\.00/i })).toBeInTheDocument()
  })

  it('sizes the trade and states its economics', () => {
    renderTile()

    // $3,000 risk budget over a $900 contract → 3 contracts.
    expect(screen.getByText('+ 3')).toBeInTheDocument()
    expect(screen.getByText('$2,700')).toBeInTheDocument()
    expect(screen.getByText('$6,600')).toBeInTheDocument()
    expect(screen.getByText('+$3,900')).toBeInTheDocument()
  })

  it('surfaces the volatility and model case in the quant rail', () => {
    renderTile()

    expect(screen.getByText('IV rank')).toBeInTheDocument()
    expect(screen.getByText('IV/HV')).toBeInTheDocument()
    expect(screen.getByText('Model')).toBeInTheDocument()
    expect(screen.getByText('R:R')).toBeInTheDocument()
    expect(screen.getByText('EV')).toBeInTheDocument()
  })
})

describe('RecTile footer', () => {
  it('sends a contract-scoped question into the shared assistant thread', async () => {
    const { useAssistantChatStore } = await import('@/store/assistantChatStore')
    useAssistantChatStore.setState({ messages: [], mode: 'bubble', thinking: false, unread: false })

    renderTile()
    const input = screen.getByLabelText('Ask AI about the NVDA thesis')
    fireEvent.change(input, { target: { value: 'why not AMD?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send question to StratFolio AI' }))

    const sent = useAssistantChatStore.getState().messages[0]
    expect(sent.role).toBe('user')
    expect(sent.text).toBe("About the NVDA $150C Jan 15 '27 thesis — why not AMD?")
    // Sending opens the window; the tile itself must not navigate.
    expect(useAssistantChatStore.getState().mode).toBe('window')
  })

  it('offers a rival in the prompt and records a rejection', async () => {
    const { useThesisDecisionStore } = await import('@/store/thesisDecisionStore')
    useThesisDecisionStore.setState({ decisions: {} })

    renderTile()
    expect(screen.getByLabelText('Ask AI about the NVDA thesis')).toHaveAttribute(
      'placeholder',
      'Ask AI anything about this thesis… ex) "why not AMD?"',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Reject the NVDA thesis' }))
    // Rejecting opens a confirmation so the reason can be captured first.
    expect(useThesisDecisionStore.getState().decisions['idea-nvda-call']).toBeUndefined()

    fireEvent.click(screen.getByRole('button', { name: 'Close thesis' }))
    expect(useThesisDecisionStore.getState().decisions['idea-nvda-call'].decision).toBe('rejected')
  })

  it('sends the rejection reason to the assistant and records it', async () => {
    const { useThesisDecisionStore } = await import('@/store/thesisDecisionStore')
    const { useAssistantChatStore } = await import('@/store/assistantChatStore')
    useThesisDecisionStore.setState({ decisions: {} })
    useAssistantChatStore.setState({ messages: [], mode: 'bubble', thinking: false, unread: false })

    renderTile()
    fireEvent.click(screen.getByRole('button', { name: 'Reject the NVDA thesis' }))
    fireEvent.change(screen.getByPlaceholderText(/give a reason for AI/i), {
      target: { value: 'strike is too far out' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Close thesis' }))

    expect(useThesisDecisionStore.getState().decisions['idea-nvda-call'].reason).toBe(
      'strike is too far out',
    )
    expect(useAssistantChatStore.getState().messages[0].text).toContain('I passed on the NVDA')
    expect(useAssistantChatStore.getState().messages[0].reference?.kind).toBe('thesis')
  })
})

describe('RecTile modal isolation', () => {
  beforeEach(() => navigateSpy.mockClear())

  it('closes the reject modal on Back without opening the thesis behind it', async () => {
    const { useThesisDecisionStore } = await import('@/store/thesisDecisionStore')
    useThesisDecisionStore.setState({ decisions: {} })

    renderTile()
    fireEvent.click(screen.getByRole('button', { name: 'Reject the NVDA thesis' }))
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))

    // Radix portals the dialog, but React events still bubble up the component
    // tree — Back used to reach the tile's own click handler and navigate.
    expect(screen.queryByRole('button', { name: 'Close thesis' })).toBeNull()
    expect(useThesisDecisionStore.getState().decisions['idea-nvda-call']).toBeUndefined()
    expect(navigateSpy).not.toHaveBeenCalled()
  })
})

describe('RecTile decision action', () => {
  it('opens the accept modal and carries the typed note in', async () => {
    const { useThesisDecisionStore } = await import('@/store/thesisDecisionStore')
    useThesisDecisionStore.setState({ decisions: {} })

    renderTile()
    fireEvent.change(screen.getByLabelText('Ask AI about the NVDA thesis'), {
      target: { value: 'only above 145' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^Accept the NVDA thesis/ }))

    // Accepting is a decision, so it confirms rather than firing on one tap —
    // and it records a disposition rather than deriving a trade plan (§3.3).
    const note = screen.getByPlaceholderText(/why this thesis fits/i)
    expect(note).toHaveValue('only above 145')
    expect(screen.getByRole('button', { name: 'Accept thesis' })).toBeInTheDocument()
  })
})
