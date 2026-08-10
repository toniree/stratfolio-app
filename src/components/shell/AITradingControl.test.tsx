import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { AITradingControl, CompactAITradingToggle } from '@/components/shell/AITradingControl'
import { useUiStore } from '@/store/uiStore'

describe('CompactAITradingToggle', () => {
  beforeEach(() => useUiStore.setState({ aiTradingEnabled: false }))

  it('shares a real on/off state', () => {
    render(<CompactAITradingToggle />)

    const toggle = screen.getByRole('switch', { name: 'AI Trading off' })
    const track = toggle.querySelector('[aria-hidden]')
    const thumb = track?.firstElementChild
    expect(thumb).toHaveClass('left-4')
    fireEvent.click(toggle)

    const enabledToggle = toggle
    expect(enabledToggle).toHaveAttribute('aria-label', 'AI Trading on')
    expect(enabledToggle).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(enabledToggle).toHaveClass('text-ink', 'font-extrabold', 'bg-transparent')
    expect(enabledToggle).not.toHaveClass('rounded-full', 'border-line')
    expect(enabledToggle).not.toHaveClass('text-emerald-200')
    expect(thumb).toHaveClass('left-0.5', 'bg-[#42dda0]')
    expect(screen.getByRole('status')).toHaveTextContent(
      'All active plans can execute automatically.',
    )
    fireEvent.click(enabledToggle)

    expect(screen.getByRole('status')).toHaveTextContent(
      'Only plans you created by hand or approved will execute automatically.',
    )
  })

  it('uses the same real toggle and confirmation on full-size surfaces', () => {
    render(<AITradingControl />)

    fireEvent.click(screen.getByRole('switch', { name: 'AI Trading off' }))

    expect(useUiStore.getState().aiTradingEnabled).toBe(true)
    expect(screen.getByRole('status')).toHaveTextContent('AI Trading on')
  })
})
