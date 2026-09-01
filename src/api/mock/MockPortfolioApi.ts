import type {
  ActivityEvent,
  ExitRequest,
  Order,
  OrderRequest,
  PerformancePeriod,
  PerformanceSeries,
  PortfolioAccount,
  PortfolioMeta,
  PortfolioOutlook,
  Position,
} from '@/api/types'
import type { PortfolioApi } from '@/api/portfolioApi'
import { getBrokerage } from '@/data/brokerages'
import { gaussian, hashString, mulberry32 } from '@/lib/prng'
import { latency } from '@/api/mock/latency'
import {
  ACCOUNT_POSITION_IDS,
  DEMO_ACCOUNTS,
  DEMO_IDEAS,
  DEMO_POSITIONS,
  DEMO_OUTLOOK,
  PORTFOLIO_META,
  SEED_ACTIVITY,
} from '@/api/mock/seededData'

const PERIOD_CONFIG: Record<
  PerformancePeriod,
  { points: number; stepSeconds: number; totalDrift: number; vol: number }
> = {
  '1D': { points: 78, stepSeconds: 300, totalDrift: 0.0121, vol: 0.0016 },
  '1W': { points: 84, stepSeconds: 3600 * 2, totalDrift: 0.0264, vol: 0.0028 },
  '1M': { points: 66, stepSeconds: 3600 * 11, totalDrift: 0.0538, vol: 0.0043 },
  '3M': { points: 92, stepSeconds: 3600 * 24, totalDrift: 0.1174, vol: 0.0061 },
  '1Y': { points: 120, stepSeconds: 3600 * 73, totalDrift: 0.3486, vol: 0.0094 },
  ALL: { points: 150, stepSeconds: 3600 * 146, totalDrift: 0.6215, vol: 0.0119 },
}

/**
 * In-memory portfolio API.
 *
 * Holds mutable demo state (positions, submitted orders, activity) so that
 * "Add to Portfolio" and the mock trade ticket produce durable, visible
 * consequences for the length of a session.
 */
const STORAGE_KEY = 'stratfolio.portfolio.v1'

interface PersistedState {
  positions: Position[]
  accountMembership: Record<string, string[]>
  orders: Order[]
  activity: ActivityEvent[]
}

export class MockPortfolioApi implements PortfolioApi {
  private positions: Position[]
  private accountMembership: Record<string, string[]>
  private orders: Order[]
  private activity: ActivityEvent[]

  constructor() {
    const restored = this.load()
    const seededWalmart = DEMO_POSITIONS.find((position) => position.id === 'pos-wmt-sep')
    this.positions = restored?.positions
      ? restored.positions.map((position) =>
          position.id === seededWalmart?.id ? { ...position, ...seededWalmart } : position,
        )
      : DEMO_POSITIONS.map((p) => ({ ...p }))
    this.accountMembership = restored?.accountMembership ?? {
      demo: [...ACCOUNT_POSITION_IDS.demo],
      growth: [...ACCOUNT_POSITION_IDS.growth],
      income: [...ACCOUNT_POSITION_IDS.income],
    }
    this.orders = restored?.orders ?? []
    this.activity = restored?.activity ?? SEED_ACTIVITY.map((a) => ({ ...a }))
  }

