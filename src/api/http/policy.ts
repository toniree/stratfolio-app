/**
 * The policy inputs the ticket is allowed to send — **constants, never UI
 * state** (D11).
 *
 * `execution_mode` and `risk_profile` are plain strings on plt's wire, not Java
 * enums, precisely so an out-of-policy value comes back as a 422 with reasons
 * instead of a 400. That is exactly why they must be pinned here: a value
 * derived from a form field, a preference, or free text is one refactor away
 * from becoming the string that asks a backend to do something other than
 * silent paper execution.
 *
 * These mirror `stratfolio.policy.*` in plt's `application.yml`, which
 * `PolicyGate` compares case-insensitively. plt remains the authority — a
 * per-user `user_config` row can tighten any of them — so nothing here is used
 * to *approve* a trade locally; the caps below only let the ticket warn before
 * spending a round trip on a plan PolicyGate will refuse.
 */

/** V1's product invariant, in one string. Silent/paper execution only. */
export const EXECUTION_MODE = 'SILENT' as const

/** The single risk profile plt accepts today (`allowed-risk-profiles`). */
export const RISK_PROFILE = 'HIGH_REWARD_HIGH_RISK' as const

/** The allowlist, kept explicit so adding a profile is a deliberate edit that
 *  has to be matched on the backend rather than a string typed into a form. */
export const ALLOWED_RISK_PROFILES: readonly string[] = [RISK_PROFILE]

/** `allowed-sides` — long premium only. There is no short-option path. */
export const SIDE = 'LONG' as const

export const ALLOWED_OPTION_TYPES = ['CALL', 'PUT'] as const
export type AllowedOptionType = (typeof ALLOWED_OPTION_TYPES)[number]

/** `min-dte`: an expiring-today contract is not tradeable under the invariant. */
export const MIN_DTE = 1

/** Advisory caps mirroring plt's defaults. Used only to warn in the ticket;
 *  PolicyGate is what actually enforces them, on its own configuration. */
export const ADVISORY_CAPS = {
  maxContractsPerTrade: 20,
  maxCapitalPerTrade: 2500,
} as const

/** plt's `policy_version` at the time these were pinned, for audit copy. */
export const POLICY_VERSION = 'policygate-v1'

export function isAllowedRiskProfile(value: string): boolean {
  return ALLOWED_RISK_PROFILES.includes(value.toUpperCase())
}
