import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { motion } from 'framer-motion'
import type { BrokerageId } from '@/api/types'
import { BrokerageLogo } from '@/components/shared/BrokerageBadge'
import { getBrokerage } from '@/data/brokerages'

/** Visual handoff from a confirmed user action to the order's routed broker. */
export function OrderRoutingAnimation({ brokerageId }: { brokerageId: BrokerageId }) {
  const brokerage = getBrokerage(brokerageId)

  return (
    <div
      className="mx-auto flex max-w-[250px] items-center justify-between gap-4"
      aria-label={`Order sent to ${brokerage.name}`}
    >
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 20 }}
        className="liquid-inset grid h-14 w-14 shrink-0 place-items-center rounded-full border-up/25 bg-up-soft shadow-[0_12px_34px_-18px_rgba(52,211,153,0.7)]"
      >
        <CheckCircle2 size={30} className="text-up" strokeWidth={2.2} />
      </motion.div>

      <div className="relative h-8 min-w-0 flex-1 overflow-hidden" aria-hidden>
        <span className="absolute top-1/2 right-1 left-1 h-px -translate-y-1/2 bg-gradient-to-r from-up/15 via-up/55 to-up/20" />
        <motion.span
          className="absolute top-1/2 left-0 grid -translate-y-1/2 place-items-center rounded-full bg-up/15 p-1 text-up shadow-[0_0_14px_rgba(52,211,153,0.55)]"
          initial={{ x: 0, opacity: 0.25 }}
          animate={{ x: 54, opacity: [0.25, 1, 0.35] }}
          transition={{ duration: 0.7, ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.08 }}
        >
          <ArrowRight size={17} strokeWidth={2.6} />
        </motion.span>
      </div>

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: [0.8, 1.08, 1], opacity: 1 }}
        transition={{ delay: 0.22, duration: 0.45 }}
        className="flex w-16 shrink-0 flex-col items-center gap-1.5"
      >
        <span className="grid h-14 w-14 place-items-center rounded-2xl border border-up/25 bg-white/[0.1] shadow-[0_0_24px_-10px_rgba(52,211,153,0.8)]">
          <BrokerageLogo id={brokerageId} size="lg" className="h-10 w-10 rounded-xl" />
        </span>
        <span className="max-w-16 truncate text-[9px] font-bold text-up/90">{brokerage.short}</span>
      </motion.div>
    </div>
  )
}
