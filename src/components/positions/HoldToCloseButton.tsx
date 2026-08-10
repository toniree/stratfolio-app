import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

const HOLD_DURATION_MS = 2_000
const RADIUS = 18
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function HoldToCloseButton({
  symbol,
  onComplete,
  className,
}: {
  symbol: string
  onComplete: () => void
  className?: string
}) {
  const [holding, setHolding] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancel = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    setHolding(false)
  }

  const begin = () => {
    if (timerRef.current) return
    setHolding(true)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      setHolding(false)
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(18)
      onComplete()
    }, HOLD_DURATION_MS)
  }

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (event.button === 0) begin()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
      event.preventDefault()
      begin()
    }
  }

  return (
    <button
      type="button"
      aria-label={`Hold for 2 seconds to manually close ${symbol}`}
      title="Hold 2 seconds to close"
      onPointerDown={onPointerDown}
      onPointerUp={(event) => {
        event.stopPropagation()
        cancel()
      }}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      onKeyDown={onKeyDown}
      onKeyUp={(event) => {
        if (event.key === 'Enter' || event.key === ' ') cancel()
      }}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onContextMenu={(event) => event.preventDefault()}
      className={cn(
        'relative grid h-9 w-9 shrink-0 touch-none place-items-center rounded-full border border-white/10 bg-white/[0.045] text-ink-muted shadow-[inset_0_1px_rgba(255,255,255,0.08),0_6px_18px_-12px_rgba(0,0,0,0.8)] transition-[color,background-color,transform] hover:bg-pink-300/10 hover:text-pink-100 active:scale-95',
        holding && 'bg-pink-300/10 text-pink-100 scale-95',
        className,
      )}
    >
      <svg viewBox="0 0 40 40" className="pointer-events-none absolute inset-[-2px] h-10 w-10 -rotate-90">
        <circle
          cx="20"
          cy="20"
          r={RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1.5"
        />
        <circle
          cx="20"
          cy="20"
          r={RADIUS}
          fill="none"
          stroke="#f5a9b8"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={holding ? 0 : CIRCUMFERENCE}
          style={{ transition: holding ? 'stroke-dashoffset 2000ms linear' : 'none' }}
        />
      </svg>
      <X size={14} strokeWidth={2.2} />
      <span className="sr-only">Hold for two seconds</span>
    </button>
  )
}
