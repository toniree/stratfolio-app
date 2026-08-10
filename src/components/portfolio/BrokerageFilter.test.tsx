import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { BrokerageSelector } from '@/components/portfolio/BrokerageFilter'
import { useUiStore } from '@/store/uiStore'

describe('BrokerageSelector', () => {
  beforeEach(() => useUiStore.setState({ brokerageFilter: 'all' }))

  it('shows the current brokerage label in the mobile trigger', () => {
    render(<BrokerageSelector counts={{ robinhood: 3, schwab: 2 }} />)

    const allTrigger = screen.getByRole('button', { name: 'Brokerage filter: All brokerages' })
    expect(allTrigger).not.toHaveTextContent('All')

    fireEvent.pointerDown(allTrigger, { button: 0, ctrlKey: false })
    expect(screen.getByText('All brokerages')).toBeInTheDocument()
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })

    act(() => useUiStore.setState({ brokerageFilter: 'schwab' }))

    expect(
      screen.getByRole('button', { name: 'Brokerage filter: Charles Schwab' }),
    ).not.toHaveTextContent('Schwab')
  })
})
