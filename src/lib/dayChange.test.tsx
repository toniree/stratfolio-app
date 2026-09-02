import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import {
  DAY_CHANGE_UNKNOWN,
  dayChangeOf,
  dayChangeSortKey,
  dayPlOf,
  dayPlOver,
  dayPlTotal,
} from '@/lib/dayChange'
import { computeTotals, valuePosition } from '@/lib/portfolioMath'
import { optionMarkKey } from '@/api/http/adapters/market'
import type { OptionMarkMap, PriceMap } from '@/api/marketData/types'
import type { Position } from '@/api/types'

/**
 * The fabricated-zero regression.
 *
 * A contract marked from the mnd chain has a price now and no prior mark — the
 * facade exposes no historical chain — so `valuePosition()` leaves `dayChange`
 * at 0 and flags the basis `unavailable`. Rendering that 0 as "+0.00%" states
 * that the position is *flat today*, which is a confident factual claim where
 * the truth is "unknown". These tests assert no surface makes that claim.
 */

vi.mock('@/hooks/marketQueries', () => ({
  // The tiles fetch their own chain values; the valuation under test already
  // carries the mark, and an unmocked hook would try to reach the network.
  useOptionMarks: () => ({ marks: {}, isFetching: false, isError: false }),
  isMarketLive: () => false,
  useLiveChain: () => ({ data: undefined, isFetching: false, isError: false }),
  useMarketSnapshot: () => ({ data: undefined }),
  useLiveBars: () => ({ data: undefined }),
  useMarketStatus: () => ({ data: undefined }),
}))

const EXPIRY = '2026-12-18'

const markedOption: Position = {
  id: 'p-marked',
  symbol: 'SPY',
  assetType: 'option',
  quantity: 2,
  avgCost: 5,
  openedAt: '2026-08-01T00:00:00Z',
  provenance: 'live',
  option: { right: 'CALL', strike: 600, expiry: EXPIRY, expiryLabel: "Dec 18 '26" },
}

const stock: Position = {
  id: 'p-stock',
  symbol: 'AAA',
  assetType: 'stock',
  quantity: 10,
  avgCost: 90,
  openedAt: '2026-08-01T00:00:00Z',
  provenance: 'live',
}

const prices: PriceMap = {
  AAA: {
    symbol: 'AAA',
    price: 100,
    previousClose: 95,
    open: 96,
    dayChange: 5,
    dayChangePct: 5.263,
    history: [95, 100],
    provenance: 'live',
  },
}

const key = optionMarkKey({ symbol: 'SPY', right: 'CALL', strike: 600, expiry: EXPIRY })
const marks: OptionMarkMap = {
  [key]: { key, occSymbol: 'SPY261218C00600000', mid: 9.4, provenance: 'replay' },
}

const markedValuation = valuePosition(markedOption, prices, marks)
const quotedValuation = valuePosition(stock, prices)

describe('day-change formatting', () => {
  it('renders "—" — never a signed zero — when the basis is unavailable', () => {
    expect(markedValuation.dayChangeBasis).toBe('unavailable')
    const view = dayChangeOf(markedValuation)
    expect(view.available).toBe(false)
    expect(view.money).toBe(DAY_CHANGE_UNKNOWN)
    expect(view.percent).toBe(DAY_CHANGE_UNKNOWN)
    expect(view.combined).toBe(DAY_CHANGE_UNKNOWN)
    // No colour either: green or red is itself a direction claim.
    expect(view.tone).toBeUndefined()
    expect(view.title).toBeTruthy()
    // Screen readers get words, not a dash.
    expect(view.accessible).toMatch(/unavailable/i)
  })

  it('still formats a real day change', () => {
    const view = dayChangeOf(quotedValuation)
    expect(view.available).toBe(true)
    expect(view.money).toBe('+$5.00')
    expect(view.tone).toBe('up')
    expect(view.title).toBeUndefined()
  })

  it('withholds a holding’s day P/L on the same basis', () => {
    expect(dayPlOf(markedValuation).money).toBe(DAY_CHANGE_UNKNOWN)
    expect(dayPlOf(quotedValuation).money).toBe('+$50.00')
  })

  it('withholds a book total that would be a partial sum', () => {
    const mixed = computeTotals([stock, markedOption], prices, marks)
    expect(dayPlTotal(mixed).available).toBe(false)
    expect(dayPlTotal(mixed).money).toBe(DAY_CHANGE_UNKNOWN)

    const measurable = computeTotals([stock], prices)
    expect(dayPlTotal(measurable).available).toBe(true)
    expect(dayPlTotal(measurable).money).toBe('+$50.00')
  })

  it('scopes availability to the filtered subset, not the whole book', () => {
    // A brokerage filter showing only the measurable holding must still show a
    // number; one that includes the marked contract must not.
    expect(dayPlOver([quotedValuation]).available).toBe(true)
    expect(dayPlOver([quotedValuation, markedValuation]).available).toBe(false)
  })

  it('sorts unmeasured holdings to the end rather than among the flat ones', () => {
    expect(dayChangeSortKey(markedValuation)).toBe(Number.NEGATIVE_INFINITY)
    expect(dayChangeSortKey(quotedValuation)).toBeCloseTo(quotedValuation.dayChangePct, 6)
  })
})

/* ------------------------------------------------------------------ render */

function renderWithProviders(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>,
  )
}

/** Any signed zero a day-change cell could plausibly print. */
const SIGNED_ZERO = /[+−-]\s?\$?0\.00\s?%?/

describe('no fabricated zero reaches the DOM', () => {
  it('the position tile shows a dash, not +$0.00 (+0.00%)', async () => {
    const { PositionTile } = await import('@/components/positions/PositionTile')
    const { container } = renderWithProviders(<PositionTile valuation={markedValuation} />)
    const text = container.textContent ?? ''
    expect(text).toContain(DAY_CHANGE_UNKNOWN)
    expect(text).not.toMatch(SIGNED_ZERO)
  })

  it('the position card shows a dash', async () => {
    const { PositionCard } = await import('@/components/positions/PositionCard')
    const { container } = renderWithProviders(<PositionCard valuation={markedValuation} />)
    expect(container.textContent ?? '').not.toMatch(SIGNED_ZERO)
  })

  it('the holdings table day column shows a dash', async () => {
    const { HoldingsTable } = await import('@/components/positions/HoldingsTable')
    const { container } = renderWithProviders(
      <HoldingsTable valuations={[markedValuation]} totalMarketValue={markedValuation.marketValue} />,
    )
    const text = container.textContent ?? ''
    expect(text).toContain(DAY_CHANGE_UNKNOWN)
    expect(text).not.toMatch(SIGNED_ZERO)
  })

  it('a real day change still renders as a number', async () => {
    const { HoldingsTable } = await import('@/components/positions/HoldingsTable')
    renderWithProviders(
      <HoldingsTable
        valuations={[quotedValuation]}
        totalMarketValue={quotedValuation.marketValue}
      />,
    )
    // The guard above must not have blanked the honest case too.
    expect(screen.getAllByText(/\+\$50\.00/).length).toBeGreaterThan(0)
  })
})
