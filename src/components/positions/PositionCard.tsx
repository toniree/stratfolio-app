import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import { formatMoney, formatQty, formatSignedMoney, formatSignedPercent } from '@/lib/format'
import type { PositionValuation } from '@/lib/portfolioMath'
import { dayChangeOf } from '@/lib/dayChange'
import { Sparkline } from '@/components/charts/Sparkline'
import { AIConvictionBadge } from '@/components/intelligence/AIConvictionBadge'
import { TradeRecommendation } from '@/components/intelligence/TradeRecommendation'
import { ThesisPreview } from '@/components/intelligence/ThesisPreview'
import { RiskRewardMeter } from '@/components/intelligence/RiskRewardMeter'
import { AIUnavailable } from '@/components/intelligence/AIUnavailable'
import { Button } from '@/components/ui/Button'
import { TradeTicket } from '@/components/trade/TradeTicket'
import { OpenOptionTicket } from '@/components/trade/OpenOptionTicket'
import { isLive } from '@/api/http/env'
import { ThesisModal } from '@/components/positions/ThesisModal'
import { OptionContractChips } from '@/components/positions/OptionContractDetails'
import { usePrice } from '@/store/priceStore'
import { SymbolIcon } from '@/components/shared/SymbolIcon'

export function PositionCard({ valuation }: { valuation: PositionValuation }) {
  const [thesisOpen, setThesisOpen] = useState(false)
  const [tradeOpen, setTradeOpen] = useState(false)
  const [fullThesisOpen, setFullThesisOpen] = useState(false)
  const { position, price, marketValue, totalReturn, totalReturnPct } = valuation
  // "—" rather than "+$0.00 (+0.00%)" when there is no prior mark to measure
  // today's move against.
  const day = dayChangeOf(valuation)
  const underlying = usePrice(position.symbol)
  const ai = position.ai

  // Open P/L still has a real direction when today's change does not.
  const up = day.available ? day.tone === 'up' : totalReturn >= 0

  return (
    <article className="card overflow-hidden rounded-[22px] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-white/[0.14] hover:shadow-[0_18px_46px_-24px_rgba(0,0,0,0.85),0_12px_28px_-24px_rgba(47,123,255,0.44)]">
      <div className="p-4 sm:p-[18px]">
        {/* ---- Header: identity + live price ---- */}
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <SymbolIcon symbol={position.symbol} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="text-[17px] leading-none font-extrabold tracking-[-0.02em] text-ink">
                  {position.symbol}
                </h3>
                {position.assetType === 'option' ? (
                  <span className="rounded bg-surface-sunken px-1.5 py-0.5 text-[10px] font-bold tracking-[0.05em] text-ink-muted uppercase">
                    Option
                  </span>
                ) : null}
              </div>
              <p className="mt-1 truncate text-[12.5px] text-ink-muted">{position.company}</p>
              {position.option && underlying ? (
                <OptionContractChips
                  className="mt-1.5"
                  contract={position.option}
                  underlying={underlying.price}
                />
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <Sparkline
              data={valuation.history}
              tone={up ? 'up' : 'down'}
              width={72}
              height={30}
              className="hidden sm:block"
            />
            <div className="text-right">
              <div className="num text-[17px] leading-none font-extrabold tracking-[-0.02em] text-ink">
                {formatMoney(price)}
              </div>
              <div
                title={day.title}
                aria-label={day.accessible}
                className={cn(
                  'num mt-1 text-[12.5px] font-bold',
                  day.tone === 'up'
                    ? 'text-up'
                    : day.tone === 'down'
                      ? 'text-down'
                      : 'text-ink-muted',
                )}
              >
                {day.combined}
              </div>
            </div>
          </div>
        </div>

        {/* ---- Holding facts ---- */}
        <dl className="liquid-inset mt-3.5 grid grid-cols-2 gap-x-3 gap-y-2.5 rounded-[18px] p-3 sm:grid-cols-4">
          <Fact label="Market value" value={formatMoney(marketValue)} />
          <Fact
            label="Quantity"
            value={`${formatQty(position.quantity)} contracts`}
          />
          <Fact label="Average cost" value={formatMoney(position.avgCost)} />
          <Fact
            label="Total return"
            value={`${formatSignedMoney(totalReturn)}`}
            hint={formatSignedPercent(totalReturnPct)}
            tone={totalReturn >= 0 ? 'up' : 'down'}
          />
        </dl>

        {/* ---- Intelligence layer ---- */}
        <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-line pt-3.5">
          {ai ? <AIConvictionBadge score={ai.conviction} delta={ai.convictionDelta} /> : null}
          <Sparkline
            data={valuation.history}
            tone={up ? 'up' : 'down'}
            width={60}
            height={24}
            className="sm:hidden"
          />
        </div>

        {/* The whole intelligence block is conditional, not defaulted: a
            position with no recorded episode has no model view, and a neutral
            "HOLD" with empty targets would be an opinion nothing produced. */}
        {ai ? (
          <>
            <TradeRecommendation
              className="mt-2.5"
              recommendation={ai.recommendation}
              targetLow={ai.targetLow}
              targetHigh={ai.targetHigh}
              note={ai.recommendationNote}
            />

            <ThesisPreview
              className="mt-3"
              bullets={ai.thesis}
              updatedAt={ai.updatedAt}
              expanded={thesisOpen}
              onToggle={() => setThesisOpen((v) => !v)}
            />

            <AnimatePresence initial={false}>
              {thesisOpen ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <RiskRewardMeter
                    className="mt-3"
                    currentPrice={price}
                    upsideTarget={ai.upsideTarget}
                    downsideRisk={ai.downsideRisk}
                    riskRewardRatio={ai.riskRewardRatio}
                    horizon={ai.horizon}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </>
        ) : (
          <AIUnavailable className="mt-3" />
        )}

        {/* ---- Actions ---- */}
        <div className="mt-3.5 flex gap-2.5">
          <Button
            variant="secondary"
            className="flex-1"
            disabled={!ai}
            onClick={() => setFullThesisOpen(true)}
          >
            View thesis
          </Button>
          <Button className="flex-1" onClick={() => setTradeOpen(true)}>
            Trade
          </Button>
        </div>
      </div>

      {/* Live mode gets the silent-execution ticket: contract identity comes
          off the chain and closing is refused (HKP-BKT-1). The demo keeps its
          scripted buy/sell ticket, which trades against the demo book. */}
      {isLive('portfolio') ? (
        <OpenOptionTicket
          symbol={position.symbol}
          initialExpiration={position.option?.expiry}
          initialRight={position.option?.right}
          open={tradeOpen}
          onOpenChange={setTradeOpen}
        />
      ) : (
        <TradeTicket
          position={position}
          price={price}
          open={tradeOpen}
          onOpenChange={setTradeOpen}
        />
      )}
      <ThesisModal
        valuation={valuation}
        open={fullThesisOpen}
        onOpenChange={setFullThesisOpen}
        onTrade={() => {
          setFullThesisOpen(false)
          setTimeout(() => setTradeOpen(true), 180)
        }}
      />
    </article>
  )
}

function Fact({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'up' | 'down'
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] font-bold tracking-[0.07em] text-ink-muted uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          'num mt-0.5 flex items-baseline gap-1.5 truncate text-[14px] font-bold',
          tone === 'up' ? 'text-up' : tone === 'down' ? 'text-down' : 'text-ink',
        )}
      >
        <span className="truncate">{value}</span>
        {hint ? <span className="text-[11.5px] font-semibold opacity-80">{hint}</span> : null}
      </dd>
    </div>
  )
}
