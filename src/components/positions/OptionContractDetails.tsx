import { CalendarClock } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatMoney } from '@/lib/format'
import type { OptionContract } from '@/api/types'
import {
  breakeven,
  daysToExpiry,
  estimateDelta,
  moneynessLabel,
} from '@/lib/optionMath'
import { DetailStat } from '@/components/shared/DetailPrimitives'

/**
 * Compact contract line for carousel tiles.
 *
 * Contract descriptions run much longer than an equity line, so this wraps to
 * two rows of chips rather than truncating — at 390px a truncated strike or
 * expiry is worse than useless.
 */
export function OptionContractChips({
  contract,
  underlying,
  className,
}: {
  contract: OptionContract
  underlying: number
  className?: string
}) {
  const otm = moneynessLabel(contract, underlying)
  const inTheMoney = otm.endsWith('ITM')

  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      <span className="num shrink-0 rounded-md bg-surface-sunken px-1.5 py-0.5 text-[10.5px] font-bold whitespace-nowrap text-ink">
        ${contract.strike} {contract.right === 'CALL' ? 'C' : 'P'}
      </span>
      <span className="num shrink-0 rounded-md bg-surface-sunken px-1.5 py-0.5 text-[10.5px] font-bold whitespace-nowrap text-ink">
        {contract.expiryLabel}
      </span>
      <span
        className={cn(
          'num shrink-0 rounded-md border px-1.5 py-0.5 text-[10.5px] font-bold whitespace-nowrap',
          inTheMoney
            ? 'border-emerald-300/15 bg-up-soft text-up'
            : 'border-amber-300/18 bg-amber-300/[0.09] text-amber-200',
        )}
      >
        {otm}
      </span>
    </div>
  )
}

/**
 * Strike and expiry as two dark badges, for tile headers.
 *
 * Split across two containers rather than one string so a long contract can
 * never break mid-token, and colour-coded on the right so call versus put
 * reads before the digits do.
 */
export function OptionContractBadges({
  contract,
  className,
}: {
  contract: OptionContract
  className?: string
}) {
  const call = contract.right === 'CALL'

  return (
    <div className={cn('flex min-w-0 items-center gap-1', className)}>
      <span className="num shrink-0 rounded-md bg-[#080d15] px-1.5 py-px text-[11.5px] font-bold whitespace-nowrap text-ink">
        ${contract.strike}
        <span className={cn('ml-[3px]', call ? 'text-up' : 'text-[#ff9fb0]')}>
          {call ? 'C' : 'P'}
        </span>
      </span>
      <span className="num min-w-0 truncate rounded-md bg-[#080d15] px-1.5 py-px text-[11.5px] font-bold whitespace-nowrap text-ink uppercase">
        {contract.expiryLabel}
      </span>
    </div>
  )
}

/** Full contract terms for a details page. */
export function OptionContractDetails({
  contract,
  underlying,
  contracts,
  avgPremium,
  mark,
  className,
}: {
  contract: OptionContract
  underlying: number
  contracts: number
  avgPremium: number
  mark: number
  className?: string
}) {
  const be = breakeven(contract, avgPremium)
  const delta = estimateDelta(contract, underlying)
  const dte = daysToExpiry(contract)
  const otm = moneynessLabel(contract, underlying)
  const beGap = underlying > 0 ? ((be - underlying) / underlying) * 100 : 0

  return (
    <section className={cn('card p-4 sm:p-5', className)}>
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.08em] text-ink-muted uppercase">
          <CalendarClock size={13} />
          Contract terms
        </h3>
        <span className="num text-[12px] font-semibold text-ink-soft">
          {dte} days to expiry
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5 sm:grid-cols-4">
        <DetailStat
          label="Strike"
          value={`$${contract.strike} ${contract.right === 'CALL' ? 'Call' : 'Put'}`}
          hint={otm}
        />
        <DetailStat label="Expiry" value={contract.expiryLabel} hint={`${dte} DTE`} />
        <DetailStat
          label="Contracts"
          value={String(contracts)}
          hint={`${contracts * 100} shares equivalent`}
        />
        <DetailStat
          label="Avg premium"
          value={formatMoney(avgPremium)}
          hint={`${formatMoney(avgPremium * contracts * 100, { whole: true })} at risk`}
        />
        <DetailStat label="Current mark" value={formatMoney(mark)} hint="per share" />
        <DetailStat
          label="Breakeven"
          value={formatMoney(be)}
          hint={`${beGap >= 0 ? '+' : '−'}${Math.abs(beGap).toFixed(1)}% from spot`}
        />
        <DetailStat label="Delta" value={delta.toFixed(2)} hint="modelled" />
        <DetailStat
          label="Underlying"
          value={formatMoney(underlying)}
          hint="live simulated price"
        />
      </dl>

      {contract.earningsNote ? (
        <p className="mt-3.5 flex items-start gap-2 rounded-xl border border-line bg-surface-sunken/60 px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-soft">
          <CalendarClock size={14} className="mt-0.5 shrink-0 text-ink-muted" />
          <span>
            {contract.earningsDate ? (
              <span className="font-semibold text-ink">
                Earnings{' '}
                {/* Formatted in UTC — an ISO date parsed as local time shifts
                    a day west of Greenwich and contradicts the note beside it. */}
                {new Date(contract.earningsDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  timeZone: 'UTC',
                })}
                .{' '}
              </span>
            ) : null}
            {contract.earningsNote}
          </span>
        </p>
      ) : null}

      <p className="mt-3 text-[11px] text-ink-muted">
        Contract marks are produced by a deterministic simulated option model, not a live
        options feed.
      </p>
    </section>
  )
}
