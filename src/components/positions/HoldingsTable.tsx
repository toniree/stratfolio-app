import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, List, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  formatMoney,
  formatQty,
  formatSignedMoney,
  formatSignedPercent,
} from '@/lib/format'
import type { PositionValuation } from '@/lib/portfolioMath'
import { SymbolIcon } from '@/components/shared/SymbolIcon'
import { AIConvictionBadge } from '@/components/intelligence/AIConvictionBadge'
import { AIUnavailableChip } from '@/components/intelligence/AIUnavailable'
import { RecommendationChip } from '@/components/intelligence/TradeRecommendation'
import { PositionTile } from '@/components/positions/PositionTile'
import { moneynessLabel } from '@/lib/optionMath'
import { Skeleton } from '@/components/ui/Skeleton'
import { AnimatePresence, motion } from 'framer-motion'
import { PositionQuickView } from '@/components/positions/PositionQuickView'

type View = 'list' | 'grid'

/** Keeps the table's height balanced against the AI Outlook panel beside it. */
const PAGE_SIZE = 6

/**
 * The desktop holdings table.
 *
 * Equities and option contracts share the table, so the Symbol column carries
 * a second line: company name for stock, and strike / expiry / moneyness for
 * contracts. The Quantity column switches between shares and contracts.
 */
