import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MobilePortfolioSummary } from '@/components/shell/MobilePortfolioSummary'

describe('MobilePortfolioSummary', () => {
  it('renders full-precision values and announces them', () => {
    render(
      <MobilePortfolioSummary
        marketValue={248_392.18}
        cash={32_500}
        dayPl={2_418.73}
        dayPlPct={0.98}
      />,
    )

    expect(
      screen.getByRole('status', {
        name: 'Value: $248,392.18. Cash: $32,500.00. Day P/L: +$2,418.73 (+0.98%)',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('$248,392.18').parentElement).toHaveClass('text-white')
    expect(screen.getByText('$32,500.00').parentElement).toHaveClass('text-white')
    expect(screen.getByText('+$2.4K').parentElement).toHaveClass('text-up')
  })

  it('preserves negative P/L semantics', () => {
    render(
      <MobilePortfolioSummary
        marketValue={100_000}
        cash={15_000}
        dayPl={-250}
        dayPlPct={-0.25}
      />,
    )

    expect(screen.getByText('$15,000.00').parentElement).toHaveClass('text-white')
    // Amount and percentage share the loss colour on their common parent.
    expect(screen.getByText('−$250').parentElement).toHaveClass('text-down')
    expect(screen.getByText('−0.3%').parentElement).toHaveClass('text-down')
  })
})
