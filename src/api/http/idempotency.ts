/**
 * Idempotency keys (D6).
 *
 * The rule that matters and is easy to get wrong: a key identifies a *logical
 * operation*, not a request.
 *
 * - A timeout or network blip while submitting is the *same* operation. Retry
 *   with the same key; plt replays the recorded response (200 + `Location`
 *   instead of 201) and bkt replays the recorded execution outcome.
 * - A user pressing "try again" after seeing a returned `NO_FILL` or
 *   `REJECTED` is a *new* operation and must mint a new key. Reusing the old
 *   one would replay the failure forever.
 *
 * Endpoint placement differs per service and is not negotiable: plt takes
 * `Idempotency-Key` as a **header** (max 128 chars, `SilentTradeController` /
 * `TradePlanController` / `ThesisController`); bkt takes `idempotency_key` in
 * the request **body**.
 */

export const IDEMPOTENCY_HEADER = 'Idempotency-Key'
/** plt caps the header at 128 characters (`@Size(max = 128)`). */
export const IDEMPOTENCY_KEY_MAX = 128

/** Correlation header read by plt's `StratfolioContextFilter`. Must parse as a
 *  UUID or the filter short-circuits with a 400 before any controller runs. */
export const DECISION_EPISODE_HEADER = 'X-Decision-Episode-Id'

function randomId(): string {
  const crypto = globalThis.crypto
  if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  if (crypto && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  }
  /* c8 ignore next */
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

/**
 * Mint a key for a brand-new logical operation.
 *
 * `scope` is a short human-readable prefix (`open`, `close`, `plan`) that makes
 * server-side audit rows legible; it carries no semantics.
 */
export function newIdempotencyKey(scope: string): string {
  const key = `${scope}-${randomId()}`
  return key.length > IDEMPOTENCY_KEY_MAX ? key.slice(0, IDEMPOTENCY_KEY_MAX) : key
}

/**
 * A per-session store keyed by a caller-chosen logical-operation id.
 *
 * The point is that a component re-render, a React Query retry, or a user
 * double-tap all resolve to the same key, while an explicit
 * `retireOperation()` after a returned NO_FILL/REJECTED forces the next
 * attempt to mint a fresh one.
 */
export class IdempotencyKeyStore {
  private readonly keys = new Map<string, string>()

  /** The key for this logical operation, minting one on first call. */
  keyFor(operationId: string, scope = 'op'): string {
    const existing = this.keys.get(operationId)
    if (existing) return existing
    const minted = newIdempotencyKey(scope)
    this.keys.set(operationId, minted)
    return minted
  }

  /**
   * Drop the recorded key so the next `keyFor()` starts a new operation.
   *
   * Call this — and only this — when the user deliberately re-attempts after a
   * *returned outcome* (NO_FILL, REJECTED). Never call it on a network error:
   * that is the same operation and must reuse its key.
   */
  retireOperation(operationId: string): void {
    this.keys.delete(operationId)
  }

  has(operationId: string): boolean {
    return this.keys.has(operationId)
  }

  clear(): void {
    this.keys.clear()
  }
}

export const idempotencyKeys = new IdempotencyKeyStore()
