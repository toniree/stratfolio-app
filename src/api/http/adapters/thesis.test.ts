import { describe, expect, it } from 'vitest'
import { sortThesesNewestFirst, toEvidenceEntries, toThesisView } from '@/api/http/adapters/thesis'
import { THESES_FIXTURE, THESIS_FIXTURE, THESIS_SPARSE_FIXTURE } from '@/test/msw/fixtures/plt'
import type { ThesisView } from '@/api/types'

describe('toThesisView — field pinning', () => {
  const view = toThesisView(THESIS_FIXTURE)

  it('maps every field plt records, and only those', () => {
    // The pin: this list is exactly `ThesisResponse`'s renderable surface plus
    // `provenance`. A field appearing here that plt does not send is a
    // fabrication; one missing is data silently dropped from the UI.
    expect(Object.keys(view).sort()).toEqual(
      [
        'confidence',
        'createdAt',
        'direction',
        'episodeId',
        'evidence',
        'expectedCatalyst',
        'horizon',
        'id',
        'invalidationConditions',
        'modelVersion',
        'promptVersion',
        'provenance',
        'rationale',
        'source',
        'strategyVersion',
        'symbol',
      ].sort(),
    )
  })

  it('never invents a price, target, recommendation or upside', () => {
    // The five numbers the demo `Idea` carries and plt has no field for.
    for (const key of [
      'referencePrice',
      'entryLow',
      'entryHigh',
      'targetLow',
      'targetHigh',
      'expectedUpsidePct',
      'recommendation',
      'ai',
      'idea',
    ]) {
      expect(view as unknown as Record<string, unknown>).not.toHaveProperty(key)
    }
  })

  it('keeps confidence as the 0..1 fraction plt sent (§7.4)', () => {
    // The wire value, untouched. The ×100 lives at render (`formatConfidence`)
    // and in `convictionFromConfidence()` — nowhere else.
    expect(THESIS_FIXTURE.confidence).toBe(0.72)
    expect(view.confidence).toBe(0.72)
  })

  it('keeps the ISO-8601 horizon verbatim rather than rewriting it', () => {
    expect(view.horizon).toBe('P14D')
  })

  it('normalises the ticker and lower-cases the source enum', () => {
    expect(THESIS_FIXTURE.ticker).toBe('nvda')
    expect(view.symbol).toBe('NVDA')
    expect(view.source).toBe('ai')
    expect(toThesisView(THESIS_SPARSE_FIXTURE).source).toBe('user')
  })

  it('claims live provenance', () => {
    expect(view.provenance).toBe('live')
  })

  it('leaves omitted fields undefined rather than defaulting them (§7.2)', () => {
    const sparse = toThesisView(THESIS_SPARSE_FIXTURE)
    expect(sparse.confidence).toBeUndefined()
    expect(sparse.evidence).toBeUndefined()
    expect(sparse.invalidationConditions).toBeUndefined()
    expect(sparse.expectedCatalyst).toBeUndefined()
    expect(sparse.horizon).toBeUndefined()
    expect(sparse.episodeId).toBeUndefined()
    // Not 0, not "", not "unknown".
    expect(sparse.direction).toBe('BEARISH')
  })

  it('throws rather than substituting a blank for a required field', () => {
    expect(() => toThesisView({ ...THESIS_FIXTURE, rationale: '   ' })).toThrow(/rationale/)
  })
})

describe('toEvidenceEntries', () => {
  it('renders one row per top-level key, in wire order, skipping plumbing', () => {
    const entries = toEvidenceEntries(THESIS_FIXTURE.evidence)!
    expect(entries.map((e) => e.label)).toEqual([
      'Iv rank',
      'Earnings date',
      'Analyst Revisions',
      'Passes screen',
      'Peers',
    ])
    expect(entries[0].value).toBe('41.2')
    expect(entries[3].value).toBe('yes')
    // Nested structures are shown compactly, never reinterpreted.
    expect(entries[4].value).toBe('["AMD","AVGO"]')
  })

  it('is undefined for an absent or empty blob — not an empty section', () => {
    expect(toEvidenceEntries(undefined)).toBeUndefined()
    expect(toEvidenceEntries({})).toBeUndefined()
    expect(toEvidenceEntries({ note: null, other: undefined })).toBeUndefined()
  })
})

describe('sortThesesNewestFirst', () => {
  it('orders by created_at descending', () => {
    const sorted = sortThesesNewestFirst(THESES_FIXTURE.map(toThesisView))
    expect(sorted.map((t: ThesisView) => t.symbol)).toEqual(['COIN', 'NVDA'])
  })
})
