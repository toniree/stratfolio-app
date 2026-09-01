import type {
  CreatePlannerIdeaInput,
  PlanView,
  UpdatePlannerIdeaInput,
} from '@/api/newsTypes'
import type { PlannerApi } from '@/api/portfolioApi'
import { request } from '@/api/http/client'
import { ApiError } from '@/api/http/problem'
import { PLT_LIST_LIMIT_MAX, type PltThesis, type PltTradePlan } from '@/api/http/wire/plt'
import { sortPlansNewestFirst, toPlanView } from '@/api/http/adapters/plan'
import { toCreateTradePlanRequest } from '@/api/http/adapters/execution'
import { newIdempotencyKey } from '@/api/http/idempotency'

/**
 * The live planner domain, over service-plt (APP-113).
 *
 * Reads are the whole trade-plan list; the write is `POST /api/v1/trade-plans`,
 * the same endpoint the ticket uses, with the same D11-pinned policy inputs.
 *
 * Edit, disable and delete have **no backend path at all** (HKP-PLT-4): plt
 * exposes no update or delete route, and although `CANCELLED` exists in the
 * status enum, no service path sets it. Rather than pretend, those throw, and
 * the UI records the user's intent locally plus a schema-valid activity row
 * (`recordPlanDisabled` in `http/userActivity.ts`).
 */
export class HttpPlannerApi implements PlannerApi {
  private unavailable(operation: string, gap: string, detail: string): never {
    throw new ApiError({
      message: detail,
      status: 501,
      url: operation,
      problem: {
        type: 'https://stratfolio.local/problems/capability-unavailable',
        title: 'Not available in live mode',
        status: 501,
        detail,
        gap,
      },
    })
  }

  /**
   * Every plan, joined to its thesis.
   *
   * Two requests, not one per plan: the thesis list is fetched once and
   * indexed. A by-id fan-out over `thesis_id` would be an N+1 on a screen that
   * renders a hundred rows.
   */
  async getIdeas(): Promise<PlanView[]> {
    const [plans, theses] = await Promise.all([
      request<PltTradePlan[]>('plt', '/api/v1/trade-plans', {
        query: { limit: PLT_LIST_LIMIT_MAX },
      }),
      request<PltThesis[]>('plt', '/api/v1/theses', { query: { limit: PLT_LIST_LIMIT_MAX } }),
    ])
    const byId = new Map(theses.map((thesis) => [thesis.id, thesis]))
    return sortPlansNewestFirst(
      plans.map((plan) => toPlanView(plan, plan.thesis_id ? byId.get(plan.thesis_id) : undefined)),
    )
  }

  async getIdea(id: string): Promise<PlanView | undefined> {
    let plan: PltTradePlan
    try {
      plan = await request<PltTradePlan>('plt', `/api/v1/trade-plans/${encodeURIComponent(id)}`)
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return undefined
      throw error
    }
    // A rejected plan is readable by id too, which is the point: the user needs
    // to see why it was refused.
    let thesis: PltThesis | undefined
    if (plan.thesis_id) {
      thesis = await request<PltThesis>(
        'plt',
        `/api/v1/theses/${encodeURIComponent(plan.thesis_id)}`,
      ).catch(() => undefined)
    }
    return toPlanView(plan, thesis)
  }

  /**
   * Create a plan the user wrote.
   *
   * The same `POST /api/v1/trade-plans` the ticket uses, so the same pinned
   * policy inputs apply (D11) and the same 422 carries `rejection_reasons[]`.
   * A plan with no contract cannot be created: plt validates a contract, and
   * inventing a strike to satisfy the schema is exactly what §6 forbids.
   */
  async createIdea(input: CreatePlannerIdeaInput): Promise<PlanView> {
    if (!input.contract) {
      this.unavailable(
        'createIdea',
        'APP-113',
        'A trade plan needs a contract selected from the live chain — plt validates the option identity, and one cannot be guessed.',
      )
    }
    const plan = await request<PltTradePlan>('plt', '/api/v1/trade-plans', {
      method: 'POST',
      body: toCreateTradePlanRequest({
        symbol: input.symbol,
        side: 'BUY',
        intent: 'open',
        quantity: input.quantity ?? 1,
        estimatedPrice: input.contract.mid ?? input.entryHigh,
        contract: input.contract,
        thesisId: input.thesisId,
        profitTargetPct: input.profitTargetPct,
        stopLossPct: input.stopLossPct,
      }),
      idempotencyKey: newIdempotencyKey('plan'),
    })
    return toPlanView(plan)
  }

  async updateIdea(_id: string, _input: UpdatePlannerIdeaInput): Promise<PlanView> {
    this.unavailable(
      'updateIdea',
      'HKP-PLT-4',
      'plt exposes no update route for a trade plan. Editing one client-side would show a plan the platform service does not have.',
    )
  }

  async deleteIdea(_id: string): Promise<void> {
    this.unavailable(
      'deleteIdea',
      'HKP-PLT-4',
      'plt exposes no delete or cancel route. CANCELLED exists in the status enum but no service path sets it, so a plan cannot be withdrawn.',
    )
  }
}

export const httpPlannerApi = new HttpPlannerApi()