export function HoldingsTable({
  valuations,
  loading,
  totalMarketValue,
}: {
  valuations: PositionValuation[]
  loading?: boolean
  totalMarketValue: number
}) {
  const [view, setView] = useState<View>('list')
  const [page, setPage] = useState(0)
  // Accordion: at most one row open, so the two-column row keeps a stable height.
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const pageCount = Math.max(1, Math.ceil(valuations.length / PAGE_SIZE))
  useEffect(() => {
    if (page > pageCount - 1) setPage(0)
  }, [page, pageCount])

  const pageRows = useMemo(
    () => valuations.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [valuations, page],
  )

  return (
    <section className="card overflow-hidden">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3.5 sm:px-5">
        <h2 className="text-[16px] font-bold tracking-[-0.01em] text-ink">Your Positions</h2>
        <span className="num text-[12px] text-ink-muted">{valuations.length} holdings</span>

        <div className="ml-auto flex items-center gap-1 rounded-xl border border-line bg-white/[0.04] p-1">
          <ViewToggle active={view === 'list'} label="List view" onClick={() => setView('list')}>
            <List size={15} />
          </ViewToggle>
          <ViewToggle active={view === 'grid'} label="Grid view" onClick={() => setView('grid')}>
            <LayoutGrid size={15} />
          </ViewToggle>
        </div>
      </header>

      {loading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : valuations.length === 0 ? (
        <p className="px-5 py-12 text-center text-[13.5px] text-ink-muted">
          No holdings match this filter.
        </p>
      ) : view === 'grid' ? (
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          {pageRows.map((valuation) => (
            <PositionTile key={valuation.position.id} valuation={valuation} />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="system-data-table w-full min-w-[620px] border-collapse 2xl:min-w-[700px]">
            <thead>
              <tr className="border-b border-line">
                <Th className="pl-4 text-left sm:pl-5">Symbol</Th>
                <Th className="pr-2 text-left">AI view</Th>
                <Th className="px-2 text-right">Contracts</Th>
                <Th className="text-right">Market value</Th>
                <Th className="text-right">Day P/L</Th>
                <Th className="text-right">Total return</Th>
                <Th className="hidden pl-2 text-right 2xl:table-cell">Weight</Th>
                <Th className="pr-4 text-right sm:pr-5">
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((valuation) => {
                const {
                  position,
                  price,
                  underlyingPrice,
                  dayPl,
                  dayChangePct,
                  marketValue,
                  totalReturn,
                  totalReturnPct,
                } = valuation
                const contract = position.option
                const weight = totalMarketValue > 0 ? (marketValue / totalMarketValue) * 100 : 0
                const isExpanded = expandedId === position.id

                return (
                  <Fragment key={position.id}>
                  <tr
                    onClick={() => setExpandedId((id) => (id === position.id ? null : position.id))}
                    aria-expanded={isExpanded}
                    className={cn(
                      'cursor-pointer border-b border-line/60 transition-colors',
                      isExpanded ? 'bg-white/[0.05]' : 'hover:bg-white/[0.035]',
                    )}
                  >
                    <td className="py-3 pl-4 sm:pl-5">
                      <div className="flex items-center gap-3">
                        <SymbolIcon symbol={position.symbol} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[13.5px] font-bold text-ink">
                              {position.symbol}
                            </span>
                          </div>
                          {contract ? (
                            <div className="num mt-0.5 whitespace-nowrap text-[11px] text-ink-muted">
                              <span className="font-semibold text-ink">
                                ${contract.strike} {contract.right === 'CALL' ? 'Call' : 'Put'}
                              </span>
                              {' · '}
                              <span className="font-semibold text-ink">{contract.expiryLabel}</span>
                              {' · '}
                              <span className="text-[#e0a33c]">
                                {moneynessLabel(contract, underlyingPrice)}
                              </span>
                            </div>
                          ) : (
                            <div className="mt-0.5 truncate text-[11.5px] text-ink-soft">
                              {position.company}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3">
                      <div className="flex flex-nowrap items-center gap-1.5">
                        {position.ai ? (
                          <>
                            <AIConvictionBadge
                              score={position.ai.conviction}
                              size="sm"
                              showLabel={false}
                            />
                            <RecommendationChip recommendation={position.ai.recommendation} />
                          </>
                        ) : (
                          <AIUnavailableChip />
                        )}
                      </div>
                    </td>

                    <td className="num px-2 py-3 text-right text-[13px] font-semibold text-ink">
                      {formatQty(position.quantity)}
                      <div className="text-[10.5px] font-medium text-ink-muted">
                        @ {formatMoney(position.avgCost)}
                      </div>
                    </td>

                    <td className="num py-3 text-right text-[13px] font-bold text-ink">
                      {formatMoney(marketValue)}
                      <div className="text-[10.5px] font-medium text-ink-muted">
                        {formatMoney(price)} mark
                      </div>
                    </td>

                    <Money value={dayPl} pct={dayChangePct} />
                    <Money value={totalReturn} pct={totalReturnPct} />

                    <td className="num hidden py-3 pl-2 text-right text-[13px] font-semibold text-ink 2xl:table-cell">
                      {weight.toFixed(1)}%
                    </td>

                    <td className="py-3 pr-4 text-right sm:pr-5">
                      <div className="flex items-center justify-end gap-0.5">
                        <ChevronDown
                          size={16}
                          className={cn(
                            'text-ink-muted transition-transform duration-200',
                            isExpanded && 'rotate-180 text-brand-300',
                          )}
                          aria-hidden
                        />
                        <RowMenu positionId={position.id} symbol={position.symbol} />
                      </div>
                    </td>
                  </tr>

                  <AnimatePresence initial={false}>
                    {isExpanded ? (
                      <tr>
                        <td colSpan={8} className="p-0">
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.24, ease: [0.22, 0.61, 0.36, 1] }}
                            className="overflow-hidden border-b border-line/60"
                          >
                            <PositionQuickView valuation={valuation} />
                          </motion.div>
                        </td>
                      </tr>
                    ) : null}
                  </AnimatePresence>
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && valuations.length > PAGE_SIZE ? (
        <div className="flex items-center gap-3 border-t border-line px-4 py-3 sm:px-5">
          <span className="num text-[12px] text-ink-muted">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, valuations.length)} of{' '}
            {valuations.length}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <PageButton
              label="Previous page"
              disabled={page === 0}
              onClick={() => {
                setExpandedId(null)
                setPage((p) => Math.max(0, p - 1))
              }}
            >
              <ChevronLeft size={15} />
            </PageButton>
            <span className="num text-[12px] font-semibold text-ink-soft">
              {page + 1} / {pageCount}
            </span>
            <PageButton
              label="Next page"
              disabled={page >= pageCount - 1}
              onClick={() => {
                setExpandedId(null)
                setPage((p) => Math.min(pageCount - 1, p + 1))
              }}
            >
              <ChevronRight size={15} />
            </PageButton>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function PageButton({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode
  label: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'nav-gloss-button h-7 w-7',
        disabled && 'opacity-30',
      )}
    >
      {children}
    </button>
  )
}

function Money({ value, pct }: { value: number; pct: number }) {
  const up = value >= 0
  return (
    <td className={cn('num py-3 text-right text-[13px] font-bold', up ? 'text-up' : 'text-down')}>
      {formatSignedMoney(value)}
      <div className="text-[10.5px] font-semibold">{formatSignedPercent(pct)}</div>
    </td>
  )
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        'py-2.5 text-[10.5px] font-bold tracking-[0.07em] text-ink-muted uppercase',
        className,
      )}
    >
      {children}
    </th>
  )
}

function ViewToggle({
  children,
  active,
  label,
  onClick,
}: {
  children: React.ReactNode
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'grid h-7 w-8 place-items-center rounded-lg transition-colors',
        active ? 'bg-brand-500 text-white' : 'text-ink-muted hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

function RowMenu({ positionId, symbol }: { positionId: string; symbol: string }) {
  const navigate = useNavigate()
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={`Actions for ${symbol}`}
        onClick={(e) => e.stopPropagation()}
        className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-white/[0.08] hover:text-ink"
      >
        <MoreHorizontal size={16} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          onClick={(e) => e.stopPropagation()}
          className="menu-surface z-50 w-[190px]"
        >
          {[
            { label: 'View details', to: `/app/positions/${positionId}` },
            { label: 'View AI thesis', to: `/app/positions/${positionId}` },
            { label: 'Related news', to: '/app/news' },
          ].map((item) => (
            <DropdownMenu.Item
              key={item.label}
              onSelect={() => navigate(item.to)}
              className="menu-item"
            >
              {item.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
