import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, ClipboardList } from 'lucide-react'
import type { BrokerageId } from '@/api/types'
import { BrokerageLogo } from '@/components/shared/BrokerageBadge'
import { formatMoney } from '@/lib/format'

const EXAMPLE_ORDERS: {
  id: string
  intent: 'OPEN' | 'CLOSE'
  option: string
  avg: number
  qty: number
  total: number
  brokerage: BrokerageId
  status: 'PENDING' | 'FILLED'
}[] = [
  { id: 'mu-open', intent: 'OPEN', option: "MU $150 C · Jan 15 '27", avg: 16.2, qty: 3, total: 4_860, brokerage: 'robinhood', status: 'PENDING' },
  { id: 'wmt-close', intent: 'CLOSE', option: "WMT $105 C · Sep 18 '26", avg: 8.7, qty: 2, total: 1_740, brokerage: 'schwab', status: 'FILLED' },
  { id: 'nvda-open', intent: 'OPEN', option: "NVDA $190 C · Dec 18 '26", avg: 15.8, qty: 4, total: 6_320, brokerage: 'fidelity', status: 'PENDING' },
  { id: 'coin-close', intent: 'CLOSE', option: "COIN $240 P · Nov 20 '26", avg: 21.8, qty: 1, total: 2_180, brokerage: 'etrade', status: 'FILLED' },
]

export function HeaderOrders() {
  const pending = EXAMPLE_ORDERS.find((order) => order.status === 'PENDING')!

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={`Pending order ${pending.option}, quantity ${pending.qty}`}
        className="group hidden h-11 w-[400px] shrink-0 items-center gap-2 rounded-[14px] border border-line bg-white/[0.04] px-2.5 text-[11px] font-bold text-ink-soft transition-colors hover:bg-white/[0.07] hover:text-ink xl:inline-flex"
      >
        <span className="grid h-6 w-6 place-items-center rounded-lg bg-brand-500/15 text-brand-300">
          <ClipboardList size={13} />
        </span>
        <span className="rounded-md bg-[#f5c26b]/12 px-1.5 py-1 text-[7.5px] font-black text-[#f5c26b]">
          PENDING
        </span>
        <span className="num min-w-0 flex-1 truncate text-left text-[10px] font-bold text-ink">
          {pending.option}
        </span>
        <span className="num shrink-0 text-[10px] font-bold text-ink">QTY {pending.qty}</span>
        <span className="num shrink-0 text-[10px] font-bold text-ink">
          AMT {formatMoney(pending.total, { whole: true })}
        </span>
        <BrokerageLogo id={pending.brokerage} size="xs" />
        <ChevronDown size={13} className="text-ink-muted transition-transform group-data-[state=open]:rotate-180" />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={9}
          collisionPadding={12}
          className="menu-surface z-[70] w-[620px] p-2.5"
        >
          <DropdownMenu.Label className="flex items-center justify-between px-1.5 pb-2">
            <span className="text-[10px] font-extrabold tracking-[0.08em] text-ink uppercase">Orders</span>
            <span className="text-[9.5px] text-ink-muted">Recent option activity</span>
          </DropdownMenu.Label>
          <div className="grid grid-cols-[62px_minmax(0,1fr)_58px_30px_72px_42px_58px] gap-1 border-y border-line px-2 py-1.5 text-right text-[8px] font-extrabold tracking-[0.07em] text-ink-muted uppercase">
            <span className="text-left">Side</span>
            <span className="text-left">Option</span>
            <span>Avg</span>
            <span>Qty</span>
            <span>Total</span>
            <span aria-label="Brokerage">Broker</span>
            <span>Status</span>
          </div>
          <div className="py-1">
            {EXAMPLE_ORDERS.map((order) => {
              return (
                <DropdownMenu.Item
                  key={order.id}
                  className="grid cursor-default grid-cols-[62px_minmax(0,1fr)_58px_30px_72px_42px_58px] items-center gap-1 rounded-xl px-2 py-2.5 outline-none transition-colors focus:bg-white/[0.045]"
                >
                  <span className={order.intent === 'OPEN' ? 'text-up' : 'text-down'}>
                    <span className={order.intent === 'OPEN' ? 'rounded-md bg-up-soft px-1.5 py-1 text-[8.5px] font-black' : 'rounded-md bg-down-soft px-1.5 py-1 text-[8.5px] font-black'}>
                      {order.intent}
                    </span>
                  </span>
                  <span className="num truncate text-[10.5px] font-bold text-ink">{order.option}</span>
                  <span className="num text-right text-[10px] font-bold text-ink-soft">{formatMoney(order.avg)}</span>
                  <span className="num text-right text-[10.5px] font-bold text-ink-soft">{order.qty}</span>
                  <span className="num text-right text-[10px] font-bold text-ink">{formatMoney(order.total, { whole: true })}</span>
                  <span className="flex items-center justify-end">
                    <BrokerageLogo id={order.brokerage} size="xs" />
                  </span>
                  <span className={order.status === 'PENDING' ? 'rounded-md bg-[#f5c26b]/12 px-1 py-1 text-center text-[7.5px] font-black text-[#f5c26b]' : 'rounded-md bg-up-soft px-1 py-1 text-center text-[7.5px] font-black text-up'}>
                    {order.status}
                  </span>
                </DropdownMenu.Item>
              )
            })}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
