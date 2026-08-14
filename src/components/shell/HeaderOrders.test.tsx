import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HeaderOrders } from '@/components/shell/HeaderOrders'

describe('HeaderOrders', () => {
  it('opens the option orders table with open and close examples', () => {
    render(<HeaderOrders />)

    const trigger = screen.getByRole('button', { name: /Pending order MU/i })
    expect(trigger).toHaveTextContent('PENDING')
    expect(trigger).toHaveTextContent("MU $150 C · Jan 15 '27")
    expect(trigger).toHaveTextContent('QTY 3')
    expect(trigger).toHaveTextContent('AMT $4,860')

    fireEvent.pointerDown(trigger, {
      button: 0,
      ctrlKey: false,
    })

    const menu = within(screen.getByRole('menu'))
    expect(menu.getByText('Option')).toBeInTheDocument()
    expect(menu.getByText('Avg')).toBeInTheDocument()
    expect(menu.getByText('$16.20')).toBeInTheDocument()
    expect(menu.getAllByText('OPEN')).toHaveLength(2)
    expect(menu.getAllByText('CLOSE')).toHaveLength(2)
    expect(menu.getAllByText('PENDING')).toHaveLength(2)
    expect(menu.getAllByText('FILLED')).toHaveLength(2)
    expect(menu.getByText("MU $150 C · Jan 15 '27")).toBeInTheDocument()
  })
})
