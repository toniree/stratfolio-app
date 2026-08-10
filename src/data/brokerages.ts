import type { Brokerage, BrokerageId } from '@/api/types'

/** Brokerage display metadata. Monograms remain as resilient logo fallbacks. */
export const BROKERAGES: Brokerage[] = [
  {
    id: 'robinhood',
    name: 'Robinhood',
    short: 'Robinhood',
    monogram: 'RH',
    accountMask: '••••2417',
    badgeBg: '#E8F7EE',
    badgeFg: '#0E9F6E',
  },
  {
    id: 'schwab',
    name: 'Charles Schwab',
    short: 'Schwab',
    monogram: 'CS',
    accountMask: '••••8830',
    badgeBg: '#E8F1FE',
    badgeFg: '#1D4ED8',
  },
  {
    id: 'fidelity',
    name: 'Fidelity',
    short: 'Fidelity',
    monogram: 'FI',
    accountMask: '••••5192',
    badgeBg: '#EAF6F2',
    badgeFg: '#137A63',
  },
  {
    id: 'etrade',
    name: 'E*TRADE',
    short: 'E*TRADE',
    monogram: 'ET',
    accountMask: '••••7745',
    badgeBg: '#F1EDFD',
    badgeFg: '#6D3DE0',
  },
  {
    id: 'webull',
    name: 'Webull',
    short: 'Webull',
    monogram: 'WB',
    accountMask: '••••3061',
    badgeBg: '#FEF0EC',
    badgeFg: '#D9532F',
  },
  {
    id: 'ibkr',
    name: 'Interactive Brokers',
    short: 'IBKR',
    monogram: 'IB',
    accountMask: '••••6608',
    badgeBg: '#FEF6E7',
    badgeFg: '#A9741A',
  },
]

const BY_ID = new Map<BrokerageId, Brokerage>(BROKERAGES.map((b) => [b.id, b]))

export function getBrokerage(id: BrokerageId): Brokerage {
  const found = BY_ID.get(id)
  if (!found) throw new Error(`Unknown brokerage: ${id}`)
  return found
}
