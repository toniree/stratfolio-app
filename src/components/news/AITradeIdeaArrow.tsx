import { useNavigate } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * The "there is an AI plan behind this story" affordance.
 *
 * Shining/pulsing, but deliberately small and slow — one soft halo breathing
 * every 2.6s. Anything faster reads as an error state rather than an invitation.
 */
export function AITradeIdeaArrow({
  tradeIdeaId,
  className,
  label = 'AI',
  compact = false,
}: {
  tradeIdeaId: string
  className?: string
  label?: string
  compact?: boolean
}) {
  const navigate = useNavigate()

  return (
    <button
      type="button"
      aria-label="Open the AI plan from this article"
      onClick={(event) => {
        event.stopPropagation()
        event.preventDefault()
        navigate(`/app/plan?idea=${encodeURIComponent(tradeIdeaId)}`)
      }}
      className={cn(
        // Same dim rainbow the home tiles use for AI-authored markers.
        'ai-criterion-rainbow group relative inline-flex shrink-0 items-center gap-1.5 overflow-hidden rounded-full border border-white/20 font-bold text-white transition-transform duration-150 hover:scale-[1.04] hover:brightness-110 active:scale-95',
        compact ? 'h-7 w-7 justify-center' : 'h-8 px-3 text-[12px]',
        className,
      )}
    >
      {compact ? null : <span className="relative">{label}</span>}
      <ArrowUpRight size={compact ? 15 : 14} className="relative" strokeWidth={2.6} />
    </button>
  )
}
