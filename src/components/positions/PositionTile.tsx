import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, LogOut, NotebookPen } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatMoney, formatQty, formatSignedMoney, formatSignedPercent } from '@/lib/format'
import type { PositionValuation } from '@/lib/portfolioMath'
import type { Position } from '@/api/types'
import { Sparkline } from '@/components/charts/Sparkline'
import { AIConvictionBadge } from '@/components/intelligence/AIConvictionBadge'
import { AIUnavailableChip } from '@/components/intelligence/AIUnavailable'
import { RecommendationChip } from '@/components/intelligence/TradeRecommendation'
import { Button } from '@/components/ui/Button'
import { TileShell, TileStat } from '@/components/shared/TileShell'
import {
  OptionContractBadges,
  OptionContractChips,
} from '@/components/positions/OptionContractDetails'
import { usePrice } from '@/store/priceStore'
import { useAiTradingSwitch } from '@/hooks/policyQueries'
import { SymbolIcon } from '@/components/shared/SymbolIcon'
import { StudyIcon } from '@/components/shared/StudyIcon'
import { StudyTip } from '@/components/shared/StudyTip'
import { MINI_CHART_HEIGHT, PositionMiniChart } from '@/components/charts/PositionMiniChart'
import { optionPremiumHistory, underlyingHistory } from '@/lib/optionHistory'
import { ManualCloseTicket, isManualCloseAvailable } from '@/components/positions/ManualCloseTicket'
import { planTitle } from '@/lib/planIntent'
import { PositionFieldSettings } from '@/components/positions/PositionFieldSettings'
import { PositionPlanSheet } from '@/components/positions/PositionPlanSheet'
import {
  OptionQuoteSelector,
  optionQuoteValue,
} from '@/components/positions/OptionQuoteSelector'
import { OptionStatsPanel } from '@/components/positions/OptionStatsPanel'
import { PositionEventPanel } from '@/components/positions/PositionEventPanel'
import { positionEvents } from '@/lib/positionEvents'
import {
  DEFAULT_POSITION_TILE_FIELDS,
  POSITION_TILE_FIELD_COUNT,
  usePositionTilePreferences,
  type PositionTileField,
} from '@/store/positionTilePreferences'
import { usePlannerIdeas } from '@/hooks/queries'
import { useOptionMarks } from '@/hooks/marketQueries'
import { dayChangeOf, dayPlOf } from '@/lib/dayChange'
import { optionMarkKey } from '@/api/http/adapters/market'
import type { PlannerIdea } from '@/api/newsTypes'

