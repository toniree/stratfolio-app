/**
 * RFC 7807 `application/problem+json` — the error shape every StratFolio
 * service emits (`GlobalExceptionHandler` in plt, `writeProblem` in mnd).
 *
 * The extension members are not decoration: `rejection_reasons` is the
 * PolicyGate verdict the ticket must render verbatim (codes may repeat, §7.5)
 * and `decision_episode_id` is the correlation id echoed on every error when
 * the request carried one.
 */
export interface ProblemDetailBody {
  type?: string
  title?: string
  status?: number
  detail?: string
  instance?: string
  /** e.g. `DTE_LT_1`, `INSUFFICIENT_CASH`. May contain duplicates. */
  rejection_reasons?: string[]
  /** `PolicyViolation.asMap()` rows: `{ code, field?, message }`. */
  errors?: { code?: string; field?: string; message?: string }[]
  decision_episode_id?: string
  trade_plan_id?: string
  status_of_record?: string
  existing_id?: string
  idempotency_key?: string
  symbol?: string
  [key: string]: unknown
}

/**
 * A failed backend call.
 *
 * Deliberately not a bare `Error`: the UI has to distinguish "the network
 * blipped, retry with the same idempotency key" from "PolicyGate refused this
 * plan, show the reasons and mint a new key on try-again" (D6).
 */
export class ApiError extends Error {
  readonly status: number
  readonly problem: ProblemDetailBody
  readonly url: string
  /** No HTTP response at all — DNS, offline, abort, CORS. Safe to retry with
   *  the same idempotency key, because the server may or may not have acted. */
  readonly isNetworkError: boolean

  constructor(args: {
    message: string
    status: number
    problem?: ProblemDetailBody
    url: string
    isNetworkError?: boolean
    cause?: unknown
  }) {
    super(args.message, args.cause === undefined ? undefined : { cause: args.cause })
    this.name = 'ApiError'
    this.status = args.status
    this.problem = args.problem ?? {}
    this.url = args.url
    this.isNetworkError = args.isNetworkError ?? false
  }

  /** Problem slug, e.g. `policy-rejection` from
   *  `https://stratfolio.local/problems/policy-rejection`. */
  get kind(): string | undefined {
    const type = this.problem.type
    if (!type) return undefined
    const slug = type.split('/').filter(Boolean).pop()
    return slug && slug !== 'about:blank' ? slug : undefined
  }

  /** PolicyGate / universe rejection codes, verbatim and in wire order. */
  get rejectionReasons(): string[] {
    return Array.isArray(this.problem.rejection_reasons) ? this.problem.rejection_reasons : []
  }

  get isRejection(): boolean {
    return this.status === 422
  }

  get isConflict(): boolean {
    return this.status === 409
  }

  /** True when retrying the *same* logical operation could plausibly succeed.
   *  A 422 policy rejection is not retryable — the plan itself is refused. */
  get isRetryable(): boolean {
    return this.isNetworkError || this.status === 0 || this.status === 429 || this.status >= 500
  }
}

/** Best-effort human string, preferring the server's own words. */
export function problemMessage(problem: ProblemDetailBody, fallback: string): string {
  if (typeof problem.detail === 'string' && problem.detail.length > 0) return problem.detail
  if (typeof problem.title === 'string' && problem.title.length > 0) return problem.title
  return fallback
}

export function isProblemBody(value: unknown): value is ProblemDetailBody {
  return typeof value === 'object' && value !== null
}
