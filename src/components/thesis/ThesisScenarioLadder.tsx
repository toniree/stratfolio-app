import { cn } from '@/lib/cn'
import { formatMoney } from '@/lib/format'
import { blackScholes } from '@/lib/blackScholes'
import type { ThesisAnalytics } from '@/lib/thesisAnalytics'
import type { OptionContract } from '@/api/types'

/** Sigma multiples the ladder prices, from routine to a real trend day. */
const SIGMA_STEPS = [0.5, 1, 1.5]

/**
 * What the premium is worth if the move arrives *before* expiry.
 *
 * Momentum premium buyers rarely hold to expiration — they flip on the move.
 * So each rung reprices the contract at half the remaining life, which keeps
 * the extrinsic value they would actually sell into rather than assuming they
 * ride it to zero. Steps are sized in sigmas so the ladder scales with the
 * name's own volatility instead of arbitrary round percentages.
 */
export function ThesisScenarioLadder({
  contract,
  analytics,
  className,
}: {
  contract: OptionContract
  analytics: ThesisAnalytics
  className?: string
}) {
  const call = contract.right === 'CALL'
  const holdYears = analytics.years / 2
  const sigma = analytics.expectedMovePct / 100

  const rungs = SIGMA_STEPS.map((step) => {
    const movePct = sigma * step * (call ? 1 : -1) * 100
    const underlying = analytics.spot * (1 + movePct / 100)
    const value = blackScholes({
      spot: underlying,
      strike: contract.strike,
      years: holdYears,
      // No implied vol available: price the ladder off realised vol, which
      // is measured from the underlying's own history rather than invented.
      volatility: (analytics.iv ?? analytics.hv) / 100,
      right: contract.right,
    }).price
    const returnPct = analytics.debit > 0 ? (value / analytics.debit - 1) * 100 : 0

    return {
      key: `${step}`,
      label: `${step}σ`,
      move: `${movePct >= 0 ? '+' : '−'}${Math.abs(movePct).toFixed(1)}%`,
      value,
      returnPct,
    }
  })

  return (
    <section className={cn('min-w-0', className)} aria-label="Flip scenarios">
      {/* Same header strip as the stat tables above: bled up to meet the
          section's top border. */}
      <div className="-mt-1.5 flex items-baseline justify-between gap-2 bg-white/[0.045] px-1 pt-1.5 pb-px">
        <span className="text-[7.5px] font-bold tracking-[0.07em] text-ink-muted uppercase">
          If it moves · priced at {Math.round(analytics.daysToExpiry / 2)}d
        </span>
        <span className="num text-[7.5px] font-bold tracking-[0.07em] text-ink-muted uppercase">
          σ {analytics.expectedMovePct.toFixed(1)}%
        </span>
      </div>

      <dl className="mt-1.5 grid grid-cols-3 divide-x divide-line/70">
        {rungs.map((rung, index) => (
          <div
            key={rung.key}
            className={cn('min-w-0 px-1.5 text-center', index === 0 && 'pl-0')}
          >
            <dt className="num text-[8.5px] font-semibold tracking-[0.005em] text-ink-muted">
              {rung.label} · {rung.move}
            </dt>
            <dd className="num mt-0.5 truncate text-[11px] font-medium tracking-[0.005em] text-ink">
              {formatMoney(rung.value)}
            </dd>
            <dd
              className={cn(
                'num truncate text-[9.5px] font-semibold tracking-[0.005em]',
                rung.returnPct >= 0 ? 'text-[#5df2b6]' : 'text-[#ff9aad]',
              )}
            >
              {rung.returnPct >= 0 ? '+' : '−'}
              {Math.abs(rung.returnPct).toFixed(0)}%
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
