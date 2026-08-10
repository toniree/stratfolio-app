import { useMemo } from 'react'
import type { UTCTimestamp } from 'lightweight-charts'
import type { Idea } from '@/api/types'
import { formatMoney } from '@/lib/format'
import { optionPremiumHistory, underlyingHistory } from '@/lib/optionHistory'
import { breakeven, optionMark } from '@/lib/optionMath'
import {
  MarketChartBlock,
  type MarketChartReferenceLine,
} from '@/components/positions/PositionQuickView'

const UNDERLYING_DAYS = 30
const OPTION_DAYS = 90

export function TradeIdeaCharts({ idea, underlyingPrice }: { idea: Idea; underlyingPrice: number }) {
  const contract = idea.option
  const entryMid = (idea.entryLow + idea.entryHigh) / 2
  const currentPremium = contract ? optionMark(contract, underlyingPrice) : entryMid

  const underlying = useMemo(
    () => underlyingHistory(idea.symbol, underlyingPrice, UNDERLYING_DAYS),
    [idea.symbol, underlyingPrice],
  )
  const premium = useMemo(
    () =>
      contract
        ? optionPremiumHistory(contract, idea.symbol, underlyingPrice, OPTION_DAYS)
        : underlyingHistory(`${idea.symbol}:idea-premium`, currentPremium, OPTION_DAYS),
    [contract, currentPremium, idea.symbol, underlyingPrice],
  )

  const underlyingLines = useMemo<MarketChartReferenceLine[]>(
    () =>
      contract
        ? [
            {
              price: contract.strike,
              color: '#5ba6ff',
              title: `Strike ${formatMoney(contract.strike)}`,
            },
            {
              price: breakeven(contract, entryMid),
              color: '#e0a33c',
              title: `Breakeven ${formatMoney(breakeven(contract, entryMid))}`,
              dashed: true,
            },
          ]
        : [],
    [contract, entryMid],
  )

  const premiumLines = useMemo<MarketChartReferenceLine[]>(
    () => [
      {
        price: idea.entryLow,
        color: '#c4cfdd',
        title: `Entry ${formatMoney(idea.entryLow)}–${formatMoney(idea.entryHigh)}`,
        dashed: true,
      },
      {
        price: idea.targetLow,
        color: '#34d399',
        title: `Target ${formatMoney(idea.targetLow)}–${formatMoney(idea.targetHigh)}`,
      },
    ],
    [idea.entryHigh, idea.entryLow, idea.targetHigh, idea.targetLow],
  )

  return (
    <section className="card rounded-[24px] p-3.5 sm:p-5" aria-labelledby="market-context-title">
      <div className="mb-3 flex items-end justify-between gap-3 px-0.5">
        <div>
          <h2 id="market-context-title" className="text-[15px] font-extrabold tracking-[-0.01em] text-ink">
            Market context
          </h2>
          <p className="mt-0.5 text-[10.5px] text-ink-muted">Underlying price and modeled contract premium</p>
        </div>
        <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2 py-1 text-[8.5px] font-bold tracking-[0.06em] text-ink-muted uppercase">
          Daily
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <MarketChartBlock
          title={`${idea.symbol} underlying · 1M`}
          subtitle={`${formatMoney(underlyingPrice)} now`}
          data={underlying.map((point) => ({
            time: point.time as UTCTimestamp,
            value: point.value,
          }))}
          lines={underlyingLines}
          liveValue={underlyingPrice}
          referenceValue={underlying[0]?.value}
          tone="brand"
        />
        <MarketChartBlock
          title="Option premium · 3M"
          subtitle={`${formatMoney(currentPremium)} modeled mark`}
          data={premium.map((point) => ({
            time: point.time as UTCTimestamp,
            value: point.value,
          }))}
          lines={premiumLines}
          referenceValue={entryMid}
          tone={currentPremium >= entryMid ? 'up' : 'down'}
        />
      </div>
    </section>
  )
}
