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
import type { BktExecutionOutcome, BktExecutionRequest } from '@/api/http/wire/bkt'
import { decimal } from '@/api/http/wire/scalars'
import { newIdempotencyKey } from '@/api/http/idempotency'
import {
  mergeOrders,
  toAccount,
  toActivityEvent,
  toMeta,
  toPosition,
  toSettledEquitySeries,
} from '@/api/http/adapters/portfolio'
import {
  toCreateTradePlanRequest,
  toOrderFromExecution,
  toOrderFromRejection,
} from '@/api/http/adapters/execution'

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

  /**
   * Open a silent option position: plt plan → bkt execution (APP-112).
   *
   * Returns an `Order` for every *outcome* — `FILLED`, the equally successful
   * `NO_FILL`, and the `REJECTED` that plt's 422 represents — and throws only
   * when the operation's fate is genuinely unknown (transport, 5xx, a bkt
   * 503 that recorded nothing). That split is what the ticket's key discipline
   * rests on: an outcome means "try again" is a *new* operation and mints a new
   * key, while a thrown `ApiError` means retry the *same* operation with the
   * same key and let the servers replay what they recorded (D6).
   *
   * Closing is refused outright. plt's `/close` wants real fill facts and no
   * user-initiated exit route exists (HKP-BKT-1); BKT-018 is building one and
   * wiring it is a separate task.
   */
  async submitOrder(orderRequest: OrderRequest): Promise<Order> {
    if (orderRequest.intent === 'close' || orderRequest.side === 'SELL') {
      this.unavailable(
        'submitOrder(close)',
        'HKP-BKT-1',
        'Closing a position needs a user-initiated exit route. plt’s /close records a fill that already happened, and a ticket must never supply an estimated one.',
      )
    }
    if (!orderRequest.contract) {
      this.unavailable(
        'submitOrder(open)',
        'APP-112',
        'An option order needs full contract identity selected from the live chain — bkt refuses a plan whose contract it cannot re-resolve.',
      )
    }

    const submittedAt = new Date().toISOString()
    // One key for one logical user operation, at both services. plt takes it
    // as a header and bkt in the body (§7.7); the *string* is deliberately the
    // same so a single operation is one line in both audit trails.
    const key = orderRequest.idempotencyKey ?? newIdempotencyKey('open')

    let plan: PltTradePlan
    try {
      plan = await request<PltTradePlan>('plt', '/api/v1/trade-plans', {
        method: 'POST',
        body: toCreateTradePlanRequest(orderRequest),
        idempotencyKey: key,
      })
    } catch (error) {
      // 422 is a returned verdict, not a failure: plt persisted the plan as
      // REJECTED and every replay of this key answers the same 422.
      if (error instanceof ApiError && error.isRejection) {
        const rejected = toOrderFromRejection(error, orderRequest, submittedAt)
        if (rejected.sessionOnly) this.retainSessionOutcome(rejected)
        return rejected
      }
      throw error
    }

    let outcome: BktExecutionOutcome
    try {
      outcome = await request<BktExecutionOutcome>('bkt', '/api/v1/executions', {
        method: 'POST',
        // bkt's idempotency is a **body** field. Sending an embedded plan is a
        // 422 (`EMBEDDED_PLAN_FORBIDDEN`) — bkt reads the plan from plt.
        body: {
          trade_plan_id: plan.id,
          idempotency_key: key,
          decision_episode_id: plan.decision_episode_id,
        } satisfies BktExecutionRequest,
      })
    } catch (error) {
      if (error instanceof ApiError && error.isRejection) {
        const rejected = toOrderFromRejection(error, orderRequest, submittedAt)
        return { ...rejected, tradePlanId: plan.id, id: plan.id, sessionOnly: false }
      }
      // The plan is durable and the execution attempt's fate is unknown. The
      // caller retries the same operation with the same key; bkt replays.
      throw error
    }

    const order = toOrderFromExecution(outcome, orderRequest, submittedAt)
    // A NO_FILL, or a fill plt never heard about, exists nowhere else
    // (HKP-BKT-4) — keep it for the session or order history forgets the user
    // ever attempted the trade.
    if (order.sessionOnly) this.retainSessionOutcome(order)
    return order
  }

  async addPositionFromIdea(): Promise<Position> {
    this.unavailable(
      'addPositionFromIdea',
      'APP-112',
      'Opening from a thesis goes through the same plan → execution path, but a thesis records no contract: the ticket selects one from the live chain first.',
    )
  }
}

export const httpPortfolioApi = new HttpPortfolioApi()
