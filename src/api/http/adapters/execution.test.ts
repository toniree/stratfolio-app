import { describe, expect, it } from 'vitest'
import {
  MissingContractError,
  entryBand,
  toCreateTradePlanRequest,
  toOrderFromExecution,
  toOrderFromRejection,
} from '@/api/http/adapters/execution'
import { ApiError } from '@/api/http/problem'
import { EXECUTION_MODE, RISK_PROFILE, SIDE } from '@/api/http/policy'
import {
  EXECUTION_FILLED_FIXTURE,
  EXECUTION_NO_FILL_FIXTURE,
  EXECUTION_PLATFORM_ERROR_FIXTURE,
  POLICY_REJECTION_PROBLEM,
} from '@/test/msw/fixtures/plt'
import type { OrderRequest } from '@/api/types'

const REQUEST: OrderRequest = {
  symbol: 'nvda',
  side: 'BUY',
  intent: 'open',
  quantity: 4,
  estimatedPrice: 15.8,
  contract: {
    occSymbol: 'NVDA261218C00190000',
    right: 'CALL',
    strike: 190,
    expiry: '2026-12-18',
    dte: 109,
    mid: 15.8,
    bid: 15.6,
    ask: 16.0,
    underlyingPrice: 178.4,
  },
}

const SUBMITTED_AT = '2026-08-31T15:00:00.000Z'

describe('toCreateTradePlanRequest — D11 pinning', () => {
  const plan = toCreateTradePlanRequest(REQUEST, { asOf: '2026-08-31' })

  it('pins execution_mode, risk_profile and side to constants', () => {
    expect(plan.execution_mode).toBe(EXECUTION_MODE)
    expect(plan.execution_mode).toBe('SILENT')
    expect(plan.risk_profile).toBe(RISK_PROFILE)
    expect(plan.side).toBe(SIDE)
    expect(plan.side).toBe('LONG')
  })

  it('takes contract identity from the chain, verbatim', () => {
    expect(plan.option_type).toBe('CALL')
    expect(plan.strike).toBe(190)
    expect(plan.expiration).toBe('2026-12-18')
    // mnd's day count, not one recomputed from the browser clock.
    expect(plan.dte).toBe(109)
  })

  it('uppercases the ticker and sends the as-of date plt never echoes (§7.9)', () => {
    expect(plan.ticker).toBe('NVDA')
    expect(plan.as_of).toBe('2026-08-31')
  })

  it('allocates enough capital to cover the top of the entry band', () => {
    // Under-allocating is ALLOCATION_BELOW_MAX_ENTRY_COST, a rejection.
    expect(plan.capital_allocation).toBeGreaterThanOrEqual(
      Number(plan.target_entry_max) * plan.quantity * 100,
    )
  })

  it('passes structured exits through as fractions, not percent points (§7.1)', () => {
    const withExits = toCreateTradePlanRequest(
      { ...REQUEST, profitTargetPct: 0.35, stopLossPct: 0.5 },
      { asOf: '2026-08-31' },
    )
    expect(withExits.profit_target_pct).toBe(0.35)
    expect(withExits.stop_loss_pct).toBe(0.5)
  })

  it('omits exits entirely when the caller has none — absent, not zero (§7.2)', () => {
    expect(plan.profit_target_pct).toBeUndefined()
    expect(plan.stop_loss_pct).toBeUndefined()
  })

  it('refuses to build a plan without chain-selected contract identity', () => {
    expect(() => toCreateTradePlanRequest({ ...REQUEST, contract: undefined })).toThrow(
      MissingContractError,
    )
  })
})

describe('entryBand', () => {
  it('brackets the server mid and never goes non-positive', () => {
    expect(entryBand(15.8)).toEqual({ min: 15.01, max: 16.59 })
    expect(entryBand(0.02).min).toBeGreaterThan(0)
  })
})

describe('toOrderFromExecution — the four outcomes', () => {
  it('maps a FILLED outcome with fill money from bkt, not from the estimate', () => {
    const order = toOrderFromExecution(EXECUTION_FILLED_FIXTURE, REQUEST, SUBMITTED_AT)
    expect(order.status).toBe('FILLED')
    // Decimal-as-string on bkt's wire.
    expect(order.price).toBe(15.8)
    expect(order.estimatedValue).toBe(6320)
    expect(order.silentTradeId).toBe(EXECUTION_FILLED_FIXTURE.silent_trade_id)
    // plt recorded it, so order history will show it without our help.
    expect(order.sessionOnly).toBe(false)
    expect(order.submittedAt).toBe('2026-08-31T15:04:05Z')
    expect(order.contractDetail).toBe('$190 Call · 2026-12-18')
  })

  it('treats NO_FILL as a successful outcome with no price and no durable row', () => {
    const order = toOrderFromExecution(EXECUTION_NO_FILL_FIXTURE, REQUEST, SUBMITTED_AT)
    expect(order.status).toBe('NO_FILL')
    // Not zero, not the estimate the ticket showed: nothing filled.
    expect(order.price).toBeUndefined()
    expect(order.estimatedValue).toBeUndefined()
    expect(order.silentTradeId).toBeUndefined()
    expect(order.reasonCode).toBe('ENTRY_PRICE_ABOVE_BAND')
    // No silent-trade row exists and bkt has no list route (HKP-BKT-4).
    expect(order.sessionOnly).toBe(true)
  })

  it('marks a filled-but-unreported execution as recoverable and session-only', () => {
    const order = toOrderFromExecution(EXECUTION_PLATFORM_ERROR_FIXTURE, REQUEST, SUBMITTED_AT)
    expect(order.status).toBe('FILLED')
    expect(order.reportedToPlatform).toBe(false)
    expect(order.platformError).toBe('platform unreachable: connection refused')
    // The trade happened and plt does not know — nothing durable shows it.
    expect(order.sessionOnly).toBe(true)
  })
})

describe('toOrderFromRejection', () => {
  const error = new ApiError({
    message: 'Trade plan rejected by policy',
    status: 422,
    problem: POLICY_REJECTION_PROBLEM,
    url: '/plt/api/v1/trade-plans',
  })

  it('renders rejection reasons verbatim, duplicates included (§7.5)', () => {
    const order = toOrderFromRejection(error, REQUEST, SUBMITTED_AT)
    expect(order.status).toBe('REJECTED')
    expect(order.rejectionReasons).toEqual(['DTE_LT_1', 'DTE_LT_1'])
  })

  it('carries plt’s persisted plan id, so the rejection is durable history', () => {
    const order = toOrderFromRejection(error, REQUEST, SUBMITTED_AT)
    expect(order.tradePlanId).toBe(POLICY_REJECTION_PROBLEM.trade_plan_id)
    expect(order.sessionOnly).toBe(false)
    expect(order.price).toBeUndefined()
  })
})
