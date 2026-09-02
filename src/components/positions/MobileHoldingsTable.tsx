import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  formatMoney,
  formatQty,
  formatSignedMoney,
  formatSignedPercent,
} from '@/lib/format'
import type { PositionValuation } from '@/lib/portfolioMath'
import { dayChangeOf, dayChangeSortKey } from '@/lib/dayChange'
import type { PerformancePeriod, PerformanceSeries } from '@/api/types'
import { SymbolIcon } from '@/components/shared/SymbolIcon'
import { RecommendationChip } from '@/components/intelligence/TradeRecommendation'
import { AIConvictionBadge } from '@/components/intelligence/AIConvictionBadge'
import { Skeleton } from '@/components/ui/Skeleton'
import { PerformanceChart } from '@/components/charts/PerformanceChart'

type PositionMetric =
  | 'qty'
  | 'value'
  | 'pl'
  | 'cost'
  | 'orderDate'
  | 'expiry'
  | 'dte'
  | 'dayPct'
  | 'openPct'
type PositionSort = 'name' | PositionMetric

const POSITION_METRICS: Array<{ value: PositionMetric; label: string; shortLabel: string }> = [
  { value: 'qty', label: 'Quantity', shortLabel: 'qty' },
  { value: 'value', label: 'Value', shortLabel: 'value' },
  { value: 'pl', label: 'Profit / loss', shortLabel: 'p/l' },
  { value: 'cost', label: 'Cost basis', shortLabel: 'cost' },
  { value: 'orderDate', label: 'Order date', shortLabel: 'ordered' },
  { value: 'expiry', label: 'Expiry date', shortLabel: 'expiry' },
  { value: 'dte', label: 'Days to expiry', shortLabel: 'dte' },
  { value: 'dayPct', label: 'Day % change', shortLabel: 'day %' },
  { value: 'openPct', label: 'Open % change', shortLabel: 'open %' },
]

const SUMMARY_PERIODS: Array<{ value: PerformancePeriod; label: string }> = [
  { value: '1D', label: '1D' },
  { value: '1W', label: '1W' },
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '1Y', label: '1Y' },
  { value: 'ALL', label: 'Inception' },
]

