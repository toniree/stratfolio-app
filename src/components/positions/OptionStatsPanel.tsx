import { cn } from '@/lib/cn'
import type { OptionContract } from '@/api/types'
import type { OptionMark } from '@/api/marketData/types'
import {
  breakeven,
  daysToExpiry,
  estimateDelta,
  estimateGamma,
  estimateImpliedVol,
  estimateLiquidity,
  estimateTheta,
  estimateVega,
  hasModelTerms,
  percentOutOfMoney,
} from '@/lib/optionMath'
import {
  DEFAULT_OPTION_STATS,
  OPTION_STAT_LIMIT,
  usePositionTilePreferences,
  type OptionStatField,
} from '@/store/positionTilePreferences'

export const OPTION_STAT_OPTIONS: { id: OptionStatField; label: string; detail: string }[] = [
  {
    id: 'delta',
    label: 'Delta',
    detail:
      'Premium move per $1 of underlying, and a workable proxy for the odds of finishing in the money. Watch it drift: a 0.30 delta call that becomes 0.60 has quietly doubled your directional exposure without you trading anything.',
  },
  {
    id: 'gamma',
    label: 'Gamma',
    detail:
      'How fast delta itself changes. High gamma near expiry is why a position can go from irrelevant to decisive inside one session — and why short-dated contracts need watching rather than holding.',
  },
  {
    id: 'theta',
    label: 'Theta',
    detail:
      'Dollars lost per day to the passage of time. On long premium this is rent you pay whether or not the thesis is working; weigh it against the days you have left before deciding to sit tight.',
  },
  {
    id: 'vega',
    label: 'Vega',
    detail:
      'Premium move per volatility point. It explains the sessions where you were right on direction and still lost money — an IV crush after earnings drains value from the contract regardless of the move.',
  },
  {
    id: 'iv',
    label: 'IV',
    detail:
      'The volatility implied by the contract\u2019s own price. High IV means the market is already expecting movement and you paid up for it, so a fall in IV alone can lose money on a flat underlying.',
  },
  {
    id: 'volume',
    label: 'Volume',
    detail:
      'Contracts traded today at this strike. A sudden spike is often the tell that someone with a view is positioning — check it against open interest to judge whether it is new money or closing trades.',
  },
  {
    id: 'openInterest',
    label: 'Open int.',
    detail:
      'Contracts outstanding at this strike. Thin open interest is how traders get the direction right and still take a poor fill getting out; it matters far more on the exit than the entry.',
  },
  {
    id: 'breakeven',
    label: 'Break-even',
    detail:
      'The underlying price where this position stops losing at expiry. The single level worth marking on your chart, because anything short of it is a loss no matter how well the trade felt along the way.',
  },
  {
    id: 'dte',
    label: 'DTE',
    detail:
      'Calendar days until expiry. Sets the total theta still owed and, more to the point, whether the catalyst you are waiting on actually lands while the contract is still alive.',
  },
  {
    id: 'moneyness',
    label: 'Moneyness',
    detail:
      'How far the strike sits from spot, in percent. It frames every other number here: an out-of-the-money contract is pure time value, so it needs a move rather than merely patience.',
  },
]

/**
 * Contract analytics for a position tile, rendered as a dense line-by-line
 * ledger.
 *
 * Two sources, never mixed silently. When `mark` carries a real mnd chain
 * quote, the Greeks, IV, volume and open interest are the **server's** numbers.
 * Without one, they come from the in-browser demo model — which only exists
 * for seeded contracts, so a live contract with no chain quote renders "—"
 * rather than a plausible invention (§6).
 */
