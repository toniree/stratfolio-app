import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { hasLiveDomain } from '@/api/http/env'

/**
 * Fabrication containment (plan §6), as an executable checklist.
 *
 * These are grep-shaped assertions on purpose. The things they guard are not
 * type errors and not runtime failures — they are code and copy that *works*
 * and lies, which is exactly the class of bug a compiler cannot catch and a
 * reviewer stops noticing after the third read.
 */

const SRC = join(import.meta.dirname, '..')

function sourceFiles(dir: string, filter: (path: string) => boolean = () => true): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full, filter))
      continue
    }
    if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) && filter(full)) out.push(full)
  }
  return out
}

const ALL = sourceFiles(SRC)
const read = (path: string) => readFileSync(path, 'utf8')
const rel = (path: string) => relative(SRC, path)

/**
 * Source with comments removed.
 *
 * The copy assertions below have to scan what a user can *see*, and these
 * files are heavily commented with the very phrases being banned — the
 * comments explain why the copy was removed. Scanning raw source would make
 * every explanation a violation.
 */
function code(path: string): string {
  return read(path)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

describe('§6 — removed from live views', () => {
  it('no coin-flip criteria: nothing derives a met/unmet state from a PRNG', () => {
    // Nothing in the backend evaluates entry criteria (HKP-XSV-1), so a
    // "met" state can only be recorded or unknown — never rolled.
    for (const file of ALL) {
      const source = read(file)
      if (!/mulberry32|Math\.random/.test(source)) continue
      expect(
        /\b(met|state)\s*:\s*(rand\(\)|Math\.random\(\))/.test(source),
        `${rel(file)} decides a criterion state with a PRNG`,
      ).toBe(false)
    }
  })

  it('no hard-coded order fixtures in shipped chrome', () => {
    // The header used to render four invented option orders on every screen.
    for (const file of ALL) {
      expect(read(file), `${rel(file)} still declares EXAMPLE_ORDERS`).not.toMatch(
        /EXAMPLE_ORDERS/,
      )
    }
  })

  it('no synthesized order ids or fill quality outside a mock-gated branch', () => {
    const source = read(join(SRC, 'lib/positionEvents.ts'))
    // The synthetic markers still exist for the demo book, but every one of
    // them is behind the `synthetic` gate.
    expect(source).toMatch(/const synthetic =/)
    expect(source).toMatch(/synthetic \? executionQuality/)
    expect(source).toMatch(/synthetic \? \[\{ label: 'Order', value: orderId/)
    expect(source).toMatch(/const fillCount = synthetic \?/)
  })

  it('no copy claiming plans execute automatically', () => {
    // Nothing implements autonomous entry: bkt's monitor scans OPEN positions
    // only, and entry happens on an explicit POST (HKP-XSV-1). This is the
    // most consequential fabrication in the app — a claim about what happens
    // to the user's money without them.
    const forbidden = [
      /execute automatically/i,
      /automatic execution/i,
      /fire the moment/i,
      /fires? when criteria/i,
      /executes? on its own/i,
    ]
    for (const file of ALL) {
      const source = code(file)
      for (const pattern of forbidden) {
        const line = source.split('\n').find((text) => pattern.test(text))
        expect(line, `${rel(file)}: ${line?.trim()}`).toBeUndefined()
      }
    }
  })
})

describe('§6 — market data (APP-108)', () => {
  it('no index level is derived from another symbol', () => {
    // The strip used to render a DOW level as SPY's day change × 0.42. A
    // plausible number for an index nobody in this system carries is the most
    // dangerous fabrication there is: nobody double-checks a figure they
    // recognise.
    const source = code(join(SRC, 'components/shell/TopBar.tsx'))
    expect(source).not.toMatch(/'DOW'/)
    expect(source).not.toMatch(/factor:\s*0\.\d+/)
    expect(source).not.toMatch(/base:\s*\d/)
  })

  it('in-browser IV and OI are gated on the demo book’s own model terms', () => {
    const source = read(join(SRC, 'lib/optionMath.ts'))
    // `extrinsicBase` exists only on seeded contracts, so it is the marker
    // that a contract may legitimately be priced by the browser at all.
    expect(source).toMatch(/export function hasModelTerms/)
    expect(source).toMatch(/if \(!hasModelTerms\(contract\)\) return undefined/)
    expect(source).toMatch(/if \(contract\.extrinsicBase === undefined\) return undefined/)
  })

  it('the live quote provider never imports the demo seed book (D4)', () => {
    for (const file of [
      join(SRC, 'api/marketData/PollingQuoteProvider.ts'),
      join(SRC, 'api/marketData/types.ts'),
      join(SRC, 'api/http/adapters/market.ts'),
      join(SRC, 'api/http/HttpMarketDataApi.ts'),
    ]) {
      expect(read(file), `${rel(file)} imports mock seed data`).not.toMatch(
        /from '@\/api\/mock\//,
      )
    }
  })

  it('the terminal chain and chart render synthetic surfaces only in mock mode', () => {
    const chain = read(join(SRC, 'components/terminal/OptionsChain.tsx'))
    expect(chain).toMatch(/isMarketLive/)
    // The Black–Scholes ladder is the `else` of the live branch, never both.
    expect(chain).toMatch(/if \(live\) return liveRows\(chain\.data, spot\)/)

    const chart = read(join(SRC, 'components/terminal/TerminalChart.tsx'))
    // Repricing a tape into an option's history uses the seeded smile; the
    // facade has no historical chain to replace it with.
    expect(chart).toMatch(/contract && !live/)
  })
})

describe('§3.3 — the client-side planner heuristics (APP-113)', () => {
  it('no module derives a trade plan from free text in the browser', () => {
    // `plannerPrompt.ts` regex-matched a ticker out of the mock seed map and
    // then invented an entry band, a target band, a stop and a horizon from
    // arithmetic on a seeded open price. `thesisPlan.ts` derived a whole plan
    // from a thesis, stop included. Both were a client-side model wearing the
    // decision engine's clothes; the real composer is service-ai's
    // (HKP-AI-3a, Wave C).
    for (const file of ALL) {
      expect(
        /plannerInputFromPrompt|thesisToPlannerInput/.test(read(file)),
        `${rel(file)} still derives a plan client-side`,
      ).toBe(false)
    }
  })

  it('writes a user disposition only as a valid ActionType', () => {
    // plt validates `action_type` against its enum, so a free-form
    // `THESIS_REJECTED` is a 400, not a nicer-reading feed row (§7.10).
    const writer = code(join(SRC, 'api/http/userActivity.ts'))
    expect(writer).toMatch(/action_type: 'USER_ACTIVITY'/)
    expect(writer).not.toMatch(/action_type: '(THESIS|PLAN)_/)
  })
})

describe('§3.7 — the research desk (APP-122)', () => {
  it('the deterministic backtest engine lives only in the mock binding', () => {
    // `simulateRun()` shaped a CAGR, a Sharpe and an equity curve out of a
    // hash of the run's own configuration. It is a fine demo and it is not a
    // backtest, so it exists in exactly one file — the mock seam — and the
    // page that used to call it no longer can.
    const declaring = ALL.filter((file) => /export function simulateRun/.test(read(file)))
    expect(declaring.map(rel)).toEqual(['api/mock/MockResearchApi.ts'])

    for (const file of [
      join(SRC, 'routes/ResearchPage.tsx'),
      join(SRC, 'store/researchStore.ts'),
      join(SRC, 'components/research/BacktestRunCard.tsx'),
    ]) {
      // `code()`, not `read()`: these files explain in prose why the demo
      // engine moved, and an explanation must not be a violation.
      expect(code(file), `${rel(file)} still runs the demo engine`).not.toMatch(/simulateRun/)
    }
  })

  it('the live research adapter fabricates nothing', () => {
    for (const file of [
      join(SRC, 'api/http/HttpResearchApi.ts'),
      join(SRC, 'api/http/adapters/backtest.ts'),
    ]) {
      const source = read(file)
      expect(source, `${rel(file)} imports demo fixtures`).not.toMatch(/from '@\/api\/mock\//)
      expect(source, `${rel(file)} uses a PRNG`).not.toMatch(/mulberry32|Math\.random/)
      // Missing stays missing: a `?? 0` in this layer would turn bkt's
      // deliberate nulls — a withheld ratio, an absent refusal rate — into
      // measurements (D4/§19.4).
      expect(source, `${rel(file)} defaults a wire value to zero`).not.toMatch(/\?\?\s*0\b/)
    }
  })

  it('the shadow tape is confined to demo plans', () => {
    const source = read(join(SRC, 'routes/ResearchPage.tsx'))
    expect(source).toMatch(/if \(live\) return null/)
    expect(source).toMatch(/plan\.provenance === 'mock'/)
  })
})

describe('§6 / D10 — the global simulated claim', () => {
  it('the demo badge is conditional on the whole build being mocked', () => {
    const source = read(join(SRC, 'components/shell/DemoBadge.tsx'))
    expect(source).toMatch(/hasLiveDomain/)
    expect(source).toMatch(/if \(hasLiveDomain\(\)\) return null/)
  })

  it('the portfolio footer claim is conditional too', () => {
    const source = read(join(SRC, 'routes/PortfolioPage.tsx'))
    expect(source).toMatch(/allSimulated/)
    // The blanket sentence survives only inside the fully-mocked branch.
    const index = source.indexOf('Every price, position and AI output in this build is simulated')
    expect(index).toBeGreaterThan(source.indexOf('{allSimulated ? ('))
  })

  it('defaults to the fully-simulated claim when no domain is live', () => {
    // The demo build is the default, and it must keep saying so.
    expect(hasLiveDomain({})).toBe(false)
    expect(hasLiveDomain({ VITE_DATA_PORTFOLIO: 'live' })).toBe(true)
  })
})

describe('V1 safety invariant — silent/paper only', () => {
  it('nothing in the app references a brokerage SDK or a live-order route', () => {
    const forbidden = [
      /\balpaca-trade-api\b/i,
      /\btradier\b/i,
      /\bib_insync\b/i,
      /\bschwab-api\b/i,
      /api\.robinhood\.com/i,
      /\/v2\/orders\b/,
      /live[-_]?order/i,
      /\bplace_?order\b/i,
    ]
    for (const file of ALL) {
      const source = read(file)
      for (const pattern of forbidden) {
        expect(pattern.test(source), `${rel(file)} matches ${pattern}`).toBe(false)
      }
    }
  })

  it('the only backend hosts the app can reach are the four local services', () => {
    // Same-origin prefixes only; there is no absolute URL to anything else,
    // and no service sends CORS headers anyway (HKP-CORS-1).
    const env = read(join(SRC, 'api/http/env.ts'))
    expect(env).toMatch(/plt: '\/plt'/)
    expect(env).toMatch(/ai: '\/ai'/)
    expect(env).toMatch(/bkt: '\/bkt'/)
    expect(env).toMatch(/mnd: '\/mnd'/)
    for (const file of sourceFiles(join(SRC, 'api'))) {
      expect(read(file), `${rel(file)} builds an absolute URL`).not.toMatch(
        /https?:\/\/(?!stratfolio\.local\/problems)/,
      )
    }
  })
})