/** Compact carousel tile — high signal only. Depth lives on the details page. */
export function PositionTile({ valuation }: { valuation: PositionValuation }) {
  const navigate = useNavigate()
  const [fieldSettingsOpen, setFieldSettingsOpen] = useState(false)
  const [manualCloseOpen, setManualCloseOpen] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const storedFields = usePositionTilePreferences((state) => state.fields)
  const quoteType = usePositionTilePreferences((state) => state.quoteType)
  // Live mode reads the server-enforced switch (§16), not this browser's.
  const aiTradingEnabled = useAiTradingSwitch().enabled
  const { data: plannerIdeas } = usePlannerIdeas()
  const { position, price, marketValue, totalReturn, totalReturnPct } = valuation
  // Never read `dayChange`/`dayChangePct` straight: a server-marked contract
  // has no prior mark, and its 0 must render as "—", not as "unchanged".
  const day = dayChangeOf(valuation)
  const underlying = usePrice(position.symbol)
  // Real chain values for the stats panel below. The query key matches the
  // page-level `useOptionMarks`, so TanStack serves this from the same
  // request rather than issuing one per tile.
  const { marks } = useOptionMarks(useMemo(() => [position], [position]))
  const contractMark = position.option
    ? marks[
        optionMarkKey({
          symbol: position.symbol,
          right: position.option.right,
          strike: position.option.strike,
          expiry: position.option.expiry,
        })
      ]
    : undefined
  // The sparkline still needs a direction; open P/L is a real number even when
  // today's change is unknown.
  const up = day.available ? day.tone === 'up' : totalReturn >= 0
  const to = `/app/positions/${position.id}`
  const userNote = position.userNote?.trim()
  const ai = position.ai
  // No user note and no model note leaves nothing to say — better an empty
  // notes list than a sentence the model never wrote.
  const note = userNote || ai?.recommendationNote || ''
  // Notes read as a list of separate observations, so each sentence gets its
  // own bullet rather than the heading carrying a single decorative dot.
  const noteItems = note
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
  const mobileFields =
    storedFields.length === POSITION_TILE_FIELD_COUNT
      ? storedFields
      : DEFAULT_POSITION_TILE_FIELDS
  const displayedQuote = position.option
    ? optionQuoteValue(quoteType, price, valuation.previousClose)
    : price
  const savedPlans = useMemo(
    () => findPositionPlans(position, plannerIdeas),
    [plannerIdeas, position],
  )
  const executionCriteria = positionExecutionCriteria(position, savedPlans)
  const chartHistory = useMemo(() => {
    const ageDays = Math.ceil(
      Math.max(0, Date.now() - new Date(position.openedAt).getTime()) / 86_400_000,
    )
    const sessions = Math.max(21, Math.min(365, ageDays + 3))
    return position.option
      ? optionPremiumHistory(position.option, position.symbol, valuation.underlyingPrice, sessions)
      : underlyingHistory(position.symbol, price, sessions)
  }, [position.openedAt, position.option, position.symbol, price, valuation.underlyingPrice])
  const events = useMemo(
    () => positionEvents(position, savedPlans, chartHistory),
    [position, savedPlans, chartHistory],
  )
  const selectedIndex = events.findIndex((event) => event.id === selectedEventId)
  const selectedEvent = selectedIndex >= 0 ? events[selectedIndex] : null
  // The rail is one pager: page 1 is the notes, the rest are chart events.
  const pageCount = events.length + 1
  const pageIndex = selectedIndex >= 0 ? selectedIndex + 1 : 0
  const stepPage = (delta: number) => {
    if (events.length === 0) return
    const next = (pageIndex + delta + pageCount) % pageCount
    setSelectedEventId(next === 0 ? null : events[next - 1].id)
  }

  return (
    <>
      <TileShell onActivate={() => navigate(to)} ariaLabel={`${position.symbol} position details`}>
      <div className="flex items-start gap-2">
        {/* The company name now lives as a watermark behind the chart, so the
            header carries the ticker and the contract on one baseline. */}
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <SymbolIcon symbol={position.symbol} size="md" />
          <div className="min-w-0 flex-1">
            {/* Badges stack so the pair sits on the ticker's line rather
                than pushing a second row under it. */}
            <div className="flex min-w-0 items-start gap-2">
              <span className="-mt-[2mm] min-w-0 self-center truncate text-[17px] leading-none font-extrabold tracking-[-0.02em] text-ink">
                {position.symbol}
              </span>
              {position.option ? (
                <OptionContractBadges
                  contract={position.option}
                  className="-mt-px shrink-0 flex-col items-start gap-px lg:hidden"
                />
              ) : null}
            </div>
            <p className="mt-1 hidden truncate text-[11.5px] text-ink-muted lg:block">
              {position.company}
            </p>
            {position.option && underlying ? (
              <OptionContractChips
                className="mt-1.5 hidden lg:flex"
                contract={position.option}
                underlying={underlying.price}
              />
            ) : null}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="flex items-center justify-end gap-1">
            {position.option ? (
              <span className="flex items-center lg:hidden">
                <OptionQuoteSelector />
              </span>
            ) : null}
            <div className="num text-[16px] leading-none font-extrabold tracking-[-0.02em] text-ink">
              <span className="lg:hidden">{formatMoney(displayedQuote)}</span>
              <span className="hidden lg:inline">{formatMoney(price)}</span>
            </div>
          </div>
          <div
            title={day.title}
            aria-label={day.accessible}
            className={cn(
              'num mt-0.5 text-[11.5px] font-bold lg:mt-1',
              day.tone === 'up' ? 'text-up' : day.tone === 'down' ? 'text-down' : 'text-ink-muted',
            )}
          >
            {day.combined}
          </div>
        </div>
      </div>

      {/* The notes rail and the analytics rail below it share one width so the
          tile reads as a single right-hand column. */}
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_114px] items-stretch gap-0 lg:block">
        <div className="min-w-0 lg:hidden">
          <PositionMiniChart
            data={chartHistory}
            entryPrice={position.avgCost}
            entryDate={position.openedAt}
            currentPrice={price}
            symbol={position.symbol}
            openPrice={valuation.previousClose}
            watermark={position.company}
            events={events}
            selectedEventId={selectedEventId}
            onSelectEvent={(id) => setSelectedEventId((current) => (current === id ? null : id))}
          />
        </div>

        <aside
          className="min-w-0 border-l border-line pl-2.5 lg:hidden"
          style={{ minHeight: `calc(${MINI_CHART_HEIGHT}px + 2mm)` }}
          aria-label="Position notes"
        >
          {selectedEvent ? (
            <PositionEventPanel
              event={selectedEvent}
              index={pageIndex}
              total={pageCount}
              onStep={stepPage}
            />
          ) : (
            <>
              <div className="flex items-center gap-1">
                {events.length > 0 ? (
                  <>
                    <EventStepButton label="Previous page" onClick={() => stepPage(-1)}>
                      <ChevronLeft size={11} strokeWidth={2.8} />
                    </EventStepButton>
                    <span className="num text-[8.5px] font-bold text-ink-muted">
                      {pageIndex + 1}/{pageCount}
                    </span>
                    <EventStepButton label="Next page" onClick={() => stepPage(1)}>
                      <ChevronRight size={11} strokeWidth={2.8} />
                    </EventStepButton>
                  </>
                ) : null}
                {ai ? (
                  <span className="mr-1 ml-auto shrink-0">
                    <RecommendationChip
                      recommendation={ai.recommendation}
                      className="px-1.5 py-px text-[9px]"
                    />
                  </span>
                ) : null}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <p className="text-[9px] font-extrabold tracking-[0.08em] text-white uppercase">
                  Notes
                </p>
                {ai ? (
                  <AIConvictionBadge
                    score={ai.conviction}
                    delta={ai.convictionDelta}
                    size="xs"
                    showLabel={false}
                    className="ml-auto shrink-0"
                  />
                ) : null}
              </div>
              <ul className="mt-1 overflow-hidden">
                {noteItems.map((item) => (
                  <li
                    key={item}
                    className="flex gap-1.5 border-b border-line/40 py-1 text-[10px] leading-[1.25] text-white last:border-b-0"
                  >
                    <span
                      className={cn(
                        'mt-[4.5px] h-1 w-1 shrink-0 rounded-full',
                        userNote ? 'bg-ink-muted' : 'bg-brand-500',
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0">{item}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>

        <Sparkline
          data={valuation.history}
          tone={up ? 'up' : 'down'}
          width={300}
          height={42}
          className="hidden w-full lg:block"
        />
      </div>

      <div className="mt-2.5 hidden flex-wrap items-center gap-1.5 lg:flex">
        {ai ? (
          <>
            <AIConvictionBadge score={ai.conviction} delta={ai.convictionDelta} size="sm" />
            <RecommendationChip recommendation={ai.recommendation} />
          </>
        ) : (
          <AIUnavailableChip />
        )}
      </div>

      {/* Two stacked stat rows on the left, contract analytics filling the
          full height of the right column. */}
      <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_114px] border-t border-line pt-1.5 lg:hidden">
        <div className="min-w-0">
          {position.option ? (
            <dl className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1.18fr)] divide-x divide-line/70">
              <CompactMobileStat
                label="Option"
                align="right"
                value={`$${position.option.strike} ${position.option.right}`}
                sub={position.option.expiryLabel}
              />
              <CompactMobileStat
                label="Qty"
                value={formatQty(position.quantity)}
                openingSign={optionOpeningSign(position)}
                align="right"
              />
            </dl>
          ) : (
            <span className="text-[9px] font-bold tracking-[0.07em] text-ink-muted uppercase">
              Position fields
            </span>
          )}

          <dl className="mt-1 grid grid-cols-[minmax(0,1fr)_minmax(0,1.18fr)] items-stretch divide-x divide-line/70 border-t border-line/70 pt-1">
            {mobileFields.map((field, index) => (
              <MobilePositionField
                key={field}
                field={field}
                valuation={valuation}
                first={index === 0}
              />
            ))}
          </dl>
        </div>

        <div className="relative -mt-1.5 flex min-w-0 flex-col border-l border-line/70 pt-1.5 pl-1.5">
          {position.option && underlying ? (
            <OptionStatsPanel
              className="-mt-1.5 w-full min-w-0"
              contract={position.option}
              underlying={underlying.price}
              avgCost={position.avgCost}
              symbol={position.symbol}
              mark={contractMark}
            />
          ) : null}
          <button
            type="button"
            aria-label="Customize position fields"
            onClick={(event) => {
              event.stopPropagation()
              setFieldSettingsOpen(true)
            }}
            className="absolute -right-[calc(0.25rem+0.5mm)] -bottom-[calc(0.75rem-1.75mm)] shrink-0 transition-transform active:scale-95"
          >
            <StudyTip />
            <StudyIcon size={22} className="text-brand-300" />
          </button>
        </div>
      </div>

      <dl className="mt-2.5 hidden border-t border-line pt-2.5 lg:block">
        <div className="grid grid-cols-3 gap-2">
          <TileStat label="Value" value={formatMoney(marketValue, { whole: true })} />
          <TileStat
            label="Qty"
            value={formatQty(position.quantity)}
            hint="contracts"
          />
          <TileStat
            label="Return"
            value={formatSignedPercent(totalReturnPct, 1)}
            hint={formatSignedMoney(totalReturn)}
            tone={totalReturn >= 0 ? 'up' : 'down'}
          />
        </div>
      </dl>

      {/* Keeps the stat rows off the action row even when the tile is short. */}
      
      <div className="tile-footer-gloss mt-auto -mx-3.5 -mb-3.5 grid min-h-[50px] grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-2.5 px-3.5 py-2 lg:hidden">
        <button
          type="button"
          aria-label={`Close ${position.symbol} position`}
          // A live position the platform service never linked to a silent trade
          // has no id bkt's exit route can take (§17). The control stays visible
          // and inert rather than disappearing.
          disabled={!isManualCloseAvailable(position)}
          title={
            isManualCloseAvailable(position)
              ? undefined
              : 'This position is not linked to a silent trade, so the execution service cannot close it.'
          }
          className="group grid h-10 w-10 place-items-center justify-self-start rounded-full border border-red-300/22 bg-red-400/[0.09] text-red-200/95 transition-transform active:translate-y-px active:scale-[0.96] disabled:opacity-40"
          onClick={(event) => {
            event.stopPropagation()
            setManualCloseOpen(true)
          }}
        >
          <LogOut size={16} strokeWidth={2} />
        </button>
        <section className="min-w-0 self-start" aria-label="Active plans">
          <p className="-mt-[0.5mm] text-center text-[8px] font-extrabold tracking-[0.075em] text-[#f8fbff] uppercase">
            Active Plans
          </p>
          <ol className="mt-1 space-y-1">
            {executionCriteria.map((criterion) => (
              <li
                key={`${criterion.source}-${criterion.text}`}
                className={cn(
                  'relative grid grid-cols-[auto_minmax(0,1fr)] items-start gap-1.5 transition-opacity',
                  isAiPlanPaused(criterion.source, aiTradingEnabled) && 'ai-plan-paused',
                )}
              >
                <span
                  className={cn(
                    'rounded-full border px-1.5 py-px text-[6.5px] leading-none font-extrabold tracking-[0.04em] uppercase',
                    criterion.source === 'user'
                      ? 'border-white/[0.08] bg-white/[0.035] text-ink-soft'
                      : 'ai-criterion-rainbow border-white/20 px-1.5 text-[6.5px]',
                  )}
                >
                  {criterion.source === 'user' ? 'You' : 'AI'}
                </span>
                <span className="line-clamp-1 text-[8.5px] leading-[1.25] font-semibold text-white">
                  {criterion.text}
                </span>
              </li>
            ))}
          </ol>
        </section>
        <button
          type="button"
          className="group grid h-10 w-10 place-items-center justify-self-end rounded-full border border-white/[0.095] bg-white/[0.035] text-sky-200/88 transition-transform active:translate-y-px active:scale-[0.96]"
          aria-label={`Edit plans for ${position.symbol}`}
          onClick={(event) => {
            event.stopPropagation()
            setPlanOpen(true)
          }}
        >
          <NotebookPen size={17} strokeWidth={2.1} />
        </button>
      </div>

      <Button
        size="sm"
        variant="secondary"
        className="mt-3 hidden h-9 w-full lg:inline-flex"
        onClick={(event) => {
          event.stopPropagation()
          navigate(to)
        }}
      >
        Details
      </Button>
      </TileShell>

      <PositionFieldSettings open={fieldSettingsOpen} onOpenChange={setFieldSettingsOpen} />
      <ManualCloseTicket
        position={position}
        price={price}
        previousClose={valuation.previousClose}
        open={manualCloseOpen}
        onOpenChange={setManualCloseOpen}
      />
      <PositionPlanSheet
        position={position}
        plans={savedPlans}
        open={planOpen}
        onOpenChange={setPlanOpen}
        onOpenPlanner={(plan) => {
          setPlanOpen(false)
          navigate(`/app/plan/${plan.id}`)
        }}
      />
    </>
  )
}

function EventStepButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className="grid h-[17px] w-[17px] shrink-0 place-items-center text-ink-muted transition-colors hover:text-ink"
    >
      {children}
    </button>
  )
}

function CompactMobileStat({
  label,
  value,
  sub,
  openingSign,
  align = 'left',
}: {
  label: string
  value: React.ReactNode
  /** Secondary line beneath the value, sharing its alignment. */
  sub?: string
  openingSign?: '+' | '−' | null
  align?: 'left' | 'right'
}) {
  const right = align === 'right'
  return (
    <div className={cn('min-w-0 pr-1.5', right && 'pl-1.5 text-right')}>
      <dt
        className={cn(
          '-mt-1.5 bg-white/[0.045] px-1 pt-1.5 pb-px text-right text-[7.5px] font-bold tracking-[0.07em] text-ink-muted uppercase',
          right ? '-mr-1.5 -ml-1.5' : '-mr-1.5',
        )}
      >
        {label}
      </dt>
      {/* Figures match the thesis tile's stat table exactly — 10.5px value over
          a 10.2px sub — so the two tile types read as one system. */}
      <dd
        className={cn(
          'num flex items-baseline gap-0.5 truncate text-[10.5px] font-medium tracking-[0.005em] text-ink',
          right && 'justify-end',
        )}
      >
        {openingSign ? (
          <span
            title={openingSign === '+' ? 'Buy to open' : 'Sell to open'}
            aria-label={openingSign === '+' ? 'Buy to open' : 'Sell to open'}
            className="text-[10.5px] font-medium text-white"
          >
            {openingSign}
          </span>
        ) : null}
        {value}
      </dd>
      {sub ? (
        <dd className="num mt-px truncate text-[10.2px] font-medium tracking-[0.005em] text-ink uppercase">
          {sub}
        </dd>
      ) : null}
    </div>
  )
}

function MobilePositionField({
  field,
  valuation,
  first,
}: {
  field: PositionTileField
  valuation: PositionValuation
  /** The leading column has no left padding to bleed the header strip into. */
  first?: boolean
}) {
  const { position, marketValue, costBasis, totalReturn, totalReturnPct, price } = valuation
  const day = dayPlOf(valuation)
  const quoteType = usePositionTilePreferences((state) => state.quoteType)
  const openingSign = optionOpeningSign(position)
  const displayedQuote = position.option
    ? optionQuoteValue(quoteType, price, valuation.previousClose)
    : price
  // Cost and Value each carry a per-unit figure underneath, so the tile pairs
  // the position-level number with the price it was struck at / marks at.
  const content: Record<
    PositionTileField,
    {
      label: string
      value: string
      tone?: 'up' | 'down'
      /** Small figure sharing the value's line, pinned to the cell's left. */
      lead?: string
      inline?: string
      inlineTone?: 'up' | 'down'
      sub?: string
      /** Colours the sub-line to match the open P/L. */
      subTone?: 'up' | 'down'
      /** Static caption for the sub-line, mirroring the quote picker's label. */
      subLabel?: string
      /** Prefixes the sub-line with the Mark/Bid/Ask/Last quote picker. */
      subQuoteSelector?: boolean
    }
  > = {
    value: {
      label: 'Value',
      value: formatMoney(marketValue, { whole: true }),
      // The headline stays neutral; the open P/L beneath it carries the colour.
      lead: formatSignedPercent(totalReturnPct, 1),
      inline: `${totalReturn >= 0 ? '+' : '−'}${formatMoney(Math.abs(totalReturn), { whole: true })}`,
      inlineTone: totalReturn >= 0 ? 'up' : 'down',
      sub: formatMoney(displayedQuote),
      subTone: totalReturn >= 0 ? 'up' : 'down',
      subQuoteSelector: position.assetType === 'option',
    },
    quantity: { label: 'Qty', value: formatQty(position.quantity) },
    return: {
      label: 'Return',
      value: formatSignedPercent(totalReturnPct, 1),
      tone: totalReturn >= 0 ? 'up' : 'down',
    },
    dayPl: {
      label: 'Day P/L',
      value: day.money,
      tone: day.tone,
    },
    avgCost: {
      label: 'Cost',
      value: formatMoney(costBasis, { whole: true }),
      sub: formatMoney(position.avgCost),
      subLabel: 'Avg',
    },
    mark: { label: 'Mark', value: formatMoney(price) },
  }
  const item = content[field]

  // The label pins to the top of the cell while the figures sit flush to the
  // bottom right, so Cost and Value line up across the divider.
  return (
    <div className="flex min-w-0 flex-col pr-1.5 text-right not-first:pl-1.5">
      <dt
        className={cn(
          '-mt-1 bg-white/[0.045] px-1 pt-1 pb-px text-right text-[7.5px] font-bold tracking-[0.07em] text-ink-muted uppercase',
          first ? '-mr-1.5' : '-mr-1.5 -ml-1.5',
        )}
      >
        {item.label}
      </dt>
      <dd
        className={cn(
          'num mt-px flex items-baseline justify-end gap-0.5 truncate text-[10.5px] font-medium tracking-[0.005em] text-ink',
          item.tone === 'up' && 'text-up',
          item.tone === 'down' && 'text-down',
        )}
      >
        {field === 'quantity' && openingSign ? (
          <span
            title={openingSign === '+' ? 'Buy to open' : 'Sell to open'}
            aria-label={openingSign === '+' ? 'Buy to open' : 'Sell to open'}
            className="text-[10.5px] font-medium text-white"
          >
            {openingSign}
          </span>
        ) : null}
        {item.value}
      </dd>
      {/* Always occupies a line — without the placeholder, Cost's per-unit
          price would ride up out of line with Value's. */}
      <dd
        aria-hidden={item.inline ? undefined : true}
        className={cn(
          'num flex items-baseline justify-end gap-1 text-[10.2px] leading-tight font-medium',
          item.inlineTone === 'up' && 'text-[#5df2b6]',
          item.inlineTone === 'down' && 'text-[#ff9aad]',
        )}
      >
        {item.lead ? (
          // Lighter weight at a smaller size than the dollar figure beside it.
          <span className="mr-auto ml-[2mm] shrink-0 text-[9.1px] font-semibold tracking-[0.01em]">
            {item.lead}
          </span>
        ) : null}
        {item.inline ?? '\u00A0'}
      </dd>
      {item.sub ? (
        <dd className="mt-px flex min-w-0 items-center justify-end gap-1">
          {item.subQuoteSelector ? (
            <OptionQuoteSelector size="xs" />
          ) : item.subLabel ? (
            <span className="shrink-0 text-[7px] leading-none font-bold tracking-[0.06em] text-ink-muted uppercase">
              {item.subLabel}:
            </span>
          ) : null}
          <span
            className={cn(
              'num truncate text-[9px] font-medium tracking-[0.005em]',
              item.subTone === 'up'
                ? 'text-[#5df2b6]'
                : item.subTone === 'down'
                  ? 'text-[#ff9aad]'
                  : 'text-ink-muted',
            )}
          >
            {item.sub}
          </span>
        </dd>
      ) : null}
    </div>
  )
}

export function optionOpeningSign(position: Position): '+' | '−' | null {
  if (position.assetType !== 'option') return null
  return position.openingSide === 'SELL_TO_OPEN' ? '−' : '+'
}

export function findPositionPlan(
  position: Position,
  ideas: PlannerIdea[] | undefined,
): PlannerIdea | undefined {
  return findPositionPlans(position, ideas)[0]
}

export function findPositionPlans(
  position: Position,
  ideas: PlannerIdea[] | undefined,
): PlannerIdea[] {
  if (!ideas) return []
  return ideas.filter((idea) => {
    if (idea.positionId) return idea.positionId === position.id
    if (idea.symbol !== position.symbol || idea.assetType !== position.assetType) return false
    if (position.assetType !== 'option') return true
    return Boolean(
      position.contractDetail &&
        idea.contractDetail &&
        position.contractDetail.trim().toLowerCase() === idea.contractDetail.trim().toLowerCase(),
    )
  })
}

export interface PositionExecutionCriterion {
  source: 'user' | 'ai'
  text: string
}

export function isAiPlanPaused(
  source: PositionExecutionCriterion['source'],
  aiTradingEnabled: boolean,
): boolean {
  return source === 'ai' && !aiTradingEnabled
}

export function positionExecutionCriteria(
  position: Position,
  plans: PlannerIdea[],
): PositionExecutionCriterion[] {
  const criteria: PositionExecutionCriterion[] = plans.slice(0, 3).map((plan) => ({
    source: plan.source,
    text: plan.originalPrompt?.trim() || planTitle(plan),
  }))

  const riskFloor = formatMoney(Math.max(0.01, position.avgCost * 0.78))
  if (!criteria.some((criterion) => criterion.source === 'ai') && criteria.length < 3) {
    const aiText = position.assetType === 'option'
      ? `Reassess risk if the option mark breaks below ${riskFloor}; keep max loss limited to premium.`
      : `Reassess risk below ${riskFloor} and avoid adding without a new catalyst.`
    criteria.push({ source: 'ai', text: aiText })
  }

  return criteria.slice(0, 3)
}
