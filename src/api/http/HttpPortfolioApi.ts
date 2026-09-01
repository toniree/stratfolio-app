import type {
  ActivityEvent,
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
import { request } from '@/api/http/client'
import { ApiError } from '@/api/http/problem'
import {
  PLT_LIST_LIMIT_MAX,
  type PltActivity,
  type PltPortfolio,
  type PltPosition,
  type PltSilentTrade,
  type PltTradePlan,
} from '@/api/http/wire/plt'
import { decimal } from '@/api/http/wire/scalars'
import {
  mergeOrders,
  toAccount,
  toActivityEvent,
  toMeta,
  toPosition,
  toSettledEquitySeries,
} from '@/api/http/adapters/portfolio'

/**
 * The live portfolio domain, over service-plt.
 *
 * Scope is deliberately read-only. Every write in this interface is blocked
 * on backend capability the plan does not let Wave A invent:
 *  - `submitOrder` opening needs the mnd chain for contract identity (Wave B0)
 *    plus the D11-pinned plan → execution path (APP-112);
 *  - `submitOrder` closing needs a user-initiated exit route that does not
 *    exist (HKP-BKT-1) — plt's `/close` demands real fill facts and a UI must
 *    never supply estimates;
 *  - `addPositionFromIdea` is the same write behind a different door;
 *  - `getOutlook` has no endpoint at all (HKP-AI-5).
 *
 * Each throws a typed `ApiError` describing the gap rather than degrading to
 * mock data, so a live build cannot quietly show simulated numbers.
 */
export class HttpPortfolioApi implements PortfolioApi {
  /**
   * bkt execution outcomes that left no durable row.
   *
   * A `NO_FILL` is a successful 201 that creates no silent trade, and bkt has
   * no list-executions endpoint (HKP-BKT-4) — so without this the app's order
   * history would silently forget that the user ever attempted the trade.
   * Session-scoped and clearly labelled; the durable fix is a backend task.
   */
  private readonly sessionOutcomes: Order[] = []

  private unavailable(operation: string, gap: string, detail: string): never {
    throw new ApiError({
      message: detail,
      status: 501,
      url: operation,
      problem: {
        type: `https://stratfolio.local/problems/capability-unavailable`,
        title: 'Not available in live mode',
        status: 501,
        detail,
        gap,
      },
    })
  }

  async getAccounts(): Promise<PortfolioAccount[]> {
    const wire = await request<PltPortfolio>('plt', '/api/v1/portfolio')
    // Exactly one: plt has a single portfolio and no brokerage model
    // (HKP-PLT-6). The selector shows one real account rather than inventing
    // sleeves.
    return [toAccount(wire)]
  }

  async getMeta(): Promise<PortfolioMeta> {
    const wire = await request<PltPortfolio>('plt', '/api/v1/portfolio')
    return toMeta(wire)
  }

  async getPositions(): Promise<Position[]> {
    // `status` overrides `include_closed` server-side; asking explicitly means
    // a future change to plt's default cannot silently add closed rows.
    const wire = await request<PltPosition[]>('plt', '/api/v1/positions', {
      query: { status: 'OPEN' },
    })
    return wire.map(toPosition)
  }

  async getActivity(): Promise<ActivityEvent[]> {
    const wire = await request<PltActivity[]>('plt', '/api/v1/activity', { query: { limit: 100 } })
    return wire.map(toActivityEvent)
  }

  /**
   * The settled-equity curve.
   *
   * `period` is accepted for interface compatibility but does not filter:
   * plt's silent-trades list takes only `status` and `limit` (no date range,
   * no cursor — HKP-PLT-8), so the honest series is "the last ≤500 closed
   * trades", labelled as such, rather than a window the backend cannot serve.
   */
  async getPerformance(_accountId: string, _period: PerformancePeriod): Promise<PerformanceSeries> {
    const [portfolio, trades] = await Promise.all([
      request<PltPortfolio>('plt', '/api/v1/portfolio'),
      request<PltSilentTrade[]>('plt', '/api/v1/silent-trades', {
        query: { status: 'CLOSED', limit: PLT_LIST_LIMIT_MAX },
      }),
    ])
    return toSettledEquitySeries(trades, {
      startingCapital: decimal(portfolio.starting_capital),
      // Hitting the cap exactly is the only signal available that older
      // history exists and is unreachable.
      truncated: trades.length >= PLT_LIST_LIMIT_MAX,
    })
  }

  async getOrders(): Promise<Order[]> {
    // plt's list endpoints take one `status` each, so validated and rejected
    // plans are two calls. Deliberately not an N+1 fan-out over
    // `/executions/by-plan/{id}` (plan §3.1).
    const [silentTrades, validated, rejected] = await Promise.all([
      request<PltSilentTrade[]>('plt', '/api/v1/silent-trades', {
        query: { limit: PLT_LIST_LIMIT_MAX },
      }),
      request<PltTradePlan[]>('plt', '/api/v1/trade-plans', {
        query: { status: 'VALIDATED', limit: PLT_LIST_LIMIT_MAX },
      }),
      request<PltTradePlan[]>('plt', '/api/v1/trade-plans', {
        query: { status: 'REJECTED', limit: PLT_LIST_LIMIT_MAX },
      }),
    ])
    return mergeOrders({
      silentTrades,
      tradePlans: [...validated, ...rejected],
      sessionOutcomes: this.sessionOutcomes,
    })
  }

  /**
   * Record a bkt execution outcome that left no durable row.
   *
   * Called by the Wave-B ticket (APP-112) after a `NO_FILL`, a `REJECTED`, or
   * a fill whose `reported_to_platform` was false. Retained for the session
   * only — this is a stand-in for HKP-BKT-4, not a store.
   */
  retainSessionOutcome(order: Order): void {
    this.sessionOutcomes.unshift(order)
  }

  async getOutlook(): Promise<PortfolioOutlook> {
    this.unavailable(
      'getOutlook',
      'HKP-AI-5',
      'service-ai exposes no portfolio outlook or stance endpoint.',
    )
  }

  async submitOrder(_request: OrderRequest): Promise<Order> {
    this.unavailable(
      'submitOrder',
      'APP-112',
      'Order submission needs live chain contract identity (Wave B0) and the pinned plan → execution path; it lands in Wave B.',
    )
  }

  async addPositionFromIdea(): Promise<Position> {
    this.unavailable(
      'addPositionFromIdea',
      'APP-112',
      'Opening a position from an idea goes through the same plan → execution path as the ticket; it lands in Wave B.',
    )
  }
}

export const httpPortfolioApi = new HttpPortfolioApi()
