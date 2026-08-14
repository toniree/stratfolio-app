import { gaussian, hashString, mulberry32 } from '@/lib/prng'
import { SYMBOL_MAP } from '@/api/mock/seededData'
import { blackScholes } from '@/lib/blackScholes'

/**
 * Deterministic OHLCV history for the desktop terminal chart, generated the
 * same way IntradayCandles builds its session: walked backwards from the live
 * quote so the final close always equals the price shown in the header, then
 * reversed. Seeded per symbol + timeframe + day, so a reload redraws the exact
 * same tape while the last bar keeps ticking live.
 */

export type Timeframe = '1D' | '1W' | '1M' | '3M' | '1Y'

export interface TerminalCandle {
  /** Unix seconds, ascending. */
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface FrameSpec {
  bars: number
  /** Seconds between bars. */
  step: number
  /** Volatility multiplier relative to a 5-minute bar. */
  scale: number
}

const FRAMES: Record<Timeframe, FrameSpec> = {
  '1D': { bars: 78, step: 5 * 60, scale: 1 },
  '1W': { bars: 65, step: 30 * 60, scale: 2.2 },
  '1M': { bars: 22, step: 86_400, scale: 5 },
  '3M': { bars: 66, step: 86_400, scale: 5 },
  '1Y': { bars: 52, step: 7 * 86_400, scale: 11 },
}

export function buildCandles(
  symbol: string,
  timeframe: Timeframe,
  lastPrice: number,
): TerminalCandle[] {
  const frame = FRAMES[timeframe]
  const spec = SYMBOL_MAP.get(symbol)
  const day = Math.floor(Date.now() / 86_400_000)
  const rand = mulberry32(hashString(`${symbol}:${day}:${timeframe}:terminal`))

  // Base per-bar volatility, from the simulator's per-symbol knob.
  const vol = lastPrice * ((spec?.volatility ?? 1.2) / 100) * 0.055 * Math.sqrt(frame.scale) * 4
  // Longer frames drift back to a lower start so the tape shows a trend.
  const drift = (lastPrice * (spec?.drift ?? 0.005) * frame.scale * 2.2) / frame.bars

  const now = Math.floor(Date.now() / 1000)
  const start = now - frame.bars * frame.step

  const reversed: TerminalCandle[] = []
  let close = lastPrice
  for (let i = frame.bars - 1; i >= 0; i--) {
    const open = Math.max(0.01, close - drift - gaussian(rand) * vol)
    const wick = Math.abs(gaussian(rand)) * vol * 0.65
    const body = Math.abs(close - open)
    reversed.push({
      time: start + i * frame.step,
      open,
      close,
      high: Math.max(open, close) + wick,
      low: Math.max(0.01, Math.min(open, close) - wick),
      // Volume tracks bar range so climactic bars read loud, plus noise.
      volume: Math.round((body / Math.max(vol, 0.0001)) * 900_000 + Math.abs(gaussian(rand)) * 450_000 + 250_000),
    })
    close = open
  }
  return reversed.reverse()
}

/* ------------------------------------------------------------------ */
/* Options                                                             */
/* ------------------------------------------------------------------ */

/**
 * Per-symbol base IV from the simulator's volatility knob, plus a skewed
 * smile. Shared by the chain's quotes and the option price chart so the two
 * always agree.
 */
export function chainImpliedVol(
  symbol: string,
  spot: number,
  strike: number,
  years: number,
): number {
  const knob = SYMBOL_MAP.get(symbol)?.volatility ?? 1.2
  const base = 0.14 + knob * 0.14
  const m = Math.log(strike / spot)
  // Smile flattens as expiry lengthens; downside strikes trade richer.
  const curve = (1.6 * m * m) / Math.sqrt(Math.max(years * 4, 0.25))
  const skew = -0.35 * m
  return Math.min(Math.max(base * (1 + curve + skew), 0.08), 2.5)
}

/** Black–Scholes value of a contract at a given spot and time-to-expiry. */
export function contractPrice(
  symbol: string,
  spot: number,
  strike: number,
  right: 'CALL' | 'PUT',
  years: number,
): number {
  const clamped = Math.max(years, 1 / 365)
  const volatility = chainImpliedVol(symbol, spot, strike, clamped)
  return Math.max(
    blackScholes({ spot, strike, years: clamped, volatility, right }).price,
    0.01,
  )
}

/**
 * Reprices an underlying tape into the contract's own price history: every
 * bar is pushed through the pricer with the time-to-expiry it had *then*, so
 * the resulting chart carries real theta decay, not just scaled spot moves.
 */
export function optionCandles(
  symbol: string,
  underlying: TerminalCandle[],
  strike: number,
  right: 'CALL' | 'PUT',
  expiryTime: number,
): TerminalCandle[] {
  return underlying.map((candle) => {
    const years = (expiryTime - candle.time) / (365 * 86_400)
    const open = contractPrice(symbol, candle.open, strike, right, years)
    const close = contractPrice(symbol, candle.close, strike, right, years)
    const atHigh = contractPrice(symbol, candle.high, strike, right, years)
    const atLow = contractPrice(symbol, candle.low, strike, right, years)
    return {
      time: candle.time,
      open,
      close,
      // Puts fall when spot rises, so the extremes swap sides on their own.
      high: Math.max(open, close, atHigh, atLow),
      low: Math.min(open, close, atHigh, atLow),
      volume: Math.max(1, Math.round(candle.volume / 90)),
    }
  })
}

/* ------------------------------------------------------------------ */
/* Studies                                                             */
/* ------------------------------------------------------------------ */

export interface StudyPoint {
  time: number
  value: number
}

export function sma(candles: TerminalCandle[], length: number): StudyPoint[] {
  const out: StudyPoint[] = []
  let sum = 0
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close
    if (i >= length) sum -= candles[i - length].close
    if (i >= length - 1) out.push({ time: candles[i].time, value: sum / length })
  }
  return out
}

