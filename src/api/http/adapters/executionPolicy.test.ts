import { describe, expect, it } from 'vitest'
import {
  POLICY_KEY,
  approvalModeToWire,
  policyWithKey,
  toExecutionPolicy,
} from '@/api/http/adapters/executionPolicy'
import type { PltConfigEntry } from '@/api/http/wire/plt'

const entry = (key: string, value: unknown): PltConfigEntry => ({
  key,
  value,
  value_type: typeof value,
  updated_at: '2026-08-31T12:00:00Z',
})

describe('toExecutionPolicy', () => {
  it('reads plt’s ARRAY of entries, not a keyed map', () => {
    const policy = toExecutionPolicy([
      entry('policy.max_portfolio_allocation_pct', 20),
      entry(POLICY_KEY.aiTradingEnabled, false),
      entry(POLICY_KEY.approvalMode, 'approve_each'),
      entry(POLICY_KEY.tradingWindow, 'rth'),
    ])
    expect(policy.aiTradingEnabled).toBe(false)
    // `approve_each` on the wire is `approve` in the app — the one word that
    // differs between the two vocabularies.
    expect(policy.approvalMode).toBe('approve')
    expect(policy.tradingWindow).toBe('rth')
    expect(policy.unsetKeys).toEqual([])
    expect(policy.invalidKeys).toEqual([])
  })

  it('resolves an absent key to the backend default, not to "off"', () => {
    const policy = toExecutionPolicy([])
    // §16: defaults preserve pre-AI-021 behaviour exactly. Defaulting a
    // missing kill switch to disabled would stop trading on every deployment
    // that has never set it.
    expect(policy.aiTradingEnabled).toBe(true)
    expect(policy.approvalMode).toBe('auto')
    expect(policy.tradingWindow).toBe('extended')
    expect(policy.unsetKeys).toHaveLength(3)
    expect(policy.invalidKeys).toEqual([])
  })

  it('fails closed on a stored value it cannot parse, exactly as plt does', () => {
    const policy = toExecutionPolicy([
      // Reachable only by writing the table directly — the PUT path validates.
      // plt reads the kill switch as a JSON boolean only, so the string "true"
      // is unparseable and resolves to disabled, never to the permissive
      // default.
      entry(POLICY_KEY.aiTradingEnabled, 'true'),
      entry(POLICY_KEY.approvalMode, 'whenever'),
      entry(POLICY_KEY.tradingWindow, 42),
    ])
    expect(policy.aiTradingEnabled).toBe(false)
    expect(policy.approvalMode).toBe('approve')
    expect(policy.tradingWindow).toBe('rth')
    expect(policy.invalidKeys).toEqual([
      POLICY_KEY.aiTradingEnabled,
      POLICY_KEY.approvalMode,
      POLICY_KEY.tradingWindow,
    ])
    expect(policy.unsetKeys).toEqual([])
  })
})

describe('approvalModeToWire', () => {
  it('maps the app’s word to plt’s', () => {
    expect(approvalModeToWire('approve')).toBe('approve_each')
    expect(approvalModeToWire('auto')).toBe('auto')
  })
})

describe('policyWithKey — the optimistic update', () => {
  it('applies the change and clears that key’s unset/invalid marks', () => {
    const before = toExecutionPolicy([])
    const after = policyWithKey(before, { aiTradingEnabled: false })
    expect(after.aiTradingEnabled).toBe(false)
    expect(after.unsetKeys).not.toContain(POLICY_KEY.aiTradingEnabled)
    // The other two keys are still unset; only the written one moved.
    expect(after.unsetKeys).toHaveLength(2)
    // …and the snapshot the caller rolls back to is untouched.
    expect(before.aiTradingEnabled).toBe(true)
  })
})
