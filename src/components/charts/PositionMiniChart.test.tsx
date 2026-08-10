import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MINI_CHART_HEIGHT, PositionMiniChart } from '@/components/charts/PositionMiniChart'

describe('PositionMiniChart', () => {
  it('keeps entry context, date and below-entry styling in the compact chart', () => {
    render(
      <PositionMiniChart
        symbol="NVDA"
        entryPrice={10}
        entryDate="2026-07-01T00:00:00.000Z"
        currentPrice={8}
        data={[
          { time: Date.UTC(2026, 5, 28) / 1000, value: 11 },
          { time: Date.UTC(2026, 6, 1) / 1000, value: 9 },
          { time: Date.UTC(2026, 6, 8) / 1000, value: 8 },
        ]}
      />,
    )

    const chart = screen.getByRole('img', {
        name: 'NVDA premium chart. Entry $10.0 on 7/1. Current $8.00.',
      })
    expect(chart).toBeInTheDocument()
    expect(chart).toHaveAttribute('height', String(MINI_CHART_HEIGHT))
    expect(chart).toHaveAttribute('preserveAspectRatio', 'none')
    expect(screen.getByText('entry $10.0')).toBeInTheDocument()
    expect(screen.getByText('7/1')).toBeInTheDocument()
    expect(screen.getByTestId('below-entry-segment')).toHaveAttribute('stroke', '#f3b2bf')
    expect(screen.queryByTestId('min-price-label')).not.toBeInTheDocument()
    expect(screen.getByTestId('max-price-label')).toBeInTheDocument()
  })

  it('hides the maximum label when the current-price badge occupies its space', () => {
    render(
      <PositionMiniChart
        symbol="COIN"
        entryPrice={10}
        entryDate="2026-07-01T00:00:00.000Z"
        currentPrice={12}
        data={[
          { time: Date.UTC(2026, 5, 28) / 1000, value: 8 },
          { time: Date.UTC(2026, 6, 1) / 1000, value: 10 },
          { time: Date.UTC(2026, 6, 8) / 1000, value: 12 },
        ]}
      />,
    )

    expect(screen.queryByTestId('max-price-label')).not.toBeInTheDocument()
    expect(screen.getByTestId('min-price-label')).toBeInTheDocument()
  })
})
