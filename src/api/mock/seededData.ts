import { ALL_IDEAS, ALL_POSITIONS, EXTRA_SYMBOLS } from '@/api/mock/seededOptionsBook'
import type {
  ActivityEvent,
  Idea,
  PortfolioAccount,
  PortfolioMeta,
  PortfolioOutlook,
  Position,
} from '@/api/types'

/** Static reference data for every symbol the demo can price. */
export interface SymbolSpec {
  symbol: string
  company: string
  /** Yesterday's close — day change is always measured against this. */
  previousClose: number
  /** Opening print for today's session. */
  open: number
  /** Annualised-ish volatility knob for the simulator (higher = livelier). */
  volatility: number
  /** Gentle intraday drift, in fraction of price across the session. */
  drift: number
}

export const SYMBOLS: SymbolSpec[] = [
  { symbol: 'NVDA', company: 'NVIDIA Corp.', previousClose: 174.32, open: 175.9, volatility: 1.5, drift: 0.011 },
  { symbol: 'AAPL', company: 'Apple Inc.', previousClose: 231.18, open: 231.5, volatility: 0.7, drift: 0.004 },
  { symbol: 'MSFT', company: 'Microsoft Corp.', previousClose: 428.64, open: 429.2, volatility: 0.75, drift: 0.005 },
  { symbol: 'AMD', company: 'Advanced Micro Devices', previousClose: 158.77, open: 159.3, volatility: 1.7, drift: 0.004 },
  { symbol: 'TSLA', company: 'Tesla Inc.', previousClose: 316.4, open: 313.2, volatility: 2.1, drift: -0.012 },
  { symbol: 'PLTR', company: 'Palantir Technologies', previousClose: 74.91, open: 75.8, volatility: 2.0, drift: 0.014 },
  { symbol: 'AMZN', company: 'Amazon.com Inc.', previousClose: 205.63, open: 206.1, volatility: 0.9, drift: 0.006 },
  { symbol: 'SOFI', company: 'SoFi Technologies', previousClose: 14.82, open: 14.7, volatility: 2.2, drift: 0.009 },
  { symbol: 'GOOGL', company: 'Alphabet Inc. Class A', previousClose: 189.44, open: 190.2, volatility: 0.85, drift: 0.007 },
  { symbol: 'SPY', company: 'SPDR S&P 500 ETF Trust', previousClose: 592.11, open: 592.9, volatility: 0.45, drift: 0.003 },
  { symbol: 'ASML', company: 'ASML Holding N.V.', previousClose: 742.5, open: 745.1, volatility: 1.2, drift: 0.008 },
  { symbol: 'UBER', company: 'Uber Technologies', previousClose: 78.36, open: 78.1, volatility: 1.1, drift: 0.005 },
  { symbol: 'ARM', company: 'Arm Holdings plc', previousClose: 142.05, open: 143.4, volatility: 1.9, drift: 0.01 },
  { symbol: 'CRWD', company: 'CrowdStrike Holdings', previousClose: 356.9, open: 357.8, volatility: 1.3, drift: 0.006 },
  { symbol: 'LLY', company: 'Eli Lilly and Co.', previousClose: 812.4, open: 810.2, volatility: 0.95, drift: -0.003 },
  { symbol: 'TSM', company: 'Taiwan Semiconductor', previousClose: 208.7, open: 210.3, volatility: 1.25, drift: 0.009 },
  { symbol: 'NEE', company: 'NextEra Energy', previousClose: 71.28, open: 71.05, volatility: 0.8, drift: 0.004 },
  { symbol: 'MU', company: 'Micron Technology', previousClose: 118.42, open: 119.6, volatility: 1.8, drift: 0.012 },
  { symbol: 'SHOP', company: 'Shopify Inc.', previousClose: 112.86, open: 113.4, volatility: 1.6, drift: 0.007 },
  { symbol: 'COIN', company: 'Coinbase Global', previousClose: 268.15, open: 264.9, volatility: 2.4, drift: -0.008 },
]

SYMBOLS.push(...EXTRA_SYMBOLS)

export const SYMBOL_MAP = new Map(SYMBOLS.map((s) => [s.symbol, s]))

export const DEMO_ACCOUNTS: PortfolioAccount[] = [
  { id: 'demo', name: 'All Accounts', subtitle: 'Linked brokerage accounts', isDemo: true },
  { id: 'growth', name: 'Growth Sleeve', subtitle: 'High-conviction equities', isDemo: true },
  { id: 'income', name: 'Income & Hedge', subtitle: 'Lower beta · cash-flowing', isDemo: true },
]

