import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The D4 import boundary, enforced twice on purpose.
 *
 * `.oxlintrc.json` carries a `no-restricted-imports` override for
 * `src/api/http/**`, but lint is a separate command that a wave proof can skip
 * and a contributor can `--fix`-around. This test runs in the same suite as the
 * adapters it protects, so the rule cannot be silently lost.
 *
 * What it forbids: a live HTTP adapter reaching into demo fixtures
 * (`seededData`, `seededOptionsBook`, `EXAMPLE_ORDERS`,
 * `REQUIRED_DEMO_PLAN_IDS`), the in-browser price simulator, or a PRNG. Any of
 * those turns "the backend cannot serve this" into invented data presented as
 * real, which is the failure mode the whole hookup plan exists to prevent.
 */

const HTTP_DIR = join(import.meta.dirname)

/**
 * The live quote provider lives outside `src/api/http/**` — it is a source, not
 * an adapter — but it is live code on exactly the same footing, and the
 * simulator it replaces sits in the very same directory. It is guarded here
 * too, so a stray `import { SYMBOLS }` cannot creep in from next door.
 */
const EXTRA_LIVE_SOURCES = [join(HTTP_DIR, '..', 'marketData', 'PollingQuoteProvider.ts')]

const FORBIDDEN: { pattern: RegExp; why: string }[] = [
  { pattern: /['"][^'"]*api\/mock\//, why: 'demo fixtures (src/api/mock/**)' },
  { pattern: /\bseededData\b/, why: 'seededData' },
  { pattern: /\bseededOptionsBook\b/, why: 'seededOptionsBook' },
  { pattern: /\bseededNews\b/, why: 'seededNews' },
  { pattern: /\bEXAMPLE_ORDERS\b/, why: 'EXAMPLE_ORDERS' },
  { pattern: /\bREQUIRED_DEMO_PLAN_IDS\b/, why: 'REQUIRED_DEMO_PLAN_IDS' },
  { pattern: /['"][^'"]*MarketDataSimulator/, why: 'MarketDataSimulator' },
  { pattern: /['"][^'"]*lib\/prng['"]/, why: 'lib/prng' },
  { pattern: /\bmulberry32\b|\bgaussian\(/, why: 'a PRNG' },
]

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full))
      continue
    }
    // Test files legitimately build fixtures; the boundary is about shipped code.
    if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

describe('D4 import boundary', () => {
  const files = [...sourceFiles(HTTP_DIR), ...EXTRA_LIVE_SOURCES]

  it('finds the adapter sources it is meant to guard', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files)('%s imports no demo fixtures, simulator or PRNG', (file) => {
    const source = readFileSync(file, 'utf8')
    for (const { pattern, why } of FORBIDDEN) {
      expect(
        pattern.test(source),
        `${file} references ${why}; live adapters must not fabricate data (D4)`,
      ).toBe(false)
    }
  })
})
