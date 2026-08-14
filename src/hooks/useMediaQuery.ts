import { useEffect, useState } from 'react'

const canMatch = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'

/** Reactive matchMedia — used to branch behaviour (not styling) on breakpoint.
 *  Returns false wherever matchMedia is unavailable (e.g. jsdom in tests). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => canMatch() && window.matchMedia(query).matches)
  useEffect(() => {
    if (!canMatch()) return
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return matches
}

/** Below Tailwind's `lg` breakpoint — where the app renders its mobile chrome. */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 1023.5px)')
}