export const PORTFOLIO_META: Record<string, PortfolioMeta> = {
  demo: { buyingPower: 24350.75, cash: 18420.4, totalDeposited: 0 },
  growth: { buyingPower: 9120.0, cash: 6210.15, totalDeposited: 0 },
  income: { buyingPower: 15230.75, cash: 12210.25, totalDeposited: 0 },
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()
const daysAgo = (d: number) => new Date(Date.now() - d * 86400_000).toISOString()

/** The demo book is entirely options — there are no share positions. */
export const DEMO_POSITIONS: Position[] = ALL_POSITIONS.map((p) => ({ ...p }))

/** Which positions belong to which portfolio account. */
export const ACCOUNT_POSITION_IDS: Record<string, string[]> = {
  demo: DEMO_POSITIONS.map((p) => p.id),
  growth: ['pos-sndk-nov', 'pos-mu-jan', 'pos-nvda-dec', 'pos-tsm-jan', 'pos-wdc-dec'],
  income: ['pos-msft-dec', 'pos-aapl-jan', 'pos-vrt-feb', 'pos-nee-feb', 'pos-coin-put'],
}

/** Every recommendation is an options structure too. */
export const DEMO_IDEAS: Idea[] = ALL_IDEAS.map((i) => ({ ...i }))

export const DEMO_OUTLOOK: PortfolioOutlook = {
  stance: 'Constructive · trim concentration',
  headline: 'Your portfolio is well positioned but dangerously concentrated in AI semis.',
  summary:
    'Six of eight holdings carry conviction above 60, and aggregate conviction rose 2 points this session. The binding constraint is not idea quality — it is position sizing. Semiconductor exposure represents a large share of portfolio value, so a single sector shock drives most of your drawdown risk. Trimming NVDA into strength and adding the NEE or SPY ballast would materially improve risk-adjusted return without changing your thesis.',
  score: 78,
  scoreLabel: 'Portfolio health',
  signals: [
    {
      label: 'Conviction trend',
      detail: 'Aggregate conviction +2 today, led by NVDA (+6) and PLTR (+4).',
      tone: 'positive',
    },
    {
      label: 'Concentration risk',
      detail: 'Top holding exceeds 30% of portfolio value — above the 20% guardrail.',
      tone: 'caution',
    },
    {
      label: 'Cash position',
      detail: 'Buying power covers roughly 2 average position sizes — adequate, not excessive.',
      tone: 'neutral',
    },
    {
      label: 'Weakest link',
      detail: 'TSLA conviction fell 8 points; recommendation moved to REDUCE.',
      tone: 'caution',
    },
  ],
  updatedAt: hoursAgo(1),
}

export const SEED_ACTIVITY: ActivityEvent[] = [
  {
    id: 'act-1',
    kind: 'ai-signal',
    title: 'NVDA conviction raised to 88',
    detail: 'Data-center guidance revision drove a +6 conviction change. Recommendation held at TRIM.',
    symbol: 'NVDA',
    at: hoursAgo(2),
  },
  {
    id: 'act-2',
    kind: 'thesis-update',
    title: 'TSLA thesis updated — recommendation moved to REDUCE',
    detail: 'European registration data and a third quarter of margin compression lowered conviction by 8.',
    symbol: 'TSLA',
    at: hoursAgo(1),
  },
  {
    id: 'act-3',
    kind: 'alert',
    title: 'Concentration guardrail breached',
    detail: 'NVDA exceeded 30% of portfolio value. Consider trimming into strength.',
    symbol: 'NVDA',
    at: hoursAgo(3),
  },
  {
    id: 'act-4',
    kind: 'ai-signal',
    title: 'New high-conviction idea: TSM at 91',
    detail: 'N2 pricing and Arizona volume production pushed TSM to the top of the For You feed.',
    symbol: 'TSM',
    at: hoursAgo(1),
  },
  {
    id: 'act-5',
    kind: 'order',
    title: 'Buy 260 PLTR filled',
    detail: 'Filled at $41.05 average · Webull ••••3061',
    symbol: 'PLTR',
    at: daysAgo(176),
  },
  {
    id: 'act-6',
    kind: 'thesis-update',
    title: 'SOFI thesis refreshed',
    detail: 'Fee-based revenue mix crossed 42%; conviction raised 3 points to 68.',
    symbol: 'SOFI',
    at: hoursAgo(11),
  },
]
