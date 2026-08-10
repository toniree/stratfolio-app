import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'

const HOLD_MS = 750

/**
 * Press-and-hold confirmation for anything that sends an order.
 *
 * A tap is easy to make by accident on a phone, and an order is not undoable —
 * so the commit costs a deliberate three-quarter-second hold, with a fill that
 * shows how much of it is left. Releasing early cancels with no side effect.
 */
export function HoldToConfirmButton({
  onComplete,
  disabled,
  pending,
  children,
  holdingLabel = 'Keep holding…',
  className,
  ...rest
}: {
  onComplete: () => void
  disabled?: boolean
  /** Work already in flight — suppresses the hold entirely. */
  pending?: boolean
  children: ReactNode
  holdingLabel?: string
  className?: string
} & Omit<React.ComponentProps<typeof Button>, 'onClick' | 'children' | 'disabled'>) {
  const [holding, setHolding] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    setHolding(false)
  }

  const begin = () => {
    if (timer.current || disabled || pending) return
    setHolding(true)
    timer.current = setTimeout(() => {
      timer.current = null
      setHolding(false)
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(18)
      onComplete()
    }, HOLD_MS)
  }

  useEffect(() => () => cancel(), [])

  return (
    <Button
      {...rest}
      disabled={disabled || pending}
      className={cn('relative overflow-hidden', className)}
      onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
        // preventDefault keeps a touch-drag from turning into a scroll mid-hold.
        event.preventDefault()
        if (event.button === 0) begin()
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
        if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
          event.preventDefault()
          begin()
        }
      }}
      onKeyUp={cancel}
    >
      <span
        aria-hidden
        className={cn('hold-confirm-fill', holding && 'hold-confirm-fill-active')}
      />
      <span className="relative z-10 inline-flex items-center gap-2">
        {pending ? 'Sending…' : holding ? holdingLabel : children}
      </span>
    </Button>
  )
}
