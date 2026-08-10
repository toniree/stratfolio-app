import type { BrokerageId } from '@/api/types'

const VECTOR_SYMBOLS = new Set([
  'AAPL',
  'AMD',
  'ARM',
  'AVGO',
  'COIN',
  'GOOGL',
  'NVDA',
  'PLTR',
  'SHOP',
  'SMCI',
  'TSLA',
  'UBER',
])

const COMPANY_SYMBOLS = new Set([
  ...VECTOR_SYMBOLS,
  'AMZN',
  'ASML',
  'CRDO',
  'CRWD',
  'LLY',
  'MRVL',
  'MSFT',
  'MU',
  'NEE',
  'SNDK',
  'SOFI',
  'SPY',
  'TSM',
  'VRT',
  'WDC',
])

const BROKERAGE_FILES: Record<BrokerageId, string> = {
  robinhood: 'broker-robinhood.png',
  schwab: 'broker-schwab.png',
  fidelity: 'broker-fidelity.png',
  etrade: 'broker-etrade.png',
  webull: 'broker-webull.png',
  ibkr: 'broker-ibkr.png',
}

function assetUrl(file: string): string {
  return `${import.meta.env.BASE_URL}brand-logos/${file}`
}

/** Returns a locally bundled brand mark for every symbol in the demo universe. */
export function getCompanyLogoSrc(symbol: string): string | undefined {
  const normalized = symbol.trim().toUpperCase()
  if (!COMPANY_SYMBOLS.has(normalized)) return undefined
  return assetUrl(`${normalized}.${VECTOR_SYMBOLS.has(normalized) ? 'svg' : 'png'}`)
}

export function getBrokerageLogoSrc(id: BrokerageId): string {
  return assetUrl(BROKERAGE_FILES[id])
}
