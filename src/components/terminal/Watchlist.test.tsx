import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { Watchlist } from '@/components/terminal/Watchlist'

describe('Watchlist', () => {
  it('searches for and adds an available ticker', () => {
    render(
      <MemoryRouter>
        <Watchlist />
      </MemoryRouter>,
    )

    const trigger = screen.getByRole('button', { name: 'Add ticker' })
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })
    fireEvent.change(screen.getByRole('textbox', { name: 'Search tickers' }), {
      target: { value: 'Walmart' },
    })
    fireEvent.click(screen.getByRole('menuitem', { name: /WMTWalmart/i }))

    expect(screen.getByRole('button', { name: 'Chart WMT' })).toBeInTheDocument()
    expect(screen.getByText('21 live')).toBeInTheDocument()
  })
})
