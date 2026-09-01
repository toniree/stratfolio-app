import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MockPortfolioApi } from '@/api/mock/MockPortfolioApi'

vi.mock('@/api/mock/latency', () => ({
  latency: () => Promise.resolve(),
}))

describe('MockPortfolioApi', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('creates an idea-derived position in the selected sleeve and survives reload', async () => {
    const api = new MockPortfolioApi()

    const created = await api.addPositionFromIdea('growth', 'idea-tsm-jan', 3)

    expect(created).toMatchObject({
      symbol: 'TSM',
      quantity: 3,
      brokerageId: 'robinhood',
    })
    expect((await api.getPositions('growth')).some((position) => position.id === created.id)).toBe(
      true,
    )
    expect((await api.getPositions('demo')).some((position) => position.id === created.id)).toBe(
      true,
    )

    const reloaded = new MockPortfolioApi()
    await expect(reloaded.getPositions('growth')).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: created.id, quantity: 3 })]),
    )
  })

  it('rejects an unknown idea without changing portfolio membership', async () => {
    const api = new MockPortfolioApi()
    const before = await api.getPositions('demo')

    await expect(api.addPositionFromIdea('demo', 'missing-idea', 1)).rejects.toThrow(
      'Unknown idea: missing-idea',
    )

    expect(await api.getPositions('demo')).toHaveLength(before.length)
  })

  it('applies the option contract multiplier and emits an activity event on submit', async () => {
    const api = new MockPortfolioApi()
    const before = await api.getPositions('demo')
    const optionBefore = before.find((position) => position.id === 'pos-amd-oct')

    const order = await api.submitOrder({
      symbol: 'AMD',
      side: 'BUY',
      quantity: 2,
      estimatedPrice: 6.25,
      brokerageId: 'schwab',
      positionId: 'pos-amd-oct',
    })

    expect(order).toMatchObject({
      company: 'Advanced Micro Devices',
      status: 'SUBMITTED',
      estimatedValue: 1_250,
    })
    expect((await api.getActivity())[0]).toMatchObject({
      kind: 'order',
      symbol: 'AMD',
      title: 'Buy 2 AMD submitted',
    })
    expect((await api.getPositions('demo')).find((position) => position.id === 'pos-amd-oct')).toEqual(
      optionBefore,
    )
  })

  it('returns chart points in chronological order with the current value normalized to one', async () => {
    const api = new MockPortfolioApi()

    const series = await api.getPerformance('demo', '1M')
    const points = series.points

    // The demo series is relative by construction, so the chart may scale it
    // against the live portfolio value. A settled-equity series must not be.
    expect(series.basis).toBe('relative-multiplier')
    expect(series.provenance).toBe('mock')
    expect(points).toHaveLength(66)
    expect(points.at(-1)?.multiplier).toBeCloseTo(1, 12)
    expect(points.every((point, index) => index === 0 || point.time > points[index - 1].time)).toBe(
      true,
    )
  })
})
