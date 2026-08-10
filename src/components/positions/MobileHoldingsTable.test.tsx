import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { PositionValuation } from '@/lib/portfolioMath'
import {
  MobileHoldingsTable,
  MobilePositionsSummary,
} from '@/components/positions/MobileHoldingsTable'

const valuation = {
  position: {
    id: 'position-pltr',
    symbol: 'PLTR',
    company: 'Palantir Technologies',
    quantity: 4,
    ai: { conviction: 82, recommendation: 'HOLD' },
  },
  price: 48.25,
  marketValue: 19_300,
  totalReturn: 2_400,
  totalReturnPct: 14.2,
  dayPl: 310,
} as PositionValuation

describe('mobile positions table', () => {
  it('shows account totals and opens a position from its table row', () => {
    render(
      <MemoryRouter initialEntries={['/app/positions']}>
        <MobilePositionsSummary
          marketValue={19_300}
          totalPl={2_400}
          totalPlPct={14.2}
          dayPl={310}
          dayPlPct={1.63}
          cash={8_500}
        />
        <Routes>
          <Route path="/app/positions" element={<MobileHoldingsTable valuations={[valuation]} />} />
          <Route path="/app/positions/:id" element={<p>Position details opened</p>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Balance')).toBeInTheDocument()
    expect(screen.getByText('P/L Open')).toBeInTheDocument()
    expect(screen.getByText('P/L Day')).toBeInTheDocument()
    expect(screen.getByText('Available Cash')).toBeInTheDocument()
    expect(screen.getByText('$27,800')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: 'Open PLTR position' }))
    expect(screen.getByText('Position details opened')).toBeInTheDocument()
  })
})
