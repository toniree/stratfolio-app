import type { WireDecimal } from '@/api/http/wire/scalars'

/**
 * service-bkt wire DTOs (`api/executions.py`).
 *
 * bkt is FastAPI/Pydantic with plain snake_case attribute names — the wire is
 * the declared attribute, with no alias generator and, unlike plt, **no
 * non-null omission**: a null field is serialised as `null` rather than
 * dropped. `Decimal` fields may arrive as strings, which `decimal()` handles.
 *
 * The two things every caller must internalise:
 *  - a 201 means the attempt *completed*, and `status` is `FILLED` **or the
 *    equally successful `NO_FILL`** (§7.8). A `NO_FILL` leaves no silent-trade
 *    row anywhere, and bkt has no list-executions route (HKP-BKT-4), so the
 *    response is the only record of it that will ever exist.
 *  - `reported_to_platform: false` with a `platform_error` means bkt executed
 *    but could not tell plt. The trade happened; the system of record does not
 *    know. That is a recoverable state, never a success toast (D3).
 */

/** `POST /api/v1/executions` body. Idempotency lives **in the body** here —
 *  plt takes a header (§7.7). Sending an embedded `trade_plan` is a 422
 *  (`EMBEDDED_PLAN_FORBIDDEN`): bkt reads the plan from plt, never from us. */
export interface BktExecutionRequest {
  trade_plan_id: string
  decision_episode_id?: string
  /** Max 128 characters, same cap as plt's header. */
  idempotency_key?: string
}

/**
 * `POST /api/v1/executions/exits` body — **the whole body** (contracts §17).
 *
 * `extra: forbid` on bkt's `ExitRequest`, so this interface is closed on
 * purpose: an `exit_price`, an `exit_reason`, a quantity or a side here is a
 * 422, not a field the service ignores. Everything about the exit except
 * *which* trade and *which* operation is measured or assigned server-side —
 * the price from the current mnd quote through the exit fill model, the reason
 * fixed to `USER_CLOSE`, the timestamps from event time.
 *
 * `idempotency_key` is required here, unlike on the entry path.
 */
export interface BktExitRequest {
  silent_trade_id: string
  /** 1..128 characters. */
  idempotency_key: string
}

export type BktExecutionStatus = 'FILLED' | 'NO_FILL' | 'REJECTED'
export type BktExecutionAction = 'ENTRY' | 'EXIT'

export interface BktContractRef {
  occ_symbol: string
  option_type: 'CALL' | 'PUT'
  strike: WireDecimal
  /** `YYYY-MM-DD`. */
  expiration: string
  dte: number
  underlying_price: WireDecimal
}

export interface BktFillRef {
  side: string
  quantity: number
  price: WireDecimal
  notional: WireDecimal
  contract_multiplier: number
  fees?: WireDecimal | null
  /** Signed cash impact: negative for a BUY. */
  cash_effect?: WireDecimal | null
}

/** `ExecutionOutcome` — the response to both the 201 and the 200 replay. */
export interface BktExecutionOutcome {
  execution_id: string
  trade_plan_id: string
  decision_episode_id?: string | null
  status: BktExecutionStatus
  action: BktExecutionAction
  /** Absent on a REJECTED entry that never resolved a contract. */
  contract?: BktContractRef | null
  /** Absent on NO_FILL and REJECTED — there is no fill to describe. */
  fill?: BktFillRef | null
  /** e.g. `SPIKE_NO_FILL`, `ENTRY_PRICE_ABOVE_BAND`. */
  reason_code?: string | null
  /** EXIT rows only — `USER_CLOSE` for a hand close. NULL on every ENTRY. */
  exit_reason?: string | null
  fill_model?: string
  fill_model_config?: Record<string, unknown>
  determinism_hash?: string
  quote_snapshot?: Record<string, unknown> | null
  diagnostics?: Record<string, unknown>
  /** Present only for a FILLED entry that plt accepted. */
  silent_trade_id?: string | null
  reported_to_platform?: boolean
  platform_error?: string | null
  executed_at?: string | null
  business_now?: string | null
  /**
   * True when this response is a replay of a recorded outcome for the same
   * idempotency key — the retry path, not a second execution (D6).
   *
   * **Trust the HTTP status, not this flag, on the exits route.** bkt builds
   * that response with `outcome_from_record(record)`, whose `replayed`
   * parameter defaults to `false`; the 200-vs-201 code is what actually
   * distinguishes a replay there (`create_exit` sets it from
   * `UserExitResult.replayed`).
   */
  replayed?: boolean
}
