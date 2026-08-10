import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HoldToCloseButton } from '@/components/positions/HoldToCloseButton'

describe('HoldToCloseButton', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('requires a continuous two-second hold', () => {
    const onComplete = vi.fn()
    render(<HoldToCloseButton symbol="NVDA" onComplete={onComplete} />)
    const button = screen.getByRole('button', {
      name: 'Hold for 2 seconds to manually close NVDA',
    })

    fireEvent.pointerDown(button, { button: 0 })
    act(() => vi.advanceTimersByTime(1_999))
    expect(onComplete).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(1))
    expect(onComplete).toHaveBeenCalledOnce()
  })

  it('cancels when the user releases early', () => {
    const onComplete = vi.fn()
    render(<HoldToCloseButton symbol="NVDA" onComplete={onComplete} />)
    const button = screen.getByRole('button', {
      name: 'Hold for 2 seconds to manually close NVDA',
    })

    fireEvent.pointerDown(button, { button: 0 })
    act(() => vi.advanceTimersByTime(1_000))
    fireEvent.pointerUp(button)
    act(() => vi.advanceTimersByTime(2_000))

    expect(onComplete).not.toHaveBeenCalled()
  })
})
