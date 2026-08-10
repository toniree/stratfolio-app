import { describe, expect, it } from 'vitest'
import type { PlannerIdea } from '@/api/newsTypes'
import { sortPlansByTriggerSoon, triggerSoonPercent } from '@/lib/plannerSort'

function plan(id: string, status: PlannerIdea['status'], conviction?: number): PlannerIdea {
  return {
    id,
    status,
    source: conviction ? 'ai' : 'user',
    createdAt: '2026-08-08T00:00:00.000Z',
    ai: conviction ? ({ conviction } as PlannerIdea['ai']) : undefined,
  } as PlannerIdea
}

describe('planner trigger-soon sorting', () => {
  it('prioritizes readiness and conviction without mutating the source list', () => {
    const source = [plan('draft', 'draft', 50), plan('ready', 'ready', 90), plan('watching', 'watching', 80)]

    const sorted = sortPlansByTriggerSoon(source)

    expect(sorted.map((item) => item.id)).toEqual(['ready', 'watching', 'draft'])
    expect(source.map((item) => item.id)).toEqual(['draft', 'ready', 'watching'])
    expect(triggerSoonPercent(sorted[0])).toMatch(/^\d+%$/)
  })
})
