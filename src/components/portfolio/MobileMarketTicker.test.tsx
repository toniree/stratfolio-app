import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PriceMap } from '@/api/marketData/MarketDataSimulator'
import { MobileMarketTicker } from '@/components/portfolio/MobileMarketTicker'

const prices = Object.fromEntries(
  ['SPY', 'NVDA', 'PLTR', 'WMT', 'TSLA', 'AMD'].map((symbol, index) => [
    symbol,
    {
      symbol,
      price: 100 + index,
      previousClose: 99,
      open: 100,
      dayChange: index - 2,
      dayChangePct: index % 2 === 0 ? 1.2 : -0.8,
      history: [],
    },
  ]),
) as PriceMap

describe('MobileMarketTicker', () => {
  beforeEach(() => localStorage.clear())

  it('shows a compact tape and persists selected symbols', () => {
    render(<MobileMarketTicker priceOverride={prices} />)

    expect(screen.getByRole('region', { name: 'Market ticker' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Customize market ticker' }))
    expect(screen.getByText('Customize market ticker')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: /AMD/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Save ticker' }))

    expect(JSON.parse(localStorage.getItem('stratfolio.mobile-market-ticker.v1') ?? '[]')).toContain(
      'AMD',
    )
  })

  it('samples prices every two seconds and flashes in the tick direction', () => {
    vi.useFakeTimers()
    const { container, rerender } = render(<MobileMarketTicker priceOverride={prices} />)
    const nextPrices = {
      ...prices,
      SPY: { ...prices.SPY, price: 150.25 },
      NVDA: { ...prices.NVDA, price: prices.NVDA.price - 1 },
    }

    rerender(<MobileMarketTicker priceOverride={nextPrices} />)
    expect(screen.queryByText('$150.25')).not.toBeInTheDocument()

    act(() => vi.advanceTimersByTime(2000))

    expect(screen.getAllByText('$150.25')).toHaveLength(2)
    expect(container.querySelector('[data-ticker-symbol="SPY"]')).toHaveAttribute(
      'data-flash',
      'up',
    )
    expect(container.querySelector('[data-ticker-symbol="NVDA"]')).toHaveAttribute(
      'data-flash',
      'down',
    )
    expect(
      container.querySelector('[data-ticker-symbol="SPY"] .ticker-price-pulse-up'),
    ).toBeInTheDocument()
    expect(
      container.querySelector('[data-ticker-symbol="NVDA"] .ticker-price-pulse-down'),
    ).toBeInTheDocument()
    vi.useRealTimers()
  })
})
