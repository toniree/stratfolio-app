import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, Info, PieChart, Wallet, Target, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatMoney, formatSignedMoney, formatSignedPercent } from '@/lib/format'
import type { PortfolioTotals } from '@/lib/portfolioMath'
import type { PortfolioMeta } from '@/api/types'
import { Sparkline } from '@/components/charts/Sparkline'
import { Skeleton } from '@/components/ui/Skeleton'

const CONCENTRATION_GUARDRAIL = 20

/**
 * Primary portfolio metrics on desktop. Mobile receives all five values from
 * the scrolling header and does not repeat them in the page body.
 */
export function MetricWidgets({
  totals,
  meta,
  loading,
  portfolioSlot,
}: {
  totals: PortfolioTotals
  meta?: PortfolioMeta
  loading?: boolean
  /** The compact portfolio-value widget, rendered first in the strip. */
  portfolioSlot?: React.ReactNode
}) {
  if (loading) {
    return (
      <div className="hidden grid-cols-3 gap-3 lg:grid">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[118px] rounded-[20px]" />
        ))}
      </div>
    )
  }

  // A representative trend for the widget sparklines: the largest holding's
  // recent path, which is what actually drives these numbers.
  const trend =
    totals.valuations.slice().sort((a, b) => b.marketValue - a.marketValue)[0]?.history ?? []
  return (
    <div className="hidden grid-cols-3 gap-3 lg:grid">
      {portfolioSlot ? <div className="[&>*]:h-full [&>*]:w-full">{portfolioSlot}</div> : null}
      <Widget
        icon={Wallet}
        label="Day P/L"
        value={formatSignedMoney(totals.dayPl)}
        secondary={formatSignedPercent(totals.dayPlPct)}
        tone={totals.dayPl >= 0 ? 'up' : 'down'}
        spark={trend}
      />
      <Widget
        icon={TrendingUp}
        label="Buying power"
        value={formatMoney(meta?.buyingPower ?? 0)}
        secondary="Available to trade"
      />
    </div>
  )
}

/** Compact metrics that form the left rail beside Positions and AI Outlook. */
export function PortfolioRiskWidgets({
  totals,
  loading,
  className,
}: {
  totals: PortfolioTotals
  loading?: boolean
  className?: string
}) {
  if (loading) {
    return (
      <div className={cn('grid grid-cols-2 gap-3 xl:grid-cols-1', className)}>
        <Skeleton className="h-[92px] rounded-[20px]" />
        <Skeleton className="h-[92px] rounded-[20px]" />
      </div>
    )
  }

  const trend =
    totals.valuations.slice().sort((a, b) => b.marketValue - a.marketValue)[0]?.history ?? []
  const concentrated = totals.topWeightPct > CONCENTRATION_GUARDRAIL

  return (
    <div className={cn('grid grid-cols-2 gap-3 xl:grid-cols-1', className)}>
      <CompactReturnWidget
        value={formatSignedMoney(totals.totalReturn)}
        percent={formatSignedPercent(totals.totalReturnPct)}
        tone={totals.totalReturn >= 0 ? 'up' : 'down'}
        trend={trend}
      />
      <CompactConcentrationWidget
        percent={`${totals.topWeightPct.toFixed(1)}%`}
        symbol={totals.topWeightSymbol}
        radial={totals.topWeightPct}
        warn={concentrated}
      />
    </div>
  )
}

function CompactReturnWidget({
  value,
  percent,
  tone,
  trend,
}: {
  value: string
  percent: string
  tone: 'up' | 'down'
  trend: number[]
}) {
  return (
    <div className="card relative overflow-hidden rounded-[22px] p-3.5">
      <WidgetLabel icon={Target} label="Total return" />
      <div className="mt-2 flex items-end justify-between gap-2">
        <div
          className={cn(
            'num min-w-0 truncate text-[18px] leading-none font-extrabold tracking-[-0.03em]',
            tone === 'up' ? 'text-up' : 'text-down',
          )}
        >
          {value}
        </div>
        <div className="liquid-inset flex shrink-0 flex-col items-end gap-0.5 rounded-xl px-1.5 py-1">
          <span className={cn('num text-[9px] font-bold', tone === 'up' ? 'text-up' : 'text-down')}>
            {percent}
          </span>
          <Sparkline
            data={trend}
            tone={tone}
            width={50}
            height={22}
            className="shrink-0"
          />
        </div>
      </div>
    </div>
  )
}