export function MobilePositionsSummary({
  marketValue,
  totalPl,
  totalPlPct,
  dayPl,
  dayPlPct,
  dayPlAvailable = true,
  cash,
  performance,
  period = 'ALL',
  onPeriodChange,
}: {
  marketValue: number
  totalPl: number
  totalPlPct: number
  dayPl: number
  dayPlPct: number
  /** False when a holding in this set has no prior mark, making the sum
   *  partial. A partial day P&L printed as a whole one is a lie of omission. */
  dayPlAvailable?: boolean
  cash: number
  performance?: PerformanceSeries
  period?: PerformancePeriod
  onPeriodChange?: (period: PerformancePeriod) => void
}) {
  const positive = totalPl >= 0
  const balance = marketValue + cash

  return (
    <section className="card rounded-[22px] p-3.5" aria-label="Position account totals">
      <div className="flex items-center justify-between gap-3 px-0.5">
        <span className="text-[10px] font-extrabold tracking-[0.075em] text-ink-soft uppercase">
          Positions summary
        </span>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            aria-label="Performance timeframe"
            className="inline-flex h-7 items-center gap-1 rounded-lg px-1.5 text-[8.5px] font-bold tracking-[0.06em] text-ink-muted uppercase outline-none transition-colors hover:bg-white/[0.05] hover:text-ink"
          >
            {SUMMARY_PERIODS.find((option) => option.value === period)?.label ?? 'Inception'}
            <span className="grid h-4 w-4 place-items-center rounded-full bg-white/[0.055]">
              <ChevronDown size={10} strokeWidth={2.5} />
            </span>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={5}
              className="menu-surface z-[70] min-w-[140px]"
            >
              {SUMMARY_PERIODS.map((option) => (
                <DropdownMenu.Item
                  key={option.value}
                  onSelect={() => onPeriodChange?.(option.value)}
                  className="menu-item"
                >
                  {option.label}
                  {period === option.value ? (
                    <Check size={13} className="ml-auto text-brand-300" strokeWidth={2.7} />
                  ) : null}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      <div className="liquid-inset mt-2.5 overflow-hidden rounded-[16px] pt-2 pb-1 pl-2">
        {performance && performance.points.length > 1 ? (
          <div>
            <PerformanceChart
              series={performance}
              currentValue={marketValue}
              positive={positive}
              height={142}
              showAxes
            />
            <p className="px-2 pb-1 text-[8.5px] font-semibold tracking-[0.04em] text-ink-muted uppercase">
              {performance.label}
              {performance.truncated ? ' · truncated at 500 trades' : ''}
            </p>
          </div>
        ) : (
          <Skeleton className="mb-1.5 h-[136px] rounded-xl" />
        )}
      </div>

      <dl className="mt-2.5 divide-y divide-white/[0.08] rounded-[14px] border border-white/[0.08] bg-white/[0.025] px-3">
        <SummaryRow label="Balance" value={formatMoney(balance, { whole: true })} />
        <SummaryRow label="Available Cash" value={formatMoney(cash, { whole: true })} />
        <SummaryRow
          label="P/L Open"
          value={`${formatSignedMoney(totalPl)}  ${formatSignedPercent(totalPlPct)}`}
          tone={positive ? 'up' : 'down'}
        />
        <SummaryRow
          label="P/L Day"
          value={
            dayPlAvailable
              ? `${formatSignedMoney(dayPl)}  ${formatSignedPercent(dayPlPct)}`
              : '—'
          }
          tone={dayPlAvailable ? (dayPl >= 0 ? 'up' : 'down') : undefined}
        />
      </dl>
    </section>
  )
}

function SummaryRow({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'up' | 'down'
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 py-2.5">
      <dt className="min-w-0 text-[10px] font-semibold text-ink-soft">{label}</dt>
      <dd
        className={cn(
          'num whitespace-nowrap text-[13px] font-extrabold tracking-[-0.015em]',
          tone === 'up' ? 'text-up' : tone === 'down' ? 'text-down' : 'text-ink',
        )}
      >
        {value}
      </dd>
    </div>
  )
}

/** Dense mobile table used by the Positions "See all" destination. */
export function MobileHoldingsTable({
  valuations,
  loading,
}: {
  valuations: PositionValuation[]
  loading?: boolean
}) {
  const navigate = useNavigate()
  const [sort, setSort] = useState<PositionSort>('value')
  const [columns, setColumns] = useState<[PositionMetric, PositionMetric, PositionMetric]>([
    'qty',
    'value',
    'pl',
  ])
  const sortedValuations = useMemo(() => {
    const result = [...valuations]
    result.sort((a, b) => {
      switch (sort) {
        case 'name':
          return a.position.symbol.localeCompare(b.position.symbol)
        default:
          return compareMetric(a, b, sort)
      }
    })
    return result
  }, [sort, valuations])
  const sortOptions: Array<{ value: PositionSort; label: string }> = [
    { value: 'name' as const, label: 'Name' },
    ...columns.map((column) => ({
      value: column as PositionSort,
      label: POSITION_METRICS.find((metric) => metric.value === column)?.label ?? column,
    })),
  ].filter((option, index, options) => options.findIndex((item) => item.value === option.value) === index)
  const sortLabel = sortOptions.find((option) => option.value === sort)?.label ?? 'Value'

  const selectColumn = (index: number, metric: PositionMetric) => {
    setColumns((current) => {
      const next = [...current] as [PositionMetric, PositionMetric, PositionMetric]
      next[index] = metric
      if (sort !== 'name' && !next.includes(sort)) setSort(metric)
      return next
    })
  }

  return (
    <section className="card overflow-hidden rounded-[22px]">
      <header className="flex items-center gap-2.5 border-b border-line px-3.5 py-3">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="text-[10px] font-extrabold tracking-[0.075em] text-ink-soft uppercase">
            Positions
          </span>
          <span className="num text-[9px] text-[#8d99a8]">{valuations.length} holdings</span>
        </div>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            aria-label={`Sort positions: ${sortLabel}`}
            className="ml-auto inline-flex h-7 items-center gap-1 rounded-lg px-1.5 text-[8.5px] font-bold tracking-[0.06em] text-ink-muted uppercase outline-none transition-colors hover:bg-white/[0.05] hover:text-ink"
          >
            <span>{sortLabel.toLowerCase()}</span>
            <span className="grid h-4 w-4 place-items-center rounded-full bg-white/[0.055]">
              <ChevronDown size={10} strokeWidth={2.5} />
            </span>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className="menu-surface z-[70] min-w-[190px]"
            >
              <DropdownMenu.Label className="px-2.5 py-1.5 text-[8.5px] font-extrabold tracking-[0.07em] text-ink-muted uppercase">
                Sort positions by
              </DropdownMenu.Label>
              {sortOptions.map((option) => (
                <DropdownMenu.Item
                  key={option.value}
                  onSelect={() => setSort(option.value)}
                  className="menu-item"
                >
                  {option.label}
                  {sort === option.value ? (
                    <Check size={13} className="ml-auto text-brand-300" strokeWidth={2.7} />
                  ) : null}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </header>

      {loading ? (
        <div className="space-y-2 p-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-[72px] rounded-xl" />
          ))}
        </div>
      ) : valuations.length === 0 ? (
        <p className="px-5 py-12 text-center text-[13px] text-ink-muted">
          No holdings match this brokerage.
        </p>
      ) : (
        <table className="system-data-table w-full table-fixed border-collapse" aria-label="All positions">
          <colgroup>
            <col className="w-[46%]" />
            <col className="w-[8%]" />
            <col className="w-[23%]" />
            <col className="w-[23%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-line">
              <MobileTh className="pl-3.5 text-left">position</MobileTh>
              {columns.map((column, index) => (
                <MetricHeader
                  key={`${index}-${column}`}
                  metric={column}
                  onSelect={(metric) => selectColumn(index, metric)}
                  className={cn(
                    column === 'qty' && 'translate-x-0',
                    index === 2 && 'pr-3.5',
                  )}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedValuations.map((valuation) => {
              const { position } = valuation
              const contract = position.option
              const open = () => navigate(`/app/positions/${position.id}`)

              return (
                <tr
                  key={position.id}
                  role="link"
                  tabIndex={0}
                  aria-label={`Open ${position.symbol} position`}
                  onClick={open}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      open()
                    }
                  }}
                  className="cursor-pointer border-b border-line/60 transition-colors last:border-b-0 hover:bg-white/[0.035] focus:bg-white/[0.05] focus:outline-none"
                >
                  <td className="py-3 pr-1 pl-3.5 align-top">
                    <div className="flex min-w-0 -translate-y-1 items-start gap-2">
                      <SymbolIcon symbol={position.symbol} size="sm" />
                      <div className="min-w-0">
                        <div className="relative inline-flex items-center">
                          <span className="shrink-0 text-[12px] font-extrabold text-ink">
                            {position.symbol}
                          </span>
                          <span className="absolute top-[-2mm] left-[calc(100%+5mm)] z-10 inline-flex shrink-0 flex-col items-end gap-px">
                            {position.ai ? (
                              <>
                                <RecommendationChip
                                  recommendation={position.ai.recommendation}
                                  className="shrink-0 px-0.5 py-px text-[5.5px]"
                                />
                                <AIConvictionBadge
                                  score={position.ai.conviction}
                                  delta={position.ai.convictionDelta}
                                  size="xs"
                                  className="h-[14.5px] gap-0 px-0.5 text-[7.25px] opacity-80"
                                />
                              </>
                            ) : null}
                          </span>
                        </div>
                        <div className="num mt-1 truncate text-[9.75px] font-medium text-[#f4f7fb]">
                          {contract
                            ? `$${contract.strike}${contract.right === 'CALL' ? 'C' : 'P'} · ${contract.expiryLabel}`
                            : position.company}
                        </div>
                      </div>
                    </div>
                  </td>
                  {columns.map((column, index) => (
                    <MetricCell
                      key={`${position.id}-${column}-${index}`}
                      metric={column}
                      valuation={valuation}
                      className={cn(
                        column === 'qty' && 'translate-x-0',
                        index === 2 && 'pr-3.5',
                      )}
                    />
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}

function MetricHeader({
  metric,
  onSelect,
  className,
}: {
  metric: PositionMetric
  onSelect: (metric: PositionMetric) => void
  className?: string
}) {
  const label = POSITION_METRICS.find((option) => option.value === metric)?.shortLabel ?? metric
  return (
    <MobileTh className={cn('text-right', className)}>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          aria-label={`Change ${label} column`}
          className="inline-flex items-center gap-0.5 rounded px-0.5 outline-none hover:text-ink"
        >
          {label}
          <ChevronDown size={9} strokeWidth={2.5} />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={5}
            className="menu-surface z-[70] min-w-[180px]"
          >
            <DropdownMenu.Label className="px-2.5 py-1.5 text-[8.5px] font-extrabold tracking-[0.07em] text-ink-muted uppercase">
              Show column
            </DropdownMenu.Label>
            {POSITION_METRICS.map((option) => (
              <DropdownMenu.Item
                key={option.value}
                onSelect={() => onSelect(option.value)}
                className="menu-item"
              >
                {option.label}
                {metric === option.value ? (
                  <Check size={13} className="ml-auto text-brand-300" strokeWidth={2.7} />
                ) : null}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </MobileTh>
  )
}

function MetricCell({
  metric,
  valuation,
  className,
}: {
  metric: PositionMetric
  valuation: PositionValuation
  className?: string
}) {
  const { position, marketValue, price, totalReturn, totalReturnPct, costBasis } = valuation
  const day = dayChangeOf(valuation)
  let value: string
  let detail: string | undefined
  let tone: 'up' | 'down' | undefined

  switch (metric) {
    case 'qty':
      value = formatQty(position.quantity)
      break
    case 'value':
      value = formatMoney(marketValue, { whole: true })
      detail = `${formatMoney(price)} mark`
      break
    case 'pl':
      value = formatSignedMoney(totalReturn)
      detail = `${formatSignedPercent(totalReturnPct)} open`
      tone = totalReturn >= 0 ? 'up' : 'down'
      break
    case 'cost':
      value = formatMoney(costBasis, { whole: true })
      detail = `${formatMoney(position.avgCost)} avg`
      break
    case 'orderDate':
      value = shortDate(position.openedAt)
      break
    case 'expiry':
      value = position.option?.expiryLabel ?? '—'
      break
    case 'dte': {
      const days = daysToExpiry(position.option?.expiry)
      value = days === undefined ? '—' : `${days}d`
      break
    }
    case 'dayPct':
      // "—" when the contract has no prior mark: a 0.00% here would claim the
      // position is flat today rather than admit today is unmeasurable.
      value = day.percent
      tone = day.tone
      break
    case 'openPct':
      value = formatSignedPercent(totalReturnPct)
      tone = totalReturnPct >= 0 ? 'up' : 'down'
      break
  }

  return (
    <td className={cn('num py-3 text-right align-top', className)}>
      <div
        className={cn(
          'truncate text-[10px] font-extrabold',
          tone === 'up' ? 'text-up' : tone === 'down' ? 'text-down' : 'text-ink',
        )}
      >
        {value}
      </div>
      {detail ? (
        <div className={cn('mt-0.5 truncate text-[8.5px] font-medium', tone === 'up' ? 'text-up' : tone === 'down' ? 'text-down' : 'text-[#dce3ec]')}>
          {detail}
        </div>
      ) : null}
    </td>
  )
}

function compareMetric(a: PositionValuation, b: PositionValuation, metric: PositionMetric) {
  if (metric === 'expiry' || metric === 'dte') {
    return expiryTime(a) - expiryTime(b)
  }
  const values: Record<Exclude<PositionMetric, 'expiry' | 'dte'>, (item: PositionValuation) => number> = {
    qty: (item) => item.position.quantity,
    value: (item) => item.marketValue,
    pl: (item) => item.totalReturn,
    cost: (item) => item.costBasis,
    orderDate: (item) => new Date(item.position.openedAt).getTime(),
    // Unmeasured holdings sort to the bottom rather than in among the flat
    // ones, which is what a 0 would do.
    dayPct: dayChangeSortKey,
    openPct: (item) => item.totalReturnPct,
  }
  return values[metric](b) - values[metric](a)
}

function expiryTime(valuation: PositionValuation) {
  return valuation.position.option?.expiry
    ? new Date(valuation.position.option.expiry).getTime()
    : Number.POSITIVE_INFINITY
}

function daysToExpiry(expiry?: string) {
  if (!expiry) return undefined
  return Math.max(0, Math.ceil((new Date(expiry).getTime() - Date.now()) / 86_400_000))
}

function shortDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function MobileTh({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        'py-1 text-[8px] font-bold tracking-[0.07em] text-ink-muted',
        className,
      )}
    >
      {children}
    </th>
  )
}
