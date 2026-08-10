import { gaussian, hashString, mulberry32 } from '@/lib/prng'
import { SYMBOLS, type SymbolSpec } from '@/api/mock/seededData'

export interface PriceSnapshot {
  symbol: string
  price: number
  previousClose: number
  open: number
  dayChange: number
  dayChangePct: number
  /** Rolling window of recent prices for the inline sparklines. */
  history: number[]
}

export type PriceMap = Record<string, PriceSnapshot>

const WINDOW = 28
/** Length of the deterministic pre-generated path per symbol. */
const PATH_LENGTH = 3600

/**
 * Builds one deterministic, mean-reverting price path per symbol.
 *
 * This is intentionally NOT a live random walk: the whole path is generated up
 * front from a per-symbol seed, with an Ornstein–Uhlenbeck style pull back
 * toward a gently drifting anchor. The demo portfolio therefore behaves the
 * same way on every reload and can never randomly tank mid-demo, while still
 * ticking convincingly.
 */
function buildPath(spec: SymbolSpec): number[] {
  const rand = mulberry32(hashString(spec.symbol) ^ 0x5f3a91)
  const path: number[] = Array.from({ length: PATH_LENGTH })

  const anchorStart = spec.open
  // Where the anchor drifts to across the full path.
  const anchorEnd = spec.open * (1 + spec.drift)
  // Per-tick noise scale, expressed as a fraction of price.
  const sigma = (spec.volatility / 100) * 0.055
  const meanReversion = 0.055

  let price = spec.open
  for (let i = 0; i < PATH_LENGTH; i++) {
    const t = i / (PATH_LENGTH - 1)
    // Smooth, deterministic waviness so the sparkline has structure, not just noise.
    const wave =
      Math.sin(t * Math.PI * 6 + spec.previousClose) * 0.0022 * spec.volatility +
      Math.sin(t * Math.PI * 17 + spec.open) * 0.0009 * spec.volatility
    const anchor = anchorStart + (anchorEnd - anchorStart) * t + anchorStart * wave

    const shock = gaussian(rand) * sigma * price
    price = price + (anchor - price) * meanReversion + shock

    // Hard guardrails: a symbol can never wander more than ±9% from its anchor.
    const floor = anchor * 0.91
    const ceil = anchor * 1.09
    price = Math.min(ceil, Math.max(floor, price))
    path[i] = Math.round(price * 100) / 100
  }
  return path
}

export type PriceListener = (prices: PriceMap) => void

/**
 * Single-interval market data simulator.
 *
 * One `setInterval` batch-updates every symbol per tick and notifies listeners
 * once — mirroring how a real batched WebSocket feed would behave, rather than
 * running a timer per symbol.
 */
export class MarketDataSimulator {
  private paths = new Map<string, number[]>()
  private specs = new Map<string, SymbolSpec>()
  private cursor = 0
  private timer: ReturnType<typeof setInterval> | null = null
  private listeners = new Set<PriceListener>()
  private snapshot: PriceMap = {}
  private readonly intervalMs: number

  constructor(specs: SymbolSpec[] = SYMBOLS, intervalMs = 1000) {
    this.intervalMs = intervalMs
    for (const spec of specs) {
      this.specs.set(spec.symbol, spec)
      this.paths.set(spec.symbol, buildPath(spec))
    }
    this.snapshot = this.buildSnapshot(0)
  }

  private buildSnapshot(cursor: number): PriceMap {
    const next: PriceMap = {}
    for (const [symbol, spec] of this.specs) {
      const path = this.paths.get(symbol)!
      const idx = cursor % path.length
      const price = path[idx]
      const history: number[] = []
      for (let i = WINDOW - 1; i >= 0; i--) {
        const at = idx - i
        history.push(path[at >= 0 ? at : path.length + at])
      }
      const dayChange = price - spec.previousClose
      next[symbol] = {
        symbol,
        price,
        previousClose: spec.previousClose,
        open: spec.open,
        dayChange,
        dayChangePct: (dayChange / spec.previousClose) * 100,
        history,
      }
    }
    return next
  }

  getSnapshot(): PriceMap {
    return this.snapshot
  }

  /** Deterministic price for a symbol at an arbitrary tick — used in tests. */
  priceAt(symbol: string, cursor: number): number | undefined {
    const path = this.paths.get(symbol)
    if (!path) return undefined
    return path[cursor % path.length]
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

  /** Advance one tick and notify every listener exactly once. */
  tick(): void {
    this.cursor += 1
    this.snapshot = this.buildSnapshot(this.cursor)
    for (const listener of this.listeners) listener(this.snapshot)
  }

  start(): void {
    if (this.timer !== null) return
    this.timer = setInterval(() => this.tick(), this.intervalMs)
  }

  stop(): void {
    if (this.timer === null) return
    clearInterval(this.timer)
    this.timer = null
  }
}

/** App-wide singleton — exactly one interval for the entire application. */
export const marketDataSimulator = new MarketDataSimulator()
