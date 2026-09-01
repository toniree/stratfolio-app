import type { MarketDataApi, PriceListener, PriceMap, PriceSnapshot, QuoteProvider } from '@/api/marketData/types'
import { barWindow, quoteMark } from '@/api/http/adapters/market'
import { httpMarketDataApi } from '@/api/http/HttpMarketDataApi'
import { marketSymbols, quotePollMs } from '@/api/http/env'

/**
 * The live quote source: a polling provider over the mnd :7102 facade.
 *
 * V1 polls (D8). There is no browser-facing push anywhere in the backend —
 * `StreamSnapshots` is gRPC-only and is deferred from the facade with no route
 * at all — so this replaces the simulator's interval with an HTTP one, at a
 * cadence the tab's visibility gates.
 *
 * TWO RULES GOVERN WHAT IT PUBLISHES.
 *
 * 1. **A symbol without a real prior close is never published.** The app's
 *    whole tape is built on `dayChange`, which needs a baseline. The snapshot
 *    route carries no previous close, so the provider reads one from the bars
 *    route — real recorded data — and a symbol it cannot get one for stays
 *    absent from the map entirely. It does not get today's first tick, or the
 *    session open, or the entry price, standing in for yesterday's close:
 *    missing stays missing (D4, §6). Consumers already handle an absent
 *    symbol; none of them can detect an invented baseline.
 *
 * 2. **Provenance travels with the price.** Every published snapshot carries
 *    mnd's own claim — `synthetic` when the service generated the number,
 *    `replay` when it is recorded data off a fixed clock — so the panel badge
 *    is the service's word, not this file's guess.
 *
 * The clock is **mnd's**, not the browser's. In replay mode the dataset sits
 * at a fixed historical instant, and building bar windows from `Date.now()`
 * would ask for a range the dataset does not cover.
 */

/** Rolling sparkline window, matching the simulator's. */
const HISTORY_WINDOW = 28
/** How far back to look for a prior daily close. Long enough to clear a
 *  holiday weekend without scanning a year of hypertable. */
const BASELINE_SPAN_MS = 14 * 86_400_000
/** Daily bars in a two-week window; far below `store.MaxBarLimit`. */
const BASELINE_LIMIT = 32
/** Re-read the daily baseline at most this often. It changes once a session. */
const BASELINE_TTL_MS = 15 * 60_000

interface Baseline {
  previousClose: number
  open?: number
  /** Real closes, oldest first, seeding the sparkline before live ticks land. */
  history: number[]
  fetchedAtMs: number
}

export interface PollingQuoteProviderOptions {
  api?: MarketDataApi
  symbols?: string[]
  intervalMs?: number
  /** Injected for tests; defaults to the real scheduler. */
  setInterval?: typeof setInterval
  clearInterval?: typeof clearInterval
  /** Injected for tests; defaults to `document.visibilityState`. */
  isVisible?: () => boolean
  onError?: (error: unknown) => void
}

export class PollingQuoteProvider implements QuoteProvider {
  private readonly api: MarketDataApi
  private readonly intervalMs: number
  private readonly setIntervalFn: typeof setInterval
  private readonly clearIntervalFn: typeof clearInterval
  private readonly isVisible: () => boolean
  private readonly onError: (error: unknown) => void

  private readonly symbols = new Set<string>()
  private readonly baselines = new Map<string, Baseline>()
  private readonly listeners = new Set<PriceListener>()
  private snapshot: PriceMap = {}
  private timer: ReturnType<typeof setInterval> | null = null
  private polling = false
  /** mnd's clock, from the status route. Replay sits at a historical instant. */
  private serverClockMs: number | undefined
  private serverClockReadAtMs = 0

  constructor(options: PollingQuoteProviderOptions = {}) {
    this.api = options.api ?? httpMarketDataApi
    this.intervalMs = options.intervalMs ?? quotePollMs()
    this.setIntervalFn = options.setInterval ?? setInterval
    this.clearIntervalFn = options.clearInterval ?? clearInterval
    this.isVisible =
      options.isVisible ??
      (() => typeof document === 'undefined' || document.visibilityState !== 'hidden')
    // A failed poll must not degrade to mock data (D2) and must not crash the
    // tape: the previous real snapshot simply stops advancing.
    this.onError = options.onError ?? (() => {})
    for (const symbol of options.symbols ?? marketSymbols()) this.symbols.add(symbol.toUpperCase())
  }

  getSnapshot(): PriceMap {
    return this.snapshot
  }

  track(symbols: string[]): void {
    let added = false
    for (const raw of symbols) {
      const symbol = raw.trim().toUpperCase()
      if (!symbol || this.symbols.has(symbol)) continue
      this.symbols.add(symbol)
      added = true
    }
    // Pick the new symbols up now rather than at the next tick, so opening a
    // position's page does not show an empty quote for five seconds.
    if (added && this.listeners.size > 0) void this.poll()
  }

  subscribe(listener: PriceListener): () => void {
    this.listeners.add(listener)
    listener(this.snapshot)
    this.start()
    return () => {
      this.listeners.delete(listener)
      if (this.listeners.size === 0) this.stop()
    }
  }

  start(): void {
    if (this.timer !== null) return
    this.timer = this.setIntervalFn(() => {
      // Polling a hidden tab burns the local database for pixels nobody is
      // looking at. The next visible tick catches up in one request.
      if (this.isVisible()) void this.poll()
    }, this.intervalMs)
    void this.poll()
  }

