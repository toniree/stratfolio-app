import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatMoney, formatSignedMoney, formatSignedPercent } from '@/lib/format'
import type { PortfolioTotals } from '@/lib/portfolioMath'
import type { PortfolioMeta } from '@/api/types'
import { Skeleton } from '@/components/ui/Skeleton'

interface PortfolioMetricsProps {
  totals: PortfolioTotals
  meta?: PortfolioMeta
  loading?: boolean
}

const CONCENTRATION_GUARDRAIL = 20

export function PortfolioMetrics({ totals, meta, loading }: PortfolioMetricsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[86px] rounded-2xl" />
        ))}
      </div>
    )
  }

  const concentrated = totals.topWeightPct > CONCENTRATION_GUARDRAIL

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Metric
        label="Day P/L"
        value={formatSignedMoney(totals.dayPl)}
        hint={`${formatSignedPercent(totals.dayPlPct)} across ${totals.valuations.length} holdings`}
        tone={totals.dayPl >= 0 ? 'up' : 'down'}
      />
      <Metric
        label="Total return"
        value={formatSignedMoney(totals.totalReturn)}
        hint={`${formatSignedPercent(totals.totalReturnPct)} on ${formatMoney(totals.costBasis, { whole: true })} cost`}
        tone={totals.totalReturn >= 0 ? 'up' : 'down'}
      />
      <Metric
        label="Buying power"
        value={formatMoney(meta?.buyingPower ?? 0, { whole: true })}
        hint={`${formatMoney(meta?.cash ?? 0, { whole: true })} settled cash`}
      />
      <Metric
        label="Concentration"
        value={`${totals.topWeightPct.toFixed(1)}%`}
        hint={
          concentrated
            ? `${totals.topWeightSymbol} above the ${CONCENTRATION_GUARDRAIL}% guardrail`
            : `${totals.topWeightSymbol} is the largest holding`
        }
        tone={concentrated ? 'warn' : undefined}
        icon={concentrated ? <AlertTriangle size={13} /> : undefined}
      />
    </div>
  )
}

function Metric({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string
  value: string
  hint: string
  tone?: 'up' | 'down' | 'warn'
  icon?: React.ReactNode
}) {
  return (
    <div className="card px-3.5 py-3">
      <div className="flex items-center gap-1 text-[10.5px] font-bold tracking-[0.08em] text-ink-muted uppercase">
        {label}
      </div>
      <div
        className={cn(
          'num mt-1 flex items-center gap-1.5 text-[19px] leading-tight font-extrabold tracking-[-0.02em]',
          tone === 'up' && 'text-up',
          tone === 'down' && 'text-down',
          tone === 'warn' && 'text-[#B26A00]',
          !tone && 'text-ink',
        )}
      >
        {icon}
        <span className="truncate">{value}</span>
      </div>
      <div className="mt-1 truncate text-[11.5px] text-ink-muted" title={hint}>
        {hint}
      </div>
    </div>
  )
}