export function ema(candles: TerminalCandle[], length: number): StudyPoint[] {
  if (candles.length === 0) return []
  const k = 2 / (length + 1)
  const out: StudyPoint[] = []
  let value = candles[0].close
  for (let i = 0; i < candles.length; i++) {
    value = candles[i].close * k + value * (1 - k)
    if (i >= Math.min(length - 1, candles.length - 1) || i >= length - 1)
      out.push({ time: candles[i].time, value })
  }
  return out
}

export function vwap(candles: TerminalCandle[]): StudyPoint[] {
  const out: StudyPoint[] = []
  let pv = 0
  let vSum = 0
  for (const candle of candles) {
    const typical = (candle.high + candle.low + candle.close) / 3
    pv += typical * candle.volume
    vSum += candle.volume
    out.push({ time: candle.time, value: vSum > 0 ? pv / vSum : typical })
  }
  return out
}

export interface BollingerPoint {
  time: number
  upper: number
  basis: number
  lower: number
}

export function bollinger(
  candles: TerminalCandle[],
  length = 20,
  mult = 2,
): BollingerPoint[] {
  const out: BollingerPoint[] = []
  for (let i = length - 1; i < candles.length; i++) {
    let sum = 0
    for (let j = i - length + 1; j <= i; j++) sum += candles[j].close
    const mean = sum / length
    let variance = 0
    for (let j = i - length + 1; j <= i; j++) variance += (candles[j].close - mean) ** 2
    const sd = Math.sqrt(variance / length)
    out.push({
      time: candles[i].time,
      upper: mean + mult * sd,
      basis: mean,
      lower: mean - mult * sd,
    })
  }
  return out
}

/** Wilder-smoothed RSI. */
export function rsi(candles: TerminalCandle[], length = 14): StudyPoint[] {
  if (candles.length <= length) return []
  let gain = 0
  let loss = 0
  for (let i = 1; i <= length; i++) {
    const change = candles[i].close - candles[i - 1].close
    if (change >= 0) gain += change
    else loss -= change
  }
  let avgGain = gain / length
  let avgLoss = loss / length
  const out: StudyPoint[] = [
    {
      time: candles[length].time,
      value: avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss),
    },
  ]
  for (let i = length + 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close
    avgGain = (avgGain * (length - 1) + Math.max(change, 0)) / length
    avgLoss = (avgLoss * (length - 1) + Math.max(-change, 0)) / length
    out.push({
      time: candles[i].time,
      value: avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss),
    })
  }
  return out
}