  stop(): void {
    if (this.timer === null) return
    this.clearIntervalFn(this.timer)
    this.timer = null
  }

  /** One full pass over the tracked symbols. Exposed for tests and for the
   *  immediate refresh a `track()` triggers. */
  async poll(): Promise<void> {
    // Overlapping passes would interleave two snapshots of the same map.
    if (this.polling) return
    this.polling = true
    try {
      const clockMs = await this.clock()
      const next: PriceMap = { ...this.snapshot }
      const symbols = [...this.symbols]
      const results = await Promise.allSettled(
        symbols.map((symbol) => this.readSymbol(symbol, clockMs)),
      )
      let changed = false
      results.forEach((result, index) => {
        const symbol = symbols[index]
        if (result.status === 'rejected') {
          this.onError(result.reason)
          return
        }
        const snapshot = result.value
        // A symbol with no usable quote or no real baseline is left out
        // rather than published with a stand-in.
        if (!snapshot) {
          if (next[symbol]) {
            delete next[symbol]
            changed = true
          }
          return
        }
        next[symbol] = snapshot
        changed = true
      })
      if (!changed) return
      this.snapshot = next
      for (const listener of this.listeners) listener(this.snapshot)
    } catch (error) {
      this.onError(error)
    } finally {
      this.polling = false
    }
  }

  /** mnd's clock, refreshed alongside the baseline rather than every tick. */
  private async clock(): Promise<number> {
    const now = Date.now()
    if (this.serverClockMs !== undefined && now - this.serverClockReadAtMs < BASELINE_TTL_MS) {
      // Advance the cached reading by wall time between reads. In replay at
      // speed 1 this tracks; the next refresh corrects any drift.
      return this.serverClockMs + (now - this.serverClockReadAtMs)
    }
    try {
      const status = await this.api.getStatus()
      const stamp = status.replay?.clock ?? status.serverTime ?? status.wallTime
      const parsed = stamp ? Date.parse(stamp) : NaN
      this.serverClockMs = Number.isNaN(parsed) ? now : parsed
      this.serverClockReadAtMs = now
      return this.serverClockMs
    } catch (error) {
      this.onError(error)
      // Status is the one route that works with the database down; if even it
      // failed, the browser clock is the only one left.
      return now
    }
  }

  private async readSymbol(symbol: string, clockMs: number): Promise<PriceSnapshot | undefined> {
    const snapshot = await this.api.getSnapshot(symbol, { chainSummary: false })
    const price = quoteMark(snapshot.underlying)
    if (price === undefined) return undefined

    const baseline = await this.baseline(symbol, clockMs)
    if (!baseline) return undefined

    const previous = this.snapshot[symbol]
    const history = appendHistory(previous?.history ?? baseline.history, price)
    const dayChange = price - baseline.previousClose
    return {
      symbol,
      price,
      previousClose: baseline.previousClose,
      open: baseline.open,
      dayChange,
      dayChangePct: baseline.previousClose > 0 ? (dayChange / baseline.previousClose) * 100 : 0,
      history,
      provenance: snapshot.underlying?.provenance ?? snapshot.provenance,
      stale: snapshot.staleness?.stale,
      asOf: snapshot.underlying?.eventTime ?? snapshot.asOf,
    }
  }

  /**
   * The prior session close, read from real daily bars over a bounded window.
   *
   * `start` and `end` are both required by the route (§15.3) — an unbounded
   * scan is refused with a 400 — and `barWindow()` is the only constructor
   * that cannot omit one.
   */
  private async baseline(symbol: string, clockMs: number): Promise<Baseline | undefined> {
    const cached = this.baselines.get(symbol)
    if (cached && Date.now() - cached.fetchedAtMs < BASELINE_TTL_MS) return cached

    const page = await this.api.getBars(
      symbol,
      barWindow({
        // `end` is exclusive; reach past the current instant so today's own
        // daily bar is inside the window.
        end: clockMs + 86_400_000,
        spanMs: BASELINE_SPAN_MS + 86_400_000,
        interval: '1d',
        limit: BASELINE_LIMIT,
      }),
    )
    if (page.bars.length < 2) return undefined

    // A truncated daily page would hold the OLDEST bars of the window and cut
    // the newest (§15.3) — precisely the ones a prior close needs. Refusing is
    // the only honest answer; a stale "previous close" would silently mislabel
    // every day change built on it.
    if (page.truncated) return undefined

    const dayStart = startOfUtcDay(clockMs)
    const priorBars = page.bars.filter((bar) => bar.time * 1000 < dayStart)
    const todayBar = page.bars.find((bar) => bar.time * 1000 >= dayStart)
    const prior = priorBars.at(-1)
    if (!prior) return undefined

    const baseline: Baseline = {
      previousClose: prior.close,
      open: todayBar?.open,
      history: page.bars.slice(-HISTORY_WINDOW).map((bar) => bar.close),
      fetchedAtMs: Date.now(),
    }
    this.baselines.set(symbol, baseline)
    return baseline
  }
}

function startOfUtcDay(ms: number): number {
  const date = new Date(ms)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

function appendHistory(history: number[], price: number): number[] {
  if (history.at(-1) === price) return history
  const next = [...history, price]
  return next.length > HISTORY_WINDOW ? next.slice(next.length - HISTORY_WINDOW) : next
}
