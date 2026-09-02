import type {
  ExecutionApprovalMode,
  ExecutionPolicy,
  TradingWindow,
} from '@/api/types'
import type { PltConfigEntry } from '@/api/http/wire/plt'

/**
 * plt `user_config` ⇄ the app's execution-policy view model (contracts §16).
 *
 * Pure, so both halves of the contract are testable against JSON literals: the
 * **array**-not-map shape of `GET /api/v1/config`, and plt's fail-closed
 * resolution, which this mirrors rather than reinvents. Showing a permissive
 * value for a row the enforcer will read as restrictive would be a lie about
 * what the system is about to do.
 */

/** The three keys, spelled exactly as `ExecutionPolicyConfig` spells them.
 *  Renaming one here silently detaches the UI from the enforcement. */
export const POLICY_KEY = {
  aiTradingEnabled: 'policy.ai_trading_enabled',
  approvalMode: 'policy.execution_approval_mode',
  tradingWindow: 'policy.trading_window',
} as const

export type PolicyKey = (typeof POLICY_KEY)[keyof typeof POLICY_KEY]

/**
 * Defaults for a key plt has never been told about.
 *
 * These preserve pre-AI-021 behaviour exactly — an installation that never
 * writes them trades as it always did. Defaulting a missing kill switch to
 * "disabled" would silently stop trading on every deployment that has not set
 * it yet, which §17 rules out in as many words.
 */
export const POLICY_DEFAULTS: Readonly<{
  aiTradingEnabled: boolean
  approvalMode: ExecutionApprovalMode
  tradingWindow: TradingWindow
}> = {
  aiTradingEnabled: true,
  approvalMode: 'auto',
  tradingWindow: 'extended',
}

/** app → wire. The only value whose spelling differs. */
export function approvalModeToWire(mode: ExecutionApprovalMode): string {
  return mode === 'approve' ? 'approve_each' : 'auto'
}

function approvalModeFromWire(value: unknown): ExecutionApprovalMode | undefined {
  if (value === 'approve_each') return 'approve'
  if (value === 'auto') return 'auto'
  return undefined
}

function tradingWindowFromWire(value: unknown): TradingWindow | undefined {
  return value === 'rth' || value === 'extended' ? value : undefined
}

/**
 * Resolve the policy from `GET /api/v1/config`'s **array** of entries.
 *
 * Three states per key, and they are not the same state:
 *  - **absent** → the backend default (recorded in `unsetKeys`);
 *  - **present and parseable** → that value;
 *  - **present and unparseable** → the most restrictive setting, recorded in
 *    `invalidKeys`. plt resolves this way and so must the screen that claims to
 *    show it.
 *
 * Note one deliberate asymmetry the app inherits rather than papering over:
 * plt and service-ai read the kill switch as a **JSON boolean only**, while
 * bkt's entry gate additionally accepts the strings `"true"` / `"false"`. The
 * app resolves like plt — the stricter of the two — because that is the reader
 * that decides whether a cycle runs at all. The app itself only ever writes a
 * real boolean, so it cannot create the divergent state.
 */
export function toExecutionPolicy(entries: PltConfigEntry[]): ExecutionPolicy {
  const byKey = new Map(entries.map((entry) => [entry.key, entry.value]))
  const unsetKeys: string[] = []
  const invalidKeys: string[] = []

  const resolve = <T,>(key: PolicyKey, parse: (raw: unknown) => T | undefined, fallback: T, closed: T): T => {
    if (!byKey.has(key)) {
      unsetKeys.push(key)
      return fallback
    }
    const parsed = parse(byKey.get(key))
    if (parsed === undefined) {
      invalidKeys.push(key)
      return closed
    }
    return parsed
  }

  return {
    aiTradingEnabled: resolve(
      POLICY_KEY.aiTradingEnabled,
      (raw) => (typeof raw === 'boolean' ? raw : undefined),
      POLICY_DEFAULTS.aiTradingEnabled,
      // Fail closed: a switch nobody can parse is not a switch that is on.
      false,
    ),
    approvalMode: resolve(
      POLICY_KEY.approvalMode,
      approvalModeFromWire,
      POLICY_DEFAULTS.approvalMode,
      'approve',
    ),
    tradingWindow: resolve(
      POLICY_KEY.tradingWindow,
      tradingWindowFromWire,
      POLICY_DEFAULTS.tradingWindow,
      'rth',
    ),
    unsetKeys,
    invalidKeys,
  }
}

/** The single entry a PUT writes back, for the optimistic update to apply. */
export function policyWithKey(
  policy: ExecutionPolicy,
  change: Partial<Pick<ExecutionPolicy, 'aiTradingEnabled' | 'approvalMode' | 'tradingWindow'>>,
): ExecutionPolicy {
  const changedKeys = [
    change.aiTradingEnabled === undefined ? undefined : POLICY_KEY.aiTradingEnabled,
    change.approvalMode === undefined ? undefined : POLICY_KEY.approvalMode,
    change.tradingWindow === undefined ? undefined : POLICY_KEY.tradingWindow,
  ].filter((key): key is PolicyKey => key !== undefined)

  return {
    ...policy,
    ...change,
    // A key the user just wrote is neither unset nor invalid any more — and
    // if the write is refused, the rollback restores the whole snapshot.
    unsetKeys: policy.unsetKeys.filter((key) => !changedKeys.includes(key as PolicyKey)),
    invalidKeys: policy.invalidKeys.filter((key) => !changedKeys.includes(key as PolicyKey)),
  }
}
