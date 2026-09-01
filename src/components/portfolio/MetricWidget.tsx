import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, Info, PieChart, Wallet, Target, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatMoney, formatSignedMoney, formatSignedPercent } from '@/lib/format'
import type { PortfolioTotals } from '@/lib/portfolioMath'
import type { PortfolioMeta } from '@/api/types'
import { Sparkline } from '@/components/charts/Sparkline'
import { Skeleton } from '@/components/ui/Skeleton'

const CONCENTRATION_GUARDRAIL = 20
const ALLOCATION_COLORS = ['#5ba6ff', '#8b5cf6', '#34d399', '#f5c26b', '#f87171', '#22d3ee', '#f472b6', '#a3e635']

// `company` is optional throughout: there is no live-safe symbol→name source
// (HKP-MND-4), so live rows carry a ticker and nothing else.
type Allocation = { symbol: string; company?: string; percent: number; color: string }

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
      <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.5fr)_minmax(0,0.5fr)_minmax(0,1fr)] gap-2.5 lg:grid">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[118px] rounded-[20px]" />
        ))}
      </div>
    )
  }

  // A representative trend for the widget sparklines: the largest holding's
  // recent path, which is what actually drives these numbers.
  const trend =
    totals.valuations.slice().sort((a, b) => b.marketValue - a.marketValue)[0]?.history ?? []
  const concentrated = totals.topWeightPct > CONCENTRATION_GUARDRAIL
  const allocations = totals.valuations
    .map((valuation, index) => ({
      symbol: valuation.position.symbol,
      company: valuation.position.company,
      percent: totals.marketValue > 0 ? (valuation.marketValue / totals.marketValue) * 100 : 0,
      color: ALLOCATION_COLORS[index % ALLOCATION_COLORS.length],
    }))
    .sort((a, b) => b.percent - a.percent)
  return (
    <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.5fr)_minmax(0,0.5fr)_minmax(0,1fr)] gap-2.5 lg:grid">
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
        icon={Target}
        label="Total return"
        value={formatSignedMoney(totals.totalReturn)}
        secondary={formatSignedPercent(totals.totalReturnPct)}
        tone={totals.totalReturn >= 0 ? 'up' : 'down'}
        compact
      />
      <Widget
        icon={TrendingUp}
        label="Buying power"
        value={formatMoney(meta?.buyingPower ?? 0)}
        secondary="Available to trade"
        compact
      />
      <CompactConcentrationWidget
        allocations={allocations}
        warn={concentrated}
      />
    </div>
  )
}

function CompactConcentrationWidget({
  allocations,
  warn,
}: {
  allocations: Allocation[]
  warn: boolean
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const selected = allocations[hovered ?? 0]

  return (
    <div className="card relative flex min-w-0 flex-col overflow-hidden rounded-[22px] p-3">
      <div className="flex items-center gap-1.5">
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-ink-soft">
          <PieChart size={12} />
        </span>
        <span className="truncate text-[10.5px] font-semibold text-ink-soft">Concentration</span>
      </div>
      <div className="mt-1 flex min-w-0 flex-1 items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1">
            {warn ? <AlertTriangle size={11} className="shrink-0 text-[#e0a33c]" /> : null}
            <span className="num text-[18px] leading-none font-extrabold tracking-[-0.03em] text-ink">
              {selected ? `${selected.percent.toFixed(1)}%` : '0.0%'}
            </span>
          </div>
          <span
            className="mt-1 block truncate text-[9.5px] font-bold tracking-[0.04em] text-ink-muted uppercase"
            title={selected?.company ?? selected?.symbol}
          >
            {selected
              ? `${selected.symbol}${selected.company ? ` · ${selected.company}` : ''}`
              : 'No holdings'}
          </span>
        </div>
        <span className="liquid-inset grid shrink-0 place-items-center rounded-full p-1">
          <AllocationRing allocations={allocations} activeIndex={hovered} onActive={setHovered} />
        </span>
      </div>
    </div>
  )
}

function AllocationRing({
  allocations,
  activeIndex,
  onActive,
}: {
  allocations: Allocation[]
  activeIndex: number | null
  onActive: (index: number | null) => void
}) {
  const size = 68
  const center = size / 2
  const radius = 25
  const circumference = 2 * Math.PI * radius
  let consumed = 0

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" role="img" aria-label="Portfolio allocation">
      <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
      {allocations.map((allocation, index) => {
        const segment = (Math.max(0, allocation.percent) / 100) * circumference
        const visible = Math.max(0.5, segment - 1.8)
        const offset = -consumed
        consumed += segment
        return (
          <circle
            key={`${allocation.symbol}-${index}`}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={allocation.color}
            strokeWidth={activeIndex === index ? 9 : 7}
            strokeLinecap="round"
            strokeDasharray={`${visible} ${circumference - visible}`}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${center} ${center})`}
            className="cursor-pointer transition-[stroke-width,opacity] duration-150"
            opacity={activeIndex === null || activeIndex === index ? 1 : 0.38}
            tabIndex={0}
            aria-label={`${allocation.company ?? allocation.symbol} ${allocation.percent.toFixed(1)}%`}
            onMouseEnter={() => onActive(index)}
            onMouseLeave={() => onActive(null)}
            onFocus={() => onActive(index)}
            onBlur={() => onActive(null)}
          >
            <title>{allocation.company ?? allocation.symbol}: {allocation.percent.toFixed(1)}%</title>
          </circle>
        )
      })}
    </svg>
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
  compact,
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
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'card relative overflow-hidden rounded-[22px]',
        compact ? 'p-3' : 'p-3.5',
        className,
      )}
    >
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            'grid shrink-0 place-items-center rounded-lg bg-white/[0.06] text-ink-soft',
            compact ? 'h-5 w-5' : 'h-6 w-6',
          )}
        >
          <Icon size={13} />
        </span>
        <span
          className={cn(
            'truncate font-semibold text-ink-soft',
            compact ? 'text-[10.5px]' : 'text-[11.5px]',
          )}
        >
          {label}
        </span>
        {compact ? null : <Info size={12} className="shrink-0 text-ink-muted/70" />}
      </div>

      <div className="mt-2 flex items-end justify-between gap-1.5">
        <div className="min-w-0">
          <div
            className={cn(
              'num leading-none font-extrabold tracking-[-0.03em] whitespace-nowrap',
              compact ? 'text-[18px] xl:text-[19px]' : 'text-[20px] xl:text-[22px]',
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
              'num mt-1.5 flex items-center gap-1 truncate text-[11.5px] font-semibold',
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
          <span className="liquid-inset shrink-0 rounded-xl px-1 py-0.5">
            <Sparkline
              data={spark}
              tone={tone === 'down' ? 'down' : 'up'}
              width={48}
              height={26}
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
