import type { ThesisAnalytics } from '@/lib/thesisAnalytics'

/** Studies the thesis tile's quant rail can display. */
export type ThesisStatField =
  | 'ivRank'
  | 'ivHv'
  | 'model'
  | 'rr'
  | 'ev'
  | 'pop'
  | 'touch'
  | 'delta'
  | 'gamma'
  | 'theta'
  | 'thetaBurn'
  | 'vega'
  | 'expectedMove'
  | 'requiredMove'
  | 'cushion'
  | 'leverage'
  | 'spread'
  | 'openInterest'
  | 'dte'
  | 'breakeven'

/** The rail holds five lines before it outgrows the tile. */
export const THESIS_STAT_LIMIT = 5

export const DEFAULT_THESIS_STATS: ThesisStatField[] = [
  'ivRank',
  'ivHv',
  'model',
  'rr',
  'ev',
]

export interface ThesisStatOption {
  id: ThesisStatField
  /** Short form used in the rail. */
  label: string
  /** Full name used in the picker. */
  name: string
  /** Who reads it, when, and what the number is telling them. */
  detail: string
}

/**
 * The catalogue, written for the trader rather than the developer: each entry
 * says which desk uses the study and what the reading implies, because a
 * metric with no decision attached to it is decoration.
 */
export const THESIS_STAT_OPTIONS: ThesisStatOption[] = [
  {
    id: 'ivRank',
    label: 'IV rank',
    name: 'IV rank',
    detail:
      'Where implied vol sits inside its own trailing range. Premium buyers hunt low readings and sellers hunt high ones — under 30 says options are cheap against their own year, which is the setup for long calls; over 70 argues for selling spreads instead of buying them.',
  },
  {
    id: 'ivHv',
    label: 'IV/HV',
    name: 'Implied vs realised vol',
    detail:
      'What the market is charging against what the stock has actually been doing. Negative means implied is trailing realised — you are paying less for movement than the tape has been delivering, which is the cleanest edge a premium buyer ever gets.',
  },
  {
    id: 'model',
    label: 'Model',
    name: 'Black–Scholes edge',
    detail:
      'Theoretical fair value against the price paid. Positive says the entry sits below what the model marks it at. Treat it as a sanity check rather than gospel: it is only as good as the volatility fed into it, and it assumes you can hedge continuously.',
  },
  {
    id: 'rr',
    label: 'R:R',
    name: 'Reward to risk',
    detail:
      'Profit at the target divided by the premium at risk. Directional buyers look for 2R or better because they will be wrong more often than right — a 35% hit rate at 3R still compounds, the same hit rate at 1R bleeds out.',
  },
  {
    id: 'ev',
    label: 'EV',
    name: 'Expected value',
    detail:
      'Probability-weighted profit per position: the win case times its odds, less the full debit times the odds of missing. This is the number that decides whether a low win-rate strategy is worth running at all.',
  },
  {
    id: 'pop',
    label: 'POP',
    name: 'Probability of profit',
    detail:
      'Odds of finishing past break-even at expiry, from the option market’s own distribution. Long out-of-the-money calls routinely sit near 30% — perfectly fine, provided reward-to-risk is paying you for the misses.',
  },
  {
    id: 'touch',
    label: 'P touch',
    name: 'Probability of touch',
    detail:
      'Odds the target trades at any point before expiry — roughly double the odds of finishing there. This is the number that matters if you intend to flip the premium on the move rather than hold to expiration.',
  },
  {
    id: 'delta',
    label: 'Delta',
    name: 'Delta',
    detail:
      'Premium move per $1 of underlying, and a serviceable proxy for the odds of finishing in the money. The 0.30 delta strike is the classic momentum-buyer choice: enough sensitivity to pay on a move, cheap enough to survive being early once.',
  },
  {
    id: 'gamma',
    label: 'Gamma',
    name: 'Gamma',
    detail:
      'How fast delta itself accelerates. High gamma is exactly why a cheap out-of-the-money call can triple on a 5% move — and exactly why the same contract decays to nothing when the move never arrives.',
  },
  {
    id: 'theta',
    label: 'Theta',
    name: 'Theta',
    detail:
      'Dollars the position bleeds per calendar day. Long premium pays this rent whether or not the thesis is working, so the catalyst has to land inside the holding window you can actually afford.',
  },
  {
    id: 'thetaBurn',
    label: 'Burn',
    name: 'Daily burn',
    detail:
      'Theta expressed as a share of the premium paid. Above roughly 1% a day the clock is your real counterparty, not the market — a useful gate on short-dated lottery tickets that look cheap in dollar terms.',
  },
  {
    id: 'vega',
    label: 'Vega',
    name: 'Vega',
    detail:
      'Premium move per volatility point. Long options are long vol, which is why an IV crush after an earnings print can lose money on a call that got the direction exactly right. Check it before buying into a known event.',
  },
  {
    id: 'expectedMove',
    label: 'Exp move',
    name: 'Expected move',
    detail:
      'The ±1σ range the option market is pricing between now and expiry. Anything inside it is an ordinary outcome; a thesis that needs more than this is a bet against the distribution and should be priced as one.',
  },
  {
    id: 'requiredMove',
    label: 'Needs',
    name: 'Required move',
    detail:
      'How far the underlying must travel just to reach break-even. Read it immediately after expected move — the comparison between the two is the single fastest way to judge whether a long option is reasonably struck.',
  },
  {
    id: 'cushion',
    label: 'Cushion',
    name: 'Move cushion',
    detail:
      'Expected move divided by required move. Above 1 means break-even sits inside what the market already treats as routine; below 1 means you need an outlier, and the strike is probably too far out for the horizon.',
  },
  {
    id: 'leverage',
    label: 'Lever',
    name: 'Effective leverage',
    detail:
      'Underlying notional controlled per dollar of premium, via delta. The reason a $900 debit can behave like $10,000 of stock — and the reason position sizing on premium alone understates the risk you are actually carrying.',
  },
  {
    id: 'spread',
    label: 'Spread',
    name: 'Bid–ask spread',
    detail:
      'The quoted spread as a share of mid. Wide markets quietly tax every entry and exit, which compounds badly for anyone flipping often — past roughly 5% the market maker is taking more of the edge than you are.',
  },
  {
    id: 'openInterest',
    label: 'OI',
    name: 'Open interest',
    detail:
      'Contracts outstanding at this strike. Thin open interest is how traders get the direction right and still fail to get out at a fair price; it matters far more on the exit than the entry.',
  },
  {
    id: 'dte',
    label: 'DTE',
    name: 'Days to expiry',
    detail:
      'Calendar days remaining. Sets how much theta you owe in total and, more importantly, whether the catalyst the thesis depends on actually lands before the contract dies.',
  },
  {
    id: 'breakeven',
    label: 'B/E',
    name: 'Break-even',
    detail:
      'The underlying level where the trade stops losing at expiry: strike plus the debit for calls, strike less the debit for puts. The one price that has to be on your chart before you click buy.',
  },
]

