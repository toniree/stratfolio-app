import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Idea } from '@/api/types'
import { TradeIdeaCharts } from '@/components/thesis/TradeIdeaCharts'

vi.mock('@/components/positions/PositionQuickView', () => ({
  MarketChartBlock: ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div role="img" aria-label={`${title}. ${subtitle}`} />
  ),
}))

const idea = {
  id: 'idea-nvda-call',
  symbol: 'NVDA',
  entryLow: 8,
  entryHigh: 10,
  targetLow: 20,
  targetHigh: 24,
  option: {
    right: 'CALL',
    strike: 150,
    expiry: '2027-01-15',
    expiryLabel: "Jan 15 '27",
    extrinsicBase: 9,
  },
} as Idea

describe('TradeIdeaCharts', () => {
  it('renders one-month underlying and three-month option charts', () => {
    render(<TradeIdeaCharts idea={idea} underlyingPrice={142} />)

    expect(screen.getByRole('heading', { name: 'Market context' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /NVDA underlying · 1M/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Option premium · 3M/ })).toBeInTheDocument()
    expect(screen.getAllByRole('img')).toHaveLength(2)
  })
})
