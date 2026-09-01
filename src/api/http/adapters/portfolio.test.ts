import { describe, expect, it } from 'vitest'
import {
  contractDetail,
  expiryLabel,
  mergeOrders,
  toAccount,
  toActivityEvent,
  toMeta,
  toPosition,
  toSettledEquitySeries,
} from '@/api/http/adapters/portfolio'
import type { PltActivity, PltSilentTrade, PltTradePlan } from '@/api/http/wire/plt'
import {
  ACTIVITY_FIXTURE,
  PORTFOLIO_FIXTURE,
  POSITION_NO_EPISODE_FIXTURE,
  POSITION_OPEN_FIXTURE,
  SILENT_TRADE_CLOSED_FIXTURE,
  SILENT_TRADE_OPEN_FIXTURE,
  TRADE_PLAN_LEGACY_FIXTURE,
  TRADE_PLAN_REJECTED_FIXTURE,
  TRADE_PLAN_VALIDATED_FIXTURE,
} from '@/test/msw/fixtures/plt'

describe('portfolio adapter', () => {
  describe('account & meta', () => {
    it('produces exactly one paper account carrying plt’s own account key', () => {
      const account = toAccount(PORTFOLIO_FIXTURE)
      // There is no multi-account or brokerage model (HKP-PLT-6).
      expect(account.accountKey).toBe('paper-default')
      expect(account.isDemo).toBe(false)
      expect(account.provenance).toBe('live')
    })

    it('maps cash and cost basis to the fields the hero reads', () => {
      const meta = toMeta(PORTFOLIO_FIXTURE)
      expect(meta.cash).toBe(74250.5)
      // No margin model in a paper book: cash is buying power.
      expect(meta.buyingPower).toBe(74250.5)
      expect(meta.totalDeposited).toBe(25749.5)
    })
  })

  describe('positions', () => {
    const position = toPosition(POSITION_OPEN_FIXTURE)

    it('derives the contract from occ fields rather than parsing the OCC string', () => {
      expect(position.option).toEqual({
        right: 'CALL',
        strike: 150,
        expiry: '2027-01-15',
        expiryLabel: "Jan 15 '27",
      })
      expect(position.contractDetail).toBe("$150 Call · Jan 15 '27")
      // No `extrinsicBase`: real time value is a Wave-B0 chain field, and
      // guessing it in the browser is the IV fabrication §6 removes.
      expect(position.option?.extrinsicBase).toBeUndefined()
    })

    it('§7.2 — leaves an unmarked position without a mark, not at zero', () => {
      // plt writes marks only at entry and close, so `last_price`,
      // `market_value` and `unrealized_pnl` are omitted from the JSON.
      expect(position.lastPrice).toBeUndefined()
      expect(position.unrealizedPnl).toBeUndefined()
      // And specifically not entry price echoed back as a flat mark.
      expect(position.lastPrice).not.toBe(position.avgCost)
    })

    it('carries no company name and no brokerage', () => {
      // No live-safe symbol→name source (HKP-MND-4); one paper portfolio, no
      // linked accounts (HKP-PLT-6).
      expect(position.company).toBeUndefined()
      expect(position.brokerageId).toBeUndefined()
    })

    it('attaches no AI assessment even when a decision episode is recorded', () => {
      // plt stores the episode *id*; service-ai exposes no episode read API
      // (HKP-AI-1). An id is not an assessment.
      expect(POSITION_OPEN_FIXTURE.decision_episode_id).toBeDefined()
      expect(position.ai).toBeUndefined()
      expect(toPosition(POSITION_NO_EPISODE_FIXTURE).ai).toBeUndefined()
    })

    it('keeps quantity, entry price and open time verbatim', () => {
      expect(position.quantity).toBe(3)
      expect(position.avgCost).toBe(16.2)
      expect(position.openedAt).toBe('2026-08-24T13:45:02Z')
      expect(position.openingSide).toBe('BUY_TO_OPEN')
    })

    it('throws instead of defaulting when a required field is missing', () => {
      const broken = { ...POSITION_OPEN_FIXTURE, entry_price: undefined }
      expect(() => toPosition(broken as never)).toThrow(/entry_price/)
    })
  })

  describe('expiry formatting', () => {
    it.each([
      ['2027-01-15', "Jan 15 '27"],
      ['2026-09-18', "Sep 18 '26"],
      ['2026-11-20', "Nov 20 '26"],
    ])('formats %s as %s', (iso, expected) => {
      expect(expiryLabel(iso)).toBe(expected)
    })

    it('builds a contract label from the parts, not a stored string', () => {
      expect(
        contractDetail({ right: 'PUT', strike: 195, expiry: '2026-11-20', expiryLabel: "Nov 20 '26" }),
      ).toBe("$195 Put · Nov 20 '26")
    })
  })

  describe('§7.10 — activity', () => {
    const events = ACTIVITY_FIXTURE.map((row) => toActivityEvent(row as PltActivity))

    it('reads the wire field `action_type` and maps it to an app kind', () => {
      expect(events[0].kind).toBe('order')
      expect(events[0].title).toBe('Trade plan validated')
      expect(events[1].kind).toBe('order')
      expect(events[2].kind).toBe('alert')
    })

    it('falls back to `other` for an action type the app does not know', () => {
      // plt's roster grows independently; a dropped row is a hole in an audit
      // trail, so an unknown type still renders.
      const event = toActivityEvent({
        id: 'x',
        ts: '2026-08-31T00:00:00Z',
        action_type: 'SOME_FUTURE_PLT_EVENT',
        entity_type: 'thing',
      })
      expect(event.kind).toBe('other')
      expect(event.title).toBe('some future plt event')
    })

    it('leaves detail absent for a payload-less row instead of empty-stringing it', () => {
      const noPayload = events[3]
      expect(noPayload.detail).toBeUndefined()
      expect(noPayload.symbol).toBeUndefined()
    })

    it('lifts a ticker out of the payload when the row has one', () => {
      expect(events[1].symbol).toBe('MU')
      expect(events[2].symbol).toBe('ARKK')
    })
  })

  describe('settled-equity curve', () => {
    it('accumulates realised P&L oldest-first from a newest-first list', () => {
      const older: PltSilentTrade = {
        ...SILENT_TRADE_CLOSED_FIXTURE,
        id: 'older',
        exit_ts: '2026-06-01T00:00:00Z',
        realized_pnl: -120,
      }
      const series = toSettledEquitySeries(
        [SILENT_TRADE_CLOSED_FIXTURE, older] as PltSilentTrade[],
        { startingCapital: 100_000 },
      )
      expect(series.basis).toBe('settled-equity')
      expect(series.points.map((p) => p.value)).toEqual([99_880, 100_200])
      expect(series.points[0].time).toBeLessThan(series.points[1].time)
    })

    it('excludes still-open trades — they have not settled anything', () => {
      const series = toSettledEquitySeries([
        SILENT_TRADE_OPEN_FIXTURE,
        SILENT_TRADE_CLOSED_FIXTURE,
      ] as PltSilentTrade[])
      expect(series.points).toHaveLength(1)
    })

    it('carries absolute dollars so the chart never scales it by the live book', () => {
      // Blending a settled curve with the marked portfolio value double-counts
      // (plan §3.1 — one equity basis per chart).
      const series = toSettledEquitySeries([SILENT_TRADE_CLOSED_FIXTURE] as PltSilentTrade[], {
        startingCapital: 100_000,
      })
      expect(series.points[0].value).toBe(100_320)
    })

    it('§7.11 — labels the 500-row cap when history is truncated', () => {
      const truncated = toSettledEquitySeries([SILENT_TRADE_CLOSED_FIXTURE] as PltSilentTrade[], {
        truncated: true,
      })
      expect(truncated.truncated).toBe(true)
      expect(truncated.label).toMatch(/500 closed trades/)
    })
  })

  describe('order merge (§3.1)', () => {
    const orders = mergeOrders({
      silentTrades: [SILENT_TRADE_OPEN_FIXTURE, SILENT_TRADE_CLOSED_FIXTURE] as PltSilentTrade[],
      tradePlans: [
        TRADE_PLAN_VALIDATED_FIXTURE,
        TRADE_PLAN_REJECTED_FIXTURE,
        TRADE_PLAN_LEGACY_FIXTURE,
      ] as PltTradePlan[],
    })

    it('emits an entry row per silent trade and an extra exit row once closed', () => {
      const ids = orders.map((o) => o.id)
      expect(ids).toContain(`trade-${SILENT_TRADE_OPEN_FIXTURE.id}-entry`)
      expect(ids).toContain(`trade-${SILENT_TRADE_CLOSED_FIXTURE.id}-entry`)
      expect(ids).toContain(`trade-${SILENT_TRADE_CLOSED_FIXTURE.id}-exit`)
      const exit = orders.find((o) => o.id.endsWith('-exit'))
      expect(exit?.side).toBe('SELL')
      expect(exit?.price).toBe(8.7)
      expect(exit?.estimatedValue).toBe(8.7 * 2 * 100)
    })

    it('shows a validated-but-unfilled plan as a pending intent', () => {
      const pending = orders.find((o) => o.id === `plan-${TRADE_PLAN_VALIDATED_FIXTURE.id}`)
      expect(pending?.status).toBe('SUBMITTED')
      // Midpoint of the *target entry band*, which is a limit, not a fill.
      expect(pending?.price).toBeCloseTo(15.75, 10)
      expect(pending?.estimatedValue).toBe(6400)
    })

    it('§7.5 — shows rejection reasons verbatim, duplicates included', () => {
      const rejected = orders.find((o) => o.id === `plan-${TRADE_PLAN_REJECTED_FIXTURE.id}`)
      expect(rejected?.status).toBe('REJECTED')
      expect(rejected?.rejectionReasons).toEqual(['DTE_LT_1', 'DTE_LT_1', 'INSUFFICIENT_CASH'])
    })

    it('does not show an executed plan twice — the fill is the better record', () => {
      // The MU plan produced SILENT_TRADE_OPEN_FIXTURE.
      expect(orders.filter((o) => o.tradePlanId === SILENT_TRADE_OPEN_FIXTURE.trade_plan_id))
        .toHaveLength(1)
      // And an EXECUTED plan is never a pending intent in its own right.
      expect(orders.find((o) => o.id === `plan-${TRADE_PLAN_LEGACY_FIXTURE.id}`)).toBeUndefined()
    })

    it('§7.8 — retains a NO_FILL outcome that left no silent-trade row', () => {
      const merged = mergeOrders({
        silentTrades: [],
        tradePlans: [],
        sessionOutcomes: [
          {
            id: 'exec-1',
            symbol: 'NVDA',
            side: 'BUY',
            quantity: 4,
            status: 'NO_FILL',
            submittedAt: '2026-08-31T18:00:00Z',
            reportedToPlatform: true,
            provenance: 'live',
          },
        ],
      })
      // bkt returns 201 for NO_FILL and writes nothing to plt; without the
      // session retainer this attempt would vanish (HKP-BKT-4).
      expect(merged).toHaveLength(1)
      expect(merged[0].status).toBe('NO_FILL')
      // No fabricated fill price on something that did not fill.
      expect(merged[0].price).toBeUndefined()
    })

    it('sorts newest first across all three sources', () => {
      const times = orders.map((o) => new Date(o.submittedAt).getTime())
      expect(times).toEqual([...times].sort((a, b) => b - a))
    })
  })
})