export interface ThesisStatLine {
  label: string
  value: string
  tone?: 'up' | 'down'
}

/** Formats one study for the rail, with the tone a trader would read into it. */
export function thesisStatLine(id: ThesisStatField, a: ThesisAnalytics): ThesisStatLine {
  const option = THESIS_STAT_OPTIONS.find((entry) => entry.id === id)
  const label = option?.label ?? id

  switch (id) {
    // Both IV stats are absent whenever there is no implied vol to read —
    // every live contract until the mnd chain lands (HKP-MND-1), and every
    // equity. "—" beats a number derived from realised vol wearing an IV label.
    case 'ivRank': {
      const ivRank = a.ivRank
      return {
        label,
        value: ivRank === undefined ? '—' : ivRank.toFixed(0),
        // Cheap premium favours the buyer these theses are written for.
        tone:
          ivRank === undefined ? undefined : ivRank <= 35 ? 'up' : ivRank >= 70 ? 'down' : undefined,
      }
    }
    case 'ivHv': {
      const ivPremiumPct = a.ivPremiumPct
      return {
        label,
        value: ivPremiumPct === undefined ? '—' : signedPct(ivPremiumPct, 0),
        tone: ivPremiumPct === undefined ? undefined : ivPremiumPct <= 0 ? 'up' : 'down',
      }
    }
    case 'model':
      return {
        label,
        value: signedPct(a.modelEdgePct, 1),
        tone: a.modelEdgePct >= 0 ? 'up' : 'down',
      }
    case 'rr':
      return { label, value: `${a.rMultiple.toFixed(1)}R`, tone: a.rMultiple >= 2 ? 'up' : undefined }
    case 'ev':
      return {
        label,
        value: compactSignedDollars(a.expectedValue),
        tone: a.expectedValue >= 0 ? 'up' : 'down',
      }
    case 'pop':
      return { label, value: `${a.pop.toFixed(0)}%` }
    case 'touch':
      return { label, value: `${a.probTouchTarget.toFixed(0)}%` }
    case 'delta':
      return { label, value: a.delta.toFixed(2) }
    case 'gamma':
      return { label, value: a.gamma.toFixed(3) }
    case 'theta':
      return { label, value: `−$${Math.abs(a.theta).toFixed(2)}`, tone: 'down' }
    case 'thetaBurn':
      return {
        label,
        value: `${a.thetaPctOfDebit.toFixed(2)}%`,
        tone: a.thetaPctOfDebit >= 1 ? 'down' : undefined,
      }
    case 'vega':
      return { label, value: `$${a.vega.toFixed(2)}` }
    case 'expectedMove':
      return { label, value: `±${a.expectedMovePct.toFixed(1)}%` }
    case 'requiredMove':
      return { label, value: `${a.requiredMovePct.toFixed(1)}%` }
    case 'cushion':
      return {
        label,
        value: `${a.cushion.toFixed(2)}×`,
        tone: a.cushion >= 1 ? 'up' : 'down',
      }
    case 'leverage': {
      // Notional the delta controls, per dollar of premium at risk.
      const notional = Math.abs(a.delta) * a.spot * 100
      const perDollar = a.debit > 0 ? notional / (a.debit * 100) : 0
      return { label, value: `${perDollar.toFixed(1)}×` }
    }
    case 'spread':
      return {
        label,
        value: `${a.spreadPct.toFixed(1)}%`,
        tone: a.spreadPct <= 5 ? 'up' : 'down',
      }
    case 'openInterest':
      // Absent for every live contract: open interest is a fact about a real
      // market the browser cannot know, and the seeded stand-in was deleted
      // with the rest of the in-browser IV/OI fabrication (§6).
      return { label, value: a.openInterest === undefined ? '—' : compactCount(a.openInterest) }
    case 'dte':
      return { label, value: `${a.daysToExpiry}d` }
    case 'breakeven':
      return { label, value: `$${a.breakeven.toFixed(2)}` }
  }
}

function signedPct(value: number, digits: number): string {
  return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(digits)}%`
}

function compactSignedDollars(value: number): string {
  const abs = Math.abs(value)
  const sign = value >= 0 ? '+' : '−'
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}K`
  return `${sign}$${Math.round(abs)}`
}

function compactCount(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
  return String(value)
}
