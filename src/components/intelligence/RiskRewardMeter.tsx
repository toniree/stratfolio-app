import { cn } from '@/lib/cn'
import { formatMoney } from '@/lib/format'

interface RiskRewardMeterProps {
  currentPrice: number
  upsideTarget: number
  downsideRisk: number
  riskRewardRatio: number
  horizon: string
  className?: string
  /** Drop the card surface when the meter already sits inside one. */
  bare?: boolean
}

/**
 * Every field is explicitly labeled. A bare "risk/reward: 1.9" tells a user
 * nothing — what the model means is "we see $214 up, $148 down, over 6–9
 * months", so that is what the component shows.
 */
export function RiskRewardMeter({
  currentPrice,
  upsideTarget,
  downsideRisk,
  riskRewardRatio,
  horizon,
  className,
  bare,
}: RiskRewardMeterProps) {
  const low = Math.min(downsideRisk, currentPrice)
  const high = Math.max(upsideTarget, currentPrice)
  const span = high - low || 1
  const currentPct = Math.min(96, Math.max(4, ((currentPrice - low) / span) * 100))

  const upsidePct = currentPrice > 0 ? ((upsideTarget - currentPrice) / currentPrice) * 100 : 0
  const downsidePct = currentPrice > 0 ? ((downsideRisk - currentPrice) / currentPrice) * 100 : 0

  return (
    // `card`, not a white panel — this kept the light theme's surface through
    // the dark retheme and rendered as a bright slab against every other tile.
    <div className={cn(!bare && 'card rounded-[20px] p-3.5', className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold tracking-[0.09em] text-ink-muted uppercase">
          Risk / Reward
        </span>
        <span className="text-[11.5px] font-semibold text-ink-soft">
          Modeled by StratFolio AI
        </span>
      </div>

      <div className="relative mb-1 h-2 rounded-full bg-gradient-to-r from-down/35 via-line-strong to-up/45">
        <div
          className="absolute -top-1 h-4 w-[3px] -translate-x-1/2 rounded-full bg-ink"
          style={{ left: `${currentPct}%` }}
          aria-hidden
        />
      </div>
      <div className="mb-4 flex justify-between text-[11px] font-semibold text-ink-muted">
        <span className="num">{formatMoney(low)}</span>
        <span className="num text-ink-soft">Now {formatMoney(currentPrice)}</span>
        <span className="num">{formatMoney(high)}</span>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-3">
        <Field
          label="Upside Target"
          value={formatMoney(upsideTarget)}
          hint={`${upsidePct >= 0 ? '+' : '−'}${Math.abs(upsidePct).toFixed(1)}% from here`}
          tone="up"
        />
        <Field
          label="Downside Risk"
          value={formatMoney(downsideRisk)}
          hint={`${downsidePct >= 0 ? '+' : '−'}${Math.abs(downsidePct).toFixed(1)}% from here`}
          tone="down"
        />
        <Field
          label="Risk / Reward Ratio"
          value={`${riskRewardRatio.toFixed(1)} : 1`}
          hint={riskRewardRatio >= 2 ? 'Favourable' : riskRewardRatio >= 1 ? 'Balanced' : 'Unfavourable'}
        />
        <Field label="Time Horizon" value={horizon} hint="Thesis window" />
      </dl>
    </div>
  )
}

function Field({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint: string
  tone?: 'up' | 'down'
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] font-bold tracking-[0.07em] text-ink-muted uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          'num mt-0.5 truncate text-[15px] font-bold',
          tone === 'up' ? 'text-up' : tone === 'down' ? 'text-down' : 'text-ink',
        )}
      >
        {value}
      </dd>
      <dd className="mt-0.5 truncate text-[11.5px] text-ink-muted">{hint}</dd>
    </div>
  )
}
