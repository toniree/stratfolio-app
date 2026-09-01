import type { Order, OrderRequest } from '@/api/types'
import type { PltCreateTradePlan, PltTradePlan } from '@/api/http/wire/plt'
import type { BktExecutionOutcome } from '@/api/http/wire/bkt'
import { decimal, integer, text } from '@/api/http/wire/scalars'
import { EXECUTION_MODE, RISK_PROFILE, SIDE } from '@/api/http/policy'
import type { ApiError } from '@/api/http/problem'

/**
 * The open path: `OrderRequest` → plt plan → bkt execution → `Order`.
 *
 * Pure functions only, so every rule in plan §7 is testable against a JSON
 * literal: the D11 pinning, the fraction-not-percent exits, the four outcomes
 * a submit can end in, and the `reported_to_platform` recoverable state.
 */

/** plt takes a `YYYY-MM-DD` valuation date; the response never echoes it (§7.9). */
export function asOfDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/** The entry band plt's PolicyGate prices the plan against.
 *
 *  Built symmetrically around the **server's** chain mid, never around a
 *  browser estimate: `ENTRY_RANGE_INVALID` and `ALLOCATION_BELOW_MAX_ENTRY_COST`
 *  are both rejections that come from a band that does not match the money
 *  actually allocated. */
export function entryBand(mid: number, tolerance = 0.05): { min: number; max: number } {
  const width = Math.max(0.01, round2(mid * tolerance))
  return { min: Math.max(0.01, round2(mid - width)), max: round2(mid + width) }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export class MissingContractError extends Error {
  constructor() {
    super('An option order needs a contract selected from the live chain.')
    this.name = 'MissingContractError'
  }
}

/**
 * Build plt's `CreateTradePlanRequest`.
 *
 * `execution_mode` and `risk_profile` are the pinned constants and are *not*
 * parameters of this function (D11) — there is deliberately no way for a
 * caller to pass a different one. `side` is likewise pinned: V1 is long
 * premium only, and no UI control selects it.
 */
export function toCreateTradePlanRequest(
  request: OrderRequest,
  options: { asOf?: string } = {},
): PltCreateTradePlan {
  const contract = request.contract
  if (!contract) throw new MissingContractError()

  const mid = contract.mid ?? request.estimatedPrice
  const band = entryBand(mid)
  // The allocation must cover the worst price inside the band, or PolicyGate
  // refuses with ALLOCATION_BELOW_MAX_ENTRY_COST.
  const capital = round2(band.max * request.quantity * 100)

  return {
    ticker: request.symbol.toUpperCase(),
    thesis_id: request.thesisId,
    option_type: contract.right,
    side: SIDE,
    expiration: contract.expiry,
    dte: contract.dte,
    strike: contract.strike,
    target_entry_min: band.min,
    target_entry_max: band.max,
    quantity: request.quantity,
    capital_allocation: capital,
    profit_target_pct: request.profitTargetPct,
    stop_loss_pct: request.stopLossPct,
    execution_mode: EXECUTION_MODE,
    risk_profile: RISK_PROFILE,
    underlying_snapshot:
      contract.underlyingPrice === undefined ? undefined : { price: contract.underlyingPrice },
    as_of: options.asOf ?? asOfDate(),
  }
}

/** Display form for the contract an order was for. Derived from the contract's
 *  own fields, never from a name table the app does not have. */
export function contractLabel(right: string, strike: number, expiry: string): string {
  return `$${strike} ${right === 'PUT' ? 'Put' : 'Call'} · ${expiry}`
}

/**
 * bkt's `ExecutionOutcome` → the app's `Order`.
 *
 * The three rules this encodes:
 *  - `NO_FILL` is a **successful** 201 (§7.8). It maps to `status: 'NO_FILL'`,
 *    carries no price, and is marked `sessionOnly` because it leaves no
 *    silent-trade row and bkt has no list route (HKP-BKT-4).
 *  - a FILLED outcome with `reported_to_platform: false` is *also* session-only:
 *    the trade happened but plt does not know, so nothing durable will show it.
 *  - money comes from `fill`, and a missing fill means a missing price — never
 *    a zero, and never the estimate the ticket showed.
 */
export function toOrderFromExecution(
  outcome: BktExecutionOutcome,
  request: OrderRequest,
  submittedAt: string,
): Order {
  const fill = outcome.fill ?? undefined
  const price = decimal(fill?.price)
  const quantity = integer(fill?.quantity) ?? request.quantity
  const multiplier = integer(fill?.contract_multiplier) ?? 100
  const reported = outcome.reported_to_platform !== false
  const filled = outcome.status === 'FILLED'

  return {
    id: outcome.execution_id,
    executionId: outcome.execution_id,
    symbol: request.symbol.toUpperCase(),
    side: request.side,
    quantity,
    price,
    estimatedValue: price === undefined ? undefined : price * quantity * multiplier,
    status: outcome.status,
    submittedAt: text(outcome.executed_at) ?? submittedAt,
    reportedToPlatform: outcome.reported_to_platform,
    platformError: text(outcome.platform_error),
    reasonCode: text(outcome.reason_code),
    tradePlanId: outcome.trade_plan_id,
    silentTradeId: text(outcome.silent_trade_id),
    // Durable exactly when plt recorded it. A NO_FILL never is; a fill plt
    // never heard about never is either.
    sessionOnly: !(filled && reported),
    contractDetail: outcome.contract
      ? contractLabel(
          outcome.contract.option_type,
          decimal(outcome.contract.strike) ?? request.contract?.strike ?? 0,
          outcome.contract.expiration,
        )
      : request.contract
        ? contractLabel(request.contract.right, request.contract.strike, request.contract.expiry)
        : undefined,
    provenance: 'live',
  }
}

/**
 * bkt's EXIT `ExecutionOutcome` → the app's `Order` (APP-114, contracts §17).
 *
 * The three rules a close adds to the entry mapping:
 *  - the **fill price is the model's**, off the current mnd quote through the
 *    exit fill model. It is not the mark the user was looking at, and the
 *    ticket says so; copying the screen price here would be the estimate §17
 *    exists to keep out of the book.
 *  - `NO_FILL` leaves the position **OPEN**. It is a successful 201 and a
 *    durable `execution_log` row, so — unlike an entry NO_FILL — it is *not*
 *    session-only invention; but no order row exists for it in plt either,
 *    so it is retained for the session like every other bkt-only outcome.
 *  - `replayed` comes from the HTTP status (200), not from the body: the
 *    exits route rebuilds its response with `outcome_from_record`, which
 *    leaves the wire flag `false` even when replaying.
 */
export function toOrderFromExit(
  outcome: BktExecutionOutcome,
  context: { symbol: string; quantity: number; replayed: boolean; submittedAt: string },
): Order {
  const fill = outcome.fill ?? undefined
  const price = decimal(fill?.price)
  const quantity = integer(fill?.quantity) ?? context.quantity
  const multiplier = integer(fill?.contract_multiplier) ?? 100
  const filled = outcome.status === 'FILLED'
  const reported = outcome.reported_to_platform !== false
  // bkt computes the notional in decimal arithmetic and sends it. Preferring
  // it over `price × quantity × multiplier` avoids re-deriving money in
  // binary floating point, where 18.45 × 300 is 5534.999999999999.
  const proceeds =
    decimal(fill?.notional) ?? (price === undefined ? undefined : price * quantity * multiplier)

  return {
    id: outcome.execution_id,
    executionId: outcome.execution_id,
    symbol: context.symbol.toUpperCase(),
    // A close of a long option is a sell to close. bkt fixes the side itself;
    // this only echoes what it recorded.
    side: 'SELL',
    quantity,
    price,
    estimatedValue: proceeds,
    status: outcome.status,
    submittedAt: text(outcome.executed_at) ?? context.submittedAt,
    reportedToPlatform: outcome.reported_to_platform,
    platformError: text(outcome.platform_error),
    reasonCode: text(outcome.reason_code),
    exitReason: text(outcome.exit_reason),
    replayed: context.replayed,
    tradePlanId: outcome.trade_plan_id,
    silentTradeId: text(outcome.silent_trade_id),
    // Durable in bkt either way, but plt learns about it only when the close
    // was reported: an unreported close is not in the system of record, and a
    // NO_FILL closed nothing to record.
    sessionOnly: !(filled && reported),
    contractDetail: outcome.contract
      ? contractLabel(
          outcome.contract.option_type,
          decimal(outcome.contract.strike) ?? 0,
          outcome.contract.expiration,
        )
      : undefined,
    provenance: 'live',
  }
}

/**
 * A PolicyGate refusal → an `Order` with `status: 'REJECTED'`.
 *
 * A 422 is a *returned outcome*, not a transport failure: plt persisted the
 * plan as REJECTED and will answer an idempotent replay of the same key with
 * the same 422 forever. Surfacing it as an outcome (rather than throwing) is
 * what lets the ticket render `rejection_reasons[]` verbatim and mint a new
 * key for a genuine second attempt (D6).
 */
export function toOrderFromRejection(
  error: ApiError,
  request: OrderRequest,
  submittedAt: string,
): Order {
  const planId = typeof error.problem.trade_plan_id === 'string' ? error.problem.trade_plan_id : undefined
  return {
    id: planId ?? `rejected-${submittedAt}`,
    symbol: request.symbol.toUpperCase(),
    side: request.side,
    quantity: request.quantity,
    status: 'REJECTED',
    submittedAt,
    // Verbatim and in wire order — codes may repeat, and collapsing duplicates
    // would hide that a plan violated the same rule on two legs (§7.5).
    rejectionReasons: error.rejectionReasons,
    tradePlanId: planId,
    contractDetail: request.contract
      ? contractLabel(request.contract.right, request.contract.strike, request.contract.expiry)
      : undefined,
    // plt persists a REJECTED plan, so the merged order history will show it.
    sessionOnly: planId === undefined,
    provenance: 'live',
  }
}

/**
 * A plan plt accepted but that has not executed yet.
 *
 * Only reachable when plt answers 200/201 and the bkt call then fails at the
 * transport level — the plan is durable, the execution attempt is unknown.
 */
export function toOrderFromPlan(plan: PltTradePlan, request: OrderRequest): Order {
  return {
    id: plan.id,
    symbol: plan.ticker.toUpperCase(),
    side: request.side,
    quantity: integer(plan.quantity) ?? request.quantity,
    status: 'SUBMITTED',
    submittedAt: plan.created_at,
    tradePlanId: plan.id,
    rejectionReasons: plan.rejection_reasons,
    provenance: 'live',
  }
}
