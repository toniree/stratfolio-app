import { motion } from 'framer-motion'
import { Search } from 'lucide-react'
import type { PositionValuation } from '@/lib/portfolioMath'
import { PositionCard } from '@/components/positions/PositionCard'
import { Skeleton } from '@/components/ui/Skeleton'

export function PositionList({
  valuations,
  loading,
  emptyHint,
}: {
  valuations: PositionValuation[]
  loading?: boolean
  emptyHint?: string
}) {
  if (loading) {
    return (
      <div className="grid gap-3 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[300px] rounded-[18px]" />
        ))}
      </div>
    )
  }

  if (valuations.length === 0) {
    return (
      <div className="card grid place-items-center px-6 py-14 text-center">
        <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-surface-sunken text-ink-muted">
          <Search size={19} />
        </span>
        <p className="text-[15px] font-bold text-ink">No holdings match this filter</p>
        <p className="mt-1 max-w-[320px] text-[13px] leading-relaxed text-ink-soft">
          {emptyHint ?? 'Try selecting a different brokerage, or switch back to All brokerages.'}
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {valuations.map((valuation, index) => (
        <motion.div
          key={valuation.position.id}
          layout
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, delay: Math.min(index * 0.035, 0.2) }}
        >
          <PositionCard valuation={valuation} />
        </motion.div>
      ))}
    </div>
  )
}
