import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Wallet2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatMoney, formatSignedPercent } from '@/lib/format'
import { Sparkline } from '@/components/charts/Sparkline'

/**
 * The compact portfolio-value widget that heads the metrics strip.
 *
 * The full performance chart is not deleted — it is folded behind this widget
 * and expands inline, which keeps real content above the fold without losing
 * the best piece of the dashboard.
 */
export function PortfolioValueWidget({
  marketValue,
  dayPl,
  dayPlPct,
  spark,
  expanded,
  onToggle,
}: {
  marketValue: number
  dayPl: number
  dayPlPct: number
  spark: number[]
  expanded: boolean
  onToggle: () => void
}) {
  const up = dayPl >= 0

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className={cn(
        'card relative overflow-hidden rounded-[22px] p-3.5 text-left transition-[border-color,background-color,box-shadow,transform] sm:p-4',
        expanded ? 'border-brand-500/40 bg-brand-50' : 'hover:bg-white/[0.06]',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-brand-100 text-brand-300 sm:h-7 sm:w-7">
          <Wallet2 size={13} />
        </span>
        <span className="truncate text-[11.5px] font-semibold text-ink-soft sm:text-[12.5px]">Portfolio value</span>
        <ChevronDown
          size={14}
          className={cn(
            'ml-auto shrink-0 text-ink-muted transition-transform duration-200',
            expanded && 'rotate-180 text-brand-300',
          )}
        />
      </div>

      <div className="mt-2.5 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="num text-[20px] leading-none font-extrabold tracking-[-0.03em] whitespace-nowrap text-ink sm:text-[23px]">
            {formatMoney(marketValue)}
          </div>
          <div
            className={cn(
              'num mt-2 truncate text-[12px] font-semibold',
              up ? 'text-up' : 'text-down',
            )}
          >
            {formatSignedPercent(dayPlPct)}
            <span className="hidden font-medium text-ink-muted sm:inline"> today</span>
          </div>
        </div>
        <span className="liquid-inset shrink-0 rounded-xl px-1.5 py-1">
          <Sparkline
            data={spark}
            tone={up ? 'up' : 'down'}
            width={56}
            height={28}
          />
        </span>
      </div>
    </button>
  )
}

/** The full chart, revealed when the widget above is expanded. */
export function PortfolioChartPanel({
  expanded,
  children,
}: {
  expanded: boolean
  children: React.ReactNode
}) {
  return (
    <AnimatePresence initial={false}>
      {expanded ? (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.26, ease: [0.22, 0.61, 0.36, 1] }}
          className="overflow-hidden"
        >
          <section className="card rounded-[22px] p-4 sm:p-5">{children}</section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