function CompactConcentrationWidget({
  percent,
  symbol,
  radial,
  warn,
}: {
  percent: string
  symbol: string
  radial: number
  warn: boolean
}) {
  return (
    <div className="card relative overflow-hidden rounded-[22px] p-3.5">
      <WidgetLabel icon={PieChart} label="Concentration" />
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {warn ? <AlertTriangle size={11} className="shrink-0 text-[#e0a33c]" /> : null}
          <span className="num text-[18px] leading-none font-extrabold tracking-[-0.03em] text-ink">
            {percent}
          </span>
          <span className="truncate text-[9.5px] font-bold tracking-[0.04em] text-ink-muted uppercase">
            {symbol}
          </span>
        </div>
        <span className="liquid-inset grid place-items-center rounded-full p-0.5">
          <Radial value={radial} compact />
        </span>
      </div>
    </div>
  )
}

function WidgetLabel({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-ink-soft">
        <Icon size={12} />
      </span>
      <span className="truncate text-[11.5px] font-semibold text-ink-soft">{label}</span>
      <Info size={11} className="shrink-0 text-ink-muted/70" />
    </div>
  )
}

function Widget({
  className,
  icon: Icon,
  label,
  value,
  secondary,
  tone,
  spark,
  radial,
  warn,
}: {
  className?: string
  icon: LucideIcon
  label: string
  value: string
  secondary: string
  tone?: 'up' | 'down' | 'warn'
  spark?: number[]
  radial?: number
  warn?: boolean
}) {
  return (
    <div className={cn('card relative overflow-hidden rounded-[22px] p-3.5 sm:p-4', className)}>
      <div className="flex items-center gap-2">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-ink-soft sm:h-7 sm:w-7">
          <Icon size={13} />
        </span>
        <span className="truncate text-[11.5px] font-semibold text-ink-soft sm:text-[12.5px]">{label}</span>
        <Info size={12} className="shrink-0 text-ink-muted/70" />
      </div>

      <div className="mt-2.5 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div
            className={cn(
              'num text-[20px] leading-none font-extrabold tracking-[-0.03em] whitespace-nowrap sm:text-[23px]',
              tone === 'up' && 'text-up',
              tone === 'down' && 'text-down',
              tone === 'warn' && 'text-ink',
              !tone && 'text-ink',
            )}
          >
            {value}
          </div>
          <div
            className={cn(
              'num mt-2 flex items-center gap-1 truncate text-[12px] font-semibold',
              tone === 'up' && 'text-up',
              tone === 'down' && 'text-down',
              (!tone || tone === 'warn') && 'text-ink-muted',
            )}
          >
            {warn ? <AlertTriangle size={12} className="shrink-0 text-[#e0a33c]" /> : null}
            <span className="truncate">{secondary}</span>
          </div>
        </div>

        {spark && spark.length > 1 ? (
          <span className="liquid-inset shrink-0 rounded-xl px-1.5 py-1">
            <Sparkline
              data={spark}
              tone={tone === 'down' ? 'down' : 'up'}
              width={56}
              height={28}
            />
          </span>
        ) : null}

        {radial !== undefined ? (
          <span className="liquid-inset grid place-items-center rounded-full p-0.5">
            <Radial value={radial} />
          </span>
        ) : null}
      </div>
    </div>
  )
}

function Radial({ value, compact = false }: { value: number; compact?: boolean }) {
  const size = compact ? 34 : 42
  const center = size / 2
  const r = compact ? 13 : 17
  const c = 2 * Math.PI * r
  const offset = c * (1 - Math.max(0, Math.min(100, value)) / 100)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90">
      <circle cx={center} cy={center} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
      <circle
        cx={center}
        cy={center}
        r={r}
        fill="none"
        stroke="#2f7bff"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.22,0.61,0.36,1)' }}
      />
    </svg>
  )
}
