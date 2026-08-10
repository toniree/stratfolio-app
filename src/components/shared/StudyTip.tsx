import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'

const MESSAGE = "I'm your friend Gear-y! Tap me to learn about some studies."
const INTERVAL_MS = 20_000
const VISIBLE_MS = 2_000
const FADE_MS = 450

/**
 * Only one tip speaks at a time.
 *
 * Every position and thesis tile in a carousel mounts its own gear, so without
 * a claim the whole row would pipe up in unison every twenty seconds. The
 * first instance mounted owns the timer; it hands ownership back on unmount so
 * navigating between routes does not silence the tip permanently.
 */
let owner: symbol | null = null

type Phase = 'hidden' | 'visible' | 'fading'

/** Gear-y's periodic nudge, anchored above the studies control. */
export function StudyTip() {
  const id = useRef(Symbol('study-tip'))
  const [claimed, setClaimed] = useState(false)
  const [phase, setPhase] = useState<Phase>('hidden')

  useEffect(() => {
    const self = id.current
    if (owner === null) {
      owner = self
      setClaimed(true)
    }
    return () => {
      if (owner === self) owner = null
    }
  }, [])

  useEffect(() => {
    if (!claimed) return
    const timer = window.setInterval(() => setPhase('visible'), INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [claimed])

  useEffect(() => {
    if (phase !== 'visible') return
    const timer = window.setTimeout(() => setPhase('fading'), VISIBLE_MS)
    return () => window.clearTimeout(timer)
  }, [phase])

  useEffect(() => {
    if (phase !== 'fading') return
    const timer = window.setTimeout(() => setPhase('hidden'), FADE_MS)
    return () => window.clearTimeout(timer)
  }, [phase])

  if (phase === 'hidden') return null

  return (
    <span
      role="status"
      className="pointer-events-none absolute right-0 bottom-[calc(100%+6px)] z-10 w-[128px] rounded-[10px] rounded-br-[3px] border border-brand-300/30 bg-[#101a2b] px-2 py-1.5 shadow-[0_10px_24px_-14px_rgba(0,0,0,0.95)]"
    >
      <span
        className={cn(
          'block text-[9px] leading-[1.3] font-semibold text-[#c9d4e2] transition-opacity',
          phase === 'fading' ? 'opacity-0 duration-[450ms]' : 'opacity-100 duration-200',
        )}
      >
        {MESSAGE}
      </span>
    </span>
  )
}
