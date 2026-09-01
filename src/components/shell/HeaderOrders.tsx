import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, ClipboardList } from 'lucide-react'
import type { Order } from '@/api/types'
import { BrokerageLogo } from '@/components/shared/BrokerageBadge'
import { ProvenanceTag } from '@/components/shared/ProvenanceTag'
import { useOrders } from '@/hooks/queries'
import { formatMoney } from '@/lib/format'

/**
 * Recent order activity in the header.
 *
 * This used to render four hard-coded rows — invented option contracts,
 * quantities, totals and brokerages, with two of them permanently "PENDING".
 * They looked exactly like real orders and sat in the chrome of every screen
 * (plan §6, "synthesized fills/order IDs").
 *
 * It now reads the order seam. In live mode that is plt's silent trades and
 * pending/rejected plans merged with any bkt outcome that left no durable row
 * (HKP-BKT-4); in demo mode it is the mock book's own orders, labelled.
 */

/** What the header says about an outcome. `NO_FILL` is the one that matters:
 *  bkt returns it on a *successful* 201 and nothing was opened, so it must
 *  never read as pending or as a fill (§7.8). */
const STATUS: Record<Order['status'], { label: string; className: string }> = {
  SUBMITTED: {
    label: 'PENDING',
    className: 'rounded-md bg-[#f5c26b]/12 px-1 py-1 text-center text-[7.5px] font-black text-[#f5c26b]',
  },
  FILLED: {
    label: 'FILLED',
    className: 'rounded-md bg-up-soft px-1 py-1 text-center text-[7.5px] font-black text-up',
  },
  NO_FILL: {
    label: 'NO FILL',
    className:
      'rounded-md bg-white/[0.06] px-1 py-1 text-center text-[7.5px] font-black text-ink-muted',
  },
  REJECTED: {
    label: 'REJECTED',
    className: 'rounded-md bg-down-soft px-1 py-1 text-center text-[7.5px] font-black text-down',
  },
}

function orderLabel(order: Order): string {
  // No company name to fall back on in live mode (HKP-MND-4), so the ticker
  // plus whatever contract detail exists is the whole identity.
  return [order.symbol, order.company].filter(Boolean).join(' · ')
}

export function HeaderOrders() {
  const { data: orders } = useOrders()
  const rows = (orders ?? []).slice(0, 8)
  const lead = rows.find((order) => order.status === 'SUBMITTED') ?? rows[0]

  // Nothing invented to stand in for an empty book: the trigger simply does
  // not render when there are no orders.
  if (!lead) return null

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={`Recent orders, latest ${orderLabel(lead)}, quantity ${lead.quantity}`}
        className="group hidden h-11 w-[400px] shrink-0 items-center gap-2 rounded-[14px] border border-line bg-white/[0.04] px-2.5 text-[11px] font-bold text-ink-soft transition-colors hover:bg-white/[0.07] hover:text-ink xl:inline-flex"
      >
        <span className="grid h-6 w-6 place-items-center rounded-lg bg-brand-500/15 text-brand-300">
          <ClipboardList size={13} />
        </span>
        <span className={STATUS[lead.status].className}>{STATUS[lead.status].label}</span>
        <span className="num min-w-0 flex-1 truncate text-left text-[10px] font-bold text-ink">
          {orderLabel(lead)}
        </span>
        <span className="num shrink-0 text-[10px] font-bold text-ink">QTY {lead.quantity}</span>
        {lead.estimatedValue === undefined ? null : (
          <span className="num shrink-0 text-[10px] font-bold text-ink">
            AMT {formatMoney(lead.estimatedValue, { whole: true })}
          </span>
        )}
        {lead.brokerageId ? <BrokerageLogo id={lead.brokerageId} size="xs" /> : null}
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
            <span className="flex items-center gap-1.5 text-[9.5px] text-ink-muted">
              {/* The list is not "all orders": a NO_FILL leaves no durable row
                  and bkt has no list endpoint (HKP-BKT-4). */}
              Fills &amp; pending plans
              <ProvenanceTag provenance={lead.provenance} />
            </span>
          </DropdownMenu.Label>
          <div className="grid grid-cols-[62px_minmax(0,1fr)_58px_30px_72px_42px_58px] gap-1 border-y border-line px-2 py-1.5 text-right text-[8px] font-extrabold tracking-[0.07em] text-ink-muted uppercase">
            <span className="text-left">Side</span>
            <span className="text-left">Symbol</span>
            <span>Avg</span>
            <span>Qty</span>
            <span>Total</span>
            <span aria-label="Brokerage">Broker</span>
            <span>Status</span>
          </div>
          <div className="py-1">
            {rows.map((order) => (
              <DropdownMenu.Item
                key={order.id}
                className="grid cursor-default grid-cols-[62px_minmax(0,1fr)_58px_30px_72px_42px_58px] items-center gap-1 rounded-xl px-2 py-2.5 outline-none transition-colors focus:bg-white/[0.045]"
              >
                <span className={order.side === 'BUY' ? 'text-up' : 'text-down'}>
                  <span
                    className={
                      order.side === 'BUY'
                        ? 'rounded-md bg-up-soft px-1.5 py-1 text-[8.5px] font-black'
                        : 'rounded-md bg-down-soft px-1.5 py-1 text-[8.5px] font-black'
                    }
                  >
                    {order.side === 'BUY' ? 'OPEN' : 'CLOSE'}
                  </span>
                </span>
                <span className="num truncate text-[10.5px] font-bold text-ink">
                  {orderLabel(order)}
                </span>
                {/* Dashes, not zeros: a rejected plan and an unfilled attempt
                    genuinely have no price or notional. */}
                <span className="num text-right text-[10px] font-bold text-ink-soft">
                  {order.price === undefined ? '—' : formatMoney(order.price)}
                </span>
                <span className="num text-right text-[10.5px] font-bold text-ink-soft">
                  {order.quantity}
                </span>
                <span className="num text-right text-[10px] font-bold text-ink">
                  {order.estimatedValue === undefined
                    ? '—'
                    : formatMoney(order.estimatedValue, { whole: true })}
                </span>
                <span className="flex items-center justify-end">
                  {order.brokerageId ? <BrokerageLogo id={order.brokerageId} size="xs" /> : null}
                </span>
                <span
                  className={STATUS[order.status].className}
                  title={
                    order.rejectionReasons?.length
                      ? order.rejectionReasons.join(', ')
                      : order.platformError
                  }
                >
                  {STATUS[order.status].label}
                </span>
              </DropdownMenu.Item>
            ))}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