  /**
   * Session state (positions added from ideas, submitted orders, activity) is
   * persisted so a page reload mid-demo does not silently undo the user's
   * actions. Seeded data is the fallback, never overwritten in place.
   */
  private load(): PersistedState | null {
    if (typeof localStorage === 'undefined') return null
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as PersistedState
      if (!Array.isArray(parsed?.positions) || parsed.positions.length === 0) return null
      return parsed
    } catch {
      return null
    }
  }

  private persist() {
    if (typeof localStorage === 'undefined') return
    try {
      const state: PersistedState = {
        positions: this.positions,
        accountMembership: this.accountMembership,
        orders: this.orders,
        activity: this.activity,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* storage unavailable — the demo still works in memory */
    }
  }

  async getAccounts(): Promise<PortfolioAccount[]> {
    await latency(90)
    return DEMO_ACCOUNTS.map((account) => ({ ...account, provenance: 'mock' as const }))
  }

  async getPositions(accountId: string): Promise<Position[]> {
    await latency(220)
    const ids = new Set(this.accountMembership[accountId] ?? this.accountMembership.demo)
    return this.positions
      .filter((p) => ids.has(p.id))
      .map((p) => ({ ...p, provenance: 'mock' as const }))
  }

  async getMeta(accountId: string): Promise<PortfolioMeta> {
    await latency(120)
    const base = PORTFOLIO_META[accountId] ?? PORTFOLIO_META.demo
    const ids = new Set(this.accountMembership[accountId] ?? this.accountMembership.demo)
    const totalDeposited = this.positions
      .filter((p) => ids.has(p.id))
      .reduce((sum, p) => sum + p.avgCost * p.quantity * (p.assetType === 'option' ? 100 : 1), 0)
    return { ...base, totalDeposited, provenance: 'mock' }
  }

  async getOutlook(accountId: string): Promise<PortfolioOutlook> {
    await latency(260)
    if (accountId === 'demo') return { ...DEMO_OUTLOOK, provenance: 'mock' }
    return {
      ...DEMO_OUTLOOK,
      provenance: 'mock',
      headline:
        accountId === 'growth'
          ? 'High-conviction sleeve is performing, but it is a single-factor bet on AI compute.'
          : 'Defensive sleeve is doing its job — low drawdown, steady conviction, room to add risk.',
      score: accountId === 'growth' ? 71 : 84,
      stance: accountId === 'growth' ? 'Constructive · reduce beta' : 'Stable · room to add',
    }
  }

  async getPerformance(accountId: string, period: PerformancePeriod): Promise<PerformanceSeries> {
    await latency(180)
    const cfg = PERIOD_CONFIG[period]
    const rand = mulberry32(hashString(`${accountId}:${period}`))
    const now = Math.floor(Date.now() / 1000)

    // Build a seeded path, then normalise so the final point is exactly 1.0.
    // The chart multiplies by the live portfolio value, which keeps the chart
    // and the hero number in agreement at all times.
    const raw: number[] = []
    let level = 1
    for (let i = 0; i < cfg.points; i++) {
      const t = i / (cfg.points - 1)
      const trend = 1 - cfg.totalDrift * (1 - t)
      const wobble =
        Math.sin(t * Math.PI * 5 + hashString(accountId) * 0.0001) * cfg.vol * 2.2 +
        Math.sin(t * Math.PI * 13) * cfg.vol * 0.9
      level = trend + wobble + gaussian(rand) * cfg.vol
      raw.push(level)
    }
    const last = raw[raw.length - 1]
    return {
      // The demo series is relative by construction — the chart scales it
      // against the live portfolio value so the right edge and the hero number
      // always agree. The live adapter returns a `settled-equity` series
      // instead, which must never be scaled that way (plan §3.1).
      basis: 'relative-multiplier',
      label: 'Simulated portfolio value',
      provenance: 'mock',
      points: raw.map((value, i) => ({
        time: now - (cfg.points - 1 - i) * cfg.stepSeconds,
        multiplier: value / last,
      })),
    }
  }

  async submitOrder(request: OrderRequest): Promise<Order> {
    await latency(520)
    const position = this.positions.find((p) => p.id === request.positionId)
    const multiplier = position?.assetType === 'option' ? 100 : 1
    const estimatedValue = request.quantity * request.estimatedPrice * multiplier
    // The demo book is brokerage-flavoured; live orders carry no brokerage at
    // all (one paper portfolio, HKP-PLT-6), which is why this defaults here
    // rather than in the shared view model.
    const brokerageId = request.brokerageId ?? position?.brokerageId ?? 'robinhood'
    const order: Order = {
      id: `ord-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`,
      symbol: request.symbol,
      company: position?.company ?? request.symbol,
      side: request.side,
      quantity: request.quantity,
      price: request.estimatedPrice,
      estimatedValue,
      brokerageId,
      status: 'SUBMITTED',
      submittedAt: new Date().toISOString(),
      provenance: 'mock',
    }
    this.orders.unshift(order)
    this.activity.unshift({
      id: `act-${order.id}`,
      kind: 'order',
      title: `${request.side === 'BUY' ? 'Buy' : 'Sell'} ${request.quantity} ${request.symbol} submitted`,
      detail: `${request.limitPrice ? `Limit ${request.limitPrice.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}` : 'Market'} order · est. ${estimatedValue.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
      })} · ${getBrokerage(brokerageId).short} ${getBrokerage(brokerageId).accountMask}`,
      symbol: request.symbol,
      at: order.submittedAt,
      provenance: 'mock',
    })

    this.persist()

    // Deliberately non-destructive: submitting an order never removes the
    // position. A real fill would arrive asynchronously from the broker.
    return order
  }

  /**
   * The demo book's version of a hand close.
   *
   * The demo ticket keeps its own simulated flow — quantity slider, limit
   * price, routing animation — and still goes through `submitOrder`. This
   * exists so the seam is total, and so a component that reaches for the exit
   * path in a mock build gets the demo's own simulated sell rather than a
   * crash: the whole position, at its last simulated mark.
   */
  async requestExit(request: ExitRequest): Promise<Order> {
    const position = this.positions.find((p) => p.id === request.positionId)
    if (!position) throw new Error(`Unknown position: ${request.positionId}`)
    return this.submitOrder({
      symbol: position.symbol,
      side: 'SELL',
      intent: 'close',
      quantity: position.quantity,
      estimatedPrice: position.lastPrice ?? position.avgCost,
      positionId: position.id,
      brokerageId: position.brokerageId,
      idempotencyKey: request.idempotencyKey,
    })
  }

  async addPositionFromIdea(
    accountId: string,
    ideaId: string,
    quantity: number,
  ): Promise<Position> {
    await latency(420)
    const idea = DEMO_IDEAS.find((i) => i.id === ideaId)
    if (!idea) throw new Error(`Unknown idea: ${ideaId}`)

    const existing = this.positions.find(
      (p) => p.symbol === idea.symbol && p.contractDetail === idea.contractDetail,
    )
    const entryPrice = idea.assetType === 'option' ? idea.entryHigh : idea.referencePrice

    if (existing) {
      const totalQty = existing.quantity + quantity
      existing.avgCost =
        (existing.avgCost * existing.quantity + entryPrice * quantity) / totalQty
      existing.quantity = totalQty
      this.pushIdeaActivity(idea.symbol, quantity, true)
      this.persist()
      return { ...existing }
    }

    const position: Position = {
      id: `pos-${idea.id}-${Date.now().toString(36)}`,
      symbol: idea.symbol,
      company: idea.company,
      assetType: idea.assetType,
      contractDetail: idea.contractDetail,
      openingSide: idea.assetType === 'option' ? 'BUY_TO_OPEN' : undefined,
      brokerageId: 'robinhood',
      quantity,
      avgCost: entryPrice,
      openedAt: new Date().toISOString(),
      ai: idea.ai ? { ...idea.ai } : undefined,
      provenance: 'mock',
    }
    this.positions.push(position)
    for (const key of Object.keys(this.accountMembership)) {
      if (key === 'demo' || key === accountId) this.accountMembership[key].push(position.id)
    }
    this.pushIdeaActivity(idea.symbol, quantity, false)
    this.persist()
    return { ...position }
  }

  private pushIdeaActivity(symbol: string, quantity: number, added: boolean) {
    this.activity.unshift({
      id: `act-idea-${symbol}-${Date.now()}`,
      kind: 'order',
      title: `${added ? 'Added to' : 'Opened'} ${symbol} position · ${quantity} units`,
      detail: added
        ? 'Averaged into an existing holding from an AI idea.'
        : 'New position opened from the AI Ideas feed.',
      symbol,
      at: new Date().toISOString(),
    })
  }

  async getActivity(): Promise<ActivityEvent[]> {
    await latency(160)
    return this.activity
      .slice()
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .map((event) => ({ ...event, provenance: 'mock' as const }))
  }

  async getOrders(): Promise<Order[]> {
    await latency(140)
    return this.orders.map((order) => ({ ...order }))
  }
}

export const mockPortfolioApi = new MockPortfolioApi()