export function OptionStatsPanel({
  contract,
  underlying,
  avgCost,
  symbol,
  mark,
  className,
}: {
  contract: OptionContract
  underlying: number
  avgCost: number
  symbol: string
  /** Real chain values for this contract, when the server has quoted it. */
  mark?: OptionMark
  className?: string
}) {
  const stored = usePositionTilePreferences((state) => state.optionStats)
  const stats = stored.length > 0 ? stored.slice(0, OPTION_STAT_LIMIT) : DEFAULT_OPTION_STATS

  return (
    <dl className={cn('flex min-w-0 flex-col justify-start', className)}>
      {stats.map((stat) => {
        const { label, value, tone } = optionStatLine(
          stat,
          contract,
          underlying,
          avgCost,
          symbol,
          mark,
        )
        return (
          <div
            key={stat}
            className="flex min-w-0 items-baseline justify-between gap-1 border-b border-line/45 py-[3px] last:border-b-0"
          >
            {/* Fixed width so every strip matches, bled left to meet the
                panel's dividing border. */}
            <dt className="-my-[3px] -ml-1.5 w-[44px] shrink-0 self-stretch truncate bg-white/[0.045] py-[4px] pr-1 pl-1.5 text-[7.5px] font-bold tracking-[0.07em] text-ink-muted uppercase">
              {label}
            </dt>
            <dd
              className={cn(
                'num truncate text-[9px] font-medium tracking-[0.005em] text-ink',
                tone === 'up' && 'text-up',
                tone === 'down' && 'text-down',
              )}
            >
              {value}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

/** The one place "we do not know this" is spelled, so it always reads alike. */
const UNKNOWN = '—'

export function optionStatLine(
  stat: OptionStatField,
  contract: OptionContract,
  underlying: number,
  avgCost: number,
  symbol: string,
  mark?: OptionMark,
): { label: string; value: string; tone?: 'up' | 'down' } {
  // The demo model may only price a seeded contract. For a live one the
  // server's chain values are the only legitimate source, and their absence
  // renders as "—".
  const modelled = hasModelTerms(contract)
  const greeks = mark?.greeks

  switch (stat) {
    case 'delta': {
      if (greeks) return { label: 'Delta', value: signedFixed(greeks.delta, 2) }
      if (!modelled) return { label: 'Delta', value: UNKNOWN }
      return { label: 'Delta', value: signedFixed(deltaSigned(contract, underlying), 2) }
    }
    case 'gamma': {
      if (greeks) return { label: 'Gamma', value: greeks.gamma.toFixed(3) }
      if (!modelled) return { label: 'Gamma', value: UNKNOWN }
      return { label: 'Gamma', value: estimateGamma(contract, underlying).toFixed(3) }
    }
    case 'theta': {
      if (greeks) return { label: 'Theta', value: signedFixed(greeks.theta, 2), tone: 'down' }
      if (!modelled) return { label: 'Theta', value: UNKNOWN }
      const theta = estimateTheta(contract, underlying)
      return { label: 'Theta', value: signedFixed(theta, 2), tone: 'down' }
    }
    case 'vega': {
      if (greeks) return { label: 'Vega', value: greeks.vega.toFixed(2) }
      if (!modelled) return { label: 'Vega', value: UNKNOWN }
      return { label: 'Vega', value: estimateVega(contract, underlying).toFixed(2) }
    }
    case 'iv': {
      // mnd sends IV as a plain fraction (a dimensionless model output, never
      // money); the demo model already reports percentage points.
      if (mark?.impliedVolatility !== undefined)
        return { label: 'IV', value: `${(mark.impliedVolatility * 100).toFixed(1)}%` }
      const iv = estimateImpliedVol(contract, underlying)
      return { label: 'IV', value: iv === undefined ? UNKNOWN : `${iv.toFixed(1)}%` }
    }
    case 'volume': {
      if (mark?.volume !== undefined) return { label: 'Vol', value: compact(mark.volume) }
      const liquidity = estimateLiquidity(contract, symbol)
      return { label: 'Vol', value: liquidity ? compact(liquidity.volume) : UNKNOWN }
    }
    case 'openInterest': {
      if (mark?.openInterest !== undefined)
        return { label: 'OI', value: compact(mark.openInterest) }
      const liquidity = estimateLiquidity(contract, symbol)
      return { label: 'OI', value: liquidity ? compact(liquidity.openInterest) : UNKNOWN }
    }
    case 'breakeven':
      return { label: 'B/E', value: `$${breakeven(contract, avgCost).toFixed(2)}` }
    case 'dte':
      return { label: 'DTE', value: `${daysToExpiry(contract)}d` }
    case 'moneyness': {
      const otm = percentOutOfMoney(contract, underlying)
      return {
        label: 'Moneyness',
        value: `${Math.abs(otm).toFixed(1)}% ${otm > 0 ? 'OTM' : 'ITM'}`,
        tone: otm > 0 ? undefined : 'up',
      }
    }
  }
}

/** Puts are quoted with a negative delta; `estimateDelta` returns magnitude. */
function deltaSigned(contract: OptionContract, underlying: number): number {
  const delta = estimateDelta(contract, underlying)
  return contract.right === 'CALL' ? delta : -delta
}

function signedFixed(value: number, digits: number): string {
  return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(digits)}`
}

function compact(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
  return String(value)
}
