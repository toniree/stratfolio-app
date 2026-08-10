import { Sparkles } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { AIConvictionBadge } from '@/components/intelligence/AIConvictionBadge'
import { RecommendationChip } from '@/components/intelligence/TradeRecommendation'
import { RiskRewardMeter } from '@/components/intelligence/RiskRewardMeter'
import { BrokerageBadge } from '@/components/shared/BrokerageBadge'
import { formatMoney, formatRange, relativeTime } from '@/lib/format'
import type { PositionValuation } from '@/lib/portfolioMath'

export function ThesisModal({
  valuation,
  open,
  onOpenChange,
  onTrade,
}: {
  valuation: PositionValuation
  open: boolean
  onOpenChange: (open: boolean) => void
  onTrade: () => void
}) {
  const { position, price } = valuation
  const ai = position.ai

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`${position.symbol} — AI thesis`}
      description={`${position.company}${position.contractDetail ? ` · ${position.contractDetail}` : ''}`}
      footer={
        <div className="flex gap-2.5">
          <Button variant="secondary" className="flex-1" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button className="flex-1" onClick={onTrade}>
            Trade {position.symbol}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <AIConvictionBadge score={ai.conviction} delta={ai.convictionDelta} size="lg" />
          <RecommendationChip recommendation={ai.recommendation} />
          <BrokerageBadge id={position.brokerageId} showName showMask size="sm" />
        </div>

        <div className="liquid-inset relative overflow-hidden rounded-[20px] border-brand-400/20 p-4">
          <span className="ai-gradient absolute inset-y-4 left-0 w-[3px] rounded-r-full" aria-hidden />
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold tracking-[0.08em] text-brand-300 uppercase">
            <Sparkles size={13} />
            Why StratFolio holds this view
          </div>
          <ul className="space-y-2.5">
            {ai.thesis.map((bullet, i) => (
              <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed text-ink-soft">
                <span className="ai-gradient mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" aria-hidden />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-white/[0.075] pt-2.5 text-[12px] text-ink-muted">
            Thesis refreshed {relativeTime(ai.updatedAt)} · simulated model output
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Stat label="Current price" value={formatMoney(price)} />
          <Stat label="Target range" value={formatRange(ai.targetLow, ai.targetHigh)} tone="up" />
        </div>

        <RiskRewardMeter
          currentPrice={price}
          upsideTarget={ai.upsideTarget}
          downsideRisk={ai.downsideRisk}
          riskRewardRatio={ai.riskRewardRatio}
          horizon={ai.horizon}
        />

        <div className="liquid-inset rounded-[18px] p-3.5">
          <div className="text-[11px] font-bold tracking-[0.07em] text-ink-muted uppercase">
            Recommendation
          </div>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">{ai.recommendationNote}</p>
        </div>
      </div>
    </Modal>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'up' }) {
  return (
    <div className="liquid-inset rounded-[18px] px-3.5 py-3">
      <div className="text-[10.5px] font-bold tracking-[0.07em] text-ink-muted uppercase">
        {label}
      </div>
      <div
        className={`num mt-1 truncate text-[15px] font-extrabold ${tone === 'up' ? 'text-up' : 'text-ink'}`}
      >
        {value}
      </div>
    </div>
  )
}
