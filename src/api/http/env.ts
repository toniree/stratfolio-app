/**
 * Per-domain live/mock wiring (D2).
 *
 * Every domain defaults to `mock`. The scripted demo is a supported product
 * mode, not a fallback for a broken backend, so nothing here ever silently
 * degrades a live domain to mock at runtime — a failed live call surfaces as
 * an error the UI renders.
 */

export type DataDomain = 'portfolio' | 'ideas' | 'planner' | 'news' | 'assistant' | 'universe'

export type DataMode = 'mock' | 'live'

/** Service prefixes served by the Vite dev proxy (plan §2 D1a) and, in a built
 *  PWA, by a local reverse proxy on the same origin. Always same-origin: there
 *  is no CORS anywhere in the backend (HKP-CORS-1). */
export const SERVICE_BASE = {
  plt: '/plt',
  ai: '/ai',
  bkt: '/bkt',
  mnd: '/mnd',
} as const

export type ServiceId = keyof typeof SERVICE_BASE

/** The URL path prefixes the service worker must never cache (D7). */
export const API_PATH_PREFIXES: readonly string[] = Object.values(SERVICE_BASE)

const FLAG: Record<DataDomain, string> = {
  portfolio: 'VITE_DATA_PORTFOLIO',
  ideas: 'VITE_DATA_IDEAS',
  planner: 'VITE_DATA_PLANNER',
  news: 'VITE_DATA_NEWS',
  assistant: 'VITE_DATA_ASSISTANT',
  universe: 'VITE_DATA_UNIVERSE',
}

type EnvBag = Record<string, string | boolean | undefined>

function readEnv(): EnvBag {
  // `import.meta.env` is statically replaced by Vite; guard for the Node test
  // runner where an individual key may simply be absent.
  return (import.meta.env ?? {}) as EnvBag
}

/**
 * Resolve a domain's mode. Anything other than the exact string `live` is
 * mock — a typo must not accidentally point the UI at a backend, and an unset
 * flag must never be "live because a server happens to be up".
 */
export function dataMode(domain: DataDomain, env: EnvBag = readEnv()): DataMode {
  return env[FLAG[domain]] === 'live' ? 'live' : 'mock'
}

export function isLive(domain: DataDomain, env?: EnvBag): boolean {
  return dataMode(domain, env) === 'live'
}

/** True when at least one domain is live, i.e. the build is showing a mix of
 *  real and simulated data and the global "everything is simulated" claim
 *  would be a lie (D10). */
export function hasLiveDomain(env: EnvBag = readEnv()): boolean {
  return (Object.keys(FLAG) as DataDomain[]).some((domain) => dataMode(domain, env) === 'live')
}

export function serviceBase(service: ServiceId, env: EnvBag = readEnv()): string {
  const override = env[`VITE_${service.toUpperCase()}_BASE`]
  return typeof override === 'string' && override.length > 0 ? override : SERVICE_BASE[service]
}

/** Request timeout in ms. bkt backtests are 202-but-synchronous (§7.6) and
 *  need their own, much longer budget; callers pass it explicitly. */
export function requestTimeoutMs(env: EnvBag = readEnv()): number {
  const raw = env.VITE_API_TIMEOUT_MS
  const parsed = typeof raw === 'string' ? Number.parseInt(raw, 10) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15_000
}
