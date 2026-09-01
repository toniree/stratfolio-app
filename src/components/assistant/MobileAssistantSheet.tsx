import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { AIOutlookPanel } from '@/components/portfolio/AIOutlookPanel'
import { useUiStore } from '@/store/uiStore'
import { usePrices } from '@/store/priceStore'
import {
  useActivity,
  usePlannerIdeas,
  usePortfolioOutlook,
  usePositions,
} from '@/hooks/queries'
import { computeTotals } from '@/lib/portfolioMath'
import { useOptionMarks } from '@/hooks/marketQueries'

/**
 * The mobile face of the desktop chatbox. When the floating chat bubble is
 * tapped below the `lg` breakpoint, this sheet opens the full StratFolio AI
 * panel — same tabs (Keys / Actions / Tests / Chats), same contents, same
 * AI settings button — landing on Chats since a chat bubble was tapped.
 */
export function MobileAssistantSheet({ onMinimize }: { onMinimize: () => void }) {
  const accountId = useUiStore((s) => s.accountId)
  const prices = usePrices()
  const { data: positions, isLoading } = usePositions(accountId)
  const { data: outlook, isLoading: outlookLoading, refetch } = usePortfolioOutlook(accountId)
  const { data: activity } = useActivity()
  const { data: plans } = usePlannerIdeas()
  const { marks } = useOptionMarks(positions)
  const totals = useMemo(
    () => computeTotals(positions ?? [], prices, marks),
    [positions, prices, marks],
  )

  return (
    <>
      <motion.button
        type="button"
        aria-label="Close StratFolio AI"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onMinimize}
        className="fixed inset-0 z-40 bg-[#04070d]/78 backdrop-blur-[6px] lg:hidden"
      />
      <motion.section
        initial={{ opacity: 0, y: 24, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.96 }}
        transition={{ duration: 0.24, ease: [0.22, 0.61, 0.36, 1] }}
        role="region"
        aria-label="StratFolio AI"
        className="fixed right-3 bottom-[calc(72px+env(safe-area-inset-bottom))] left-3 z-50 h-[min(78svh,640px)] origin-bottom-right lg:hidden"
      >
        <AIOutlookPanel
          full
          initialTab="chats"
          outlook={outlook}
          valuations={totals.valuations}
          loading={isLoading || outlookLoading}
          activity={activity ?? []}
          plans={plans ?? []}
          onRefresh={() => refetch()}
          onMinimize={onMinimize}
          className="h-full rounded-[24px] border-brand-400/20 shadow-[0_30px_80px_-28px_rgba(0,0,0,0.98)]"
        />
      </motion.section>
    </>
  )
}
