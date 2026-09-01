import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Info, SendHorizontal } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatMoney, formatQty, formatSignedMoney } from '@/lib/format'
import type { Order, Position } from '@/api/types'
import { useSubmitOrder } from '@/hooks/queries'
import { BrokerageBadge } from '@/components/shared/BrokerageBadge'
import { Button } from '@/components/ui/Button'
import { HoldToConfirmButton } from '@/components/ui/HoldToConfirmButton'
import { Modal } from '@/components/ui/Modal'
import { PositionContextPanel } from '@/components/positions/PositionContextPanel'
import { OrderRoutingAnimation } from '@/components/trade/OrderRoutingAnimation'

type OrderType = 'MARKET' | 'LIMIT'

export function ManualCloseTicket({
  position,
  price,
  previousClose,
  open,
  onOpenChange,
}: {
  position: Position
  price: number
  /** Prior session's option mark, used to derive the simulated last price. */
  previousClose?: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const inputId = useId()
  // Open on arrival: the chart is the context for choosing a price, not an aside.
  const [detailsOpen, setDetailsOpen] = useState(true)
  const [quantityText, setQuantityText] = useState(String(position.quantity))
  const [orderType, setOrderType] = useState<OrderType>('LIMIT')
  const [limitText, setLimitText] = useState(price.toFixed(2))
  const [selectedQuote, setSelectedQuote] = useState<string | null>(null)
  const [submittedOrder, setSubmittedOrder] = useState<Order | null>(null)
  const submitOrder = useSubmitOrder()
  const onOpenChangeRef = useRef(onOpenChange)
  onOpenChangeRef.current = onOpenChange

  const priceAtOpen = useRef(price)
  priceAtOpen.current = price
  useEffect(() => {
    if (!open) return
    setQuantityText(String(position.quantity))
    setOrderType('LIMIT')
    setLimitText(priceAtOpen.current.toFixed(2))
    setSubmittedOrder(null)
    submitOrder.reset()
    // Seeded from a ref rather than a dependency: `price` ticks roughly once a
    // second, and re-running this would overwrite the limit mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, position.quantity])

  // Kept out of the reset effect above: that one re-runs on every price tick,
  // which would collapse the panel while the user is reading it. Reopens on
  // close so the next visit starts with the chart showing, and clears the
  // quote picked last time.
  useEffect(() => {
    if (!open) {
      setDetailsOpen(true)
      setSelectedQuote(null)
    }
  }, [open])

  useEffect(() => {
    if (!submittedOrder) return
    const timeout = window.setTimeout(() => onOpenChangeRef.current(false), 2500)
    return () => window.clearTimeout(timeout)
  }, [submittedOrder])

  const quantity = useMemo(() => {
    const parsed = Number(quantityText)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  }, [quantityText])
  const limitPrice = Number(limitText)
  const orderPrice = orderType === 'LIMIT' ? limitPrice : price
  const validPrice = Number.isFinite(orderPrice) && orderPrice > 0
  const canSend = quantity > 0 && quantity <= position.quantity && validPrice
  const multiplier = position.assetType === 'option' ? 100 : 1
  const estimatedCredit = canSend ? quantity * orderPrice * multiplier : 0
  const estimatedPl = canSend ? (orderPrice - position.avgCost) * quantity * multiplier : 0
  const unit = position.assetType === 'option' ? 'contracts' : 'shares'

  const sendOrder = async () => {
    if (!canSend) return
    try {
      const order = await submitOrder.mutateAsync({
        symbol: position.symbol,
        side: 'SELL',
        quantity,
        limitPrice: orderType === 'LIMIT' ? orderPrice : undefined,
        estimatedPrice: orderPrice,
        brokerageId: position.brokerageId,
        positionId: position.id,
      })
      setSubmittedOrder(order)
    } catch {
      // Mutation state renders the recoverable error below the ticket.
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      showCloseButton={!submittedOrder}
      title={
        submittedOrder ? (
          'Close order sent'
        ) : (
          // The contract rides the title's baseline rather than sitting under it.
          <span className="-mt-[2mm] flex min-w-0 items-baseline gap-2">
            <span className="shrink-0">Close {position.symbol}</span>
            <span className="num min-w-0 truncate text-[14px] font-bold text-ink uppercase">
              {position.contractDetail ?? position.company}
            </span>
          </span>
        )
      }
      description={
        submittedOrder ? 'Your broker has received the simulated order.' : undefined
      }
      className={cn(
        'sm:w-[min(500px,calc(100vw-2rem))]',
        submittedOrder && 'order-confirmation',
      )}
      footer={
        submittedOrder ? undefined : (
          <div className="grid grid-cols-[0.8fr_1.2fr] gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <HoldToConfirmButton
              variant="success"
              disabled={!canSend}
              pending={submitOrder.isPending}
              onComplete={() => void sendOrder()}
            >
              <SendHorizontal size={15} />
              Hold to send
            </HoldToConfirmButton>
          </div>
        )
      }
    >
      {submittedOrder ? (
        <CloseOrderSent order={submittedOrder} unit={unit} />
      ) : (
        <div className="space-y-3">
          <PositionContextPanel
            position={position}
            price={price}
            previousClose={previousClose ?? price}
            expanded={detailsOpen}
            onToggle={() => setDetailsOpen((current) => !current)}
            selectedQuote={selectedQuote}
            onSelectQuote={(label: string, value: number) => {
              setOrderType('LIMIT')
              setLimitText(value.toFixed(2))
              setSelectedQuote(label)
            }}
          />

          <CloseField label={`Quantity (${unit})`} htmlFor={`${inputId}-quantity`}>
            <div className="flex items-center gap-3">
              <input
                type="range"
                aria-label={`Quantity to close, in ${unit}`}
                min={1}
                max={position.quantity}
                step={1}
                value={Math.min(Math.max(quantity || 1, 1), position.quantity)}
                onChange={(event) => setQuantityText(event.target.value)}
                className="range-slider min-w-0 flex-1"
                style={
                  {
                    '--range-fill': `${sliderFillPct(quantity, position.quantity)}%`,
                  } as React.CSSProperties
                }
              />
              <div className="flex shrink-0 items-baseline gap-1">
                <input
                  id={`${inputId}-quantity`}
                  inputMode="numeric"
                  value={quantityText}
                  onChange={(event) => setQuantityText(event.target.value.replace(/[^\d.]/g, ''))}
                  className="liquid-control num h-11 w-[66px] rounded-xl px-2 text-center text-[16px] font-extrabold text-ink outline-none"
                />
                <span className="num text-[12px] font-bold text-ink-muted">
                  /{formatQty(position.quantity)}
                </span>
              </div>
            </div>
            {quantity > position.quantity ? (
              <p className="mt-1.5 text-[11px] font-semibold text-down">
                Quantity exceeds this position.
              </p>
            ) : null}
          </CloseField>

          <CloseField label="Order type">
            <div className="liquid-inset grid grid-cols-2 gap-1 rounded-full p-1">
              {(['LIMIT', 'MARKET'] as OrderType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  aria-pressed={orderType === type}
                  onClick={() => setOrderType(type)}
                  className={cn(
                    'rounded-full py-2 text-[11.5px] font-bold transition-[background-color,color,box-shadow]',
                    orderType === type
                      ? 'bg-white/[0.1] text-ink shadow-[0_3px_12px_-8px_rgba(0,0,0,0.8)]'
                      : 'text-ink-muted hover:text-ink-soft',
                  )}
                >
                  {type === 'LIMIT' ? 'Limit' : 'Market'}
                </button>
              ))}
            </div>
          </CloseField>

          {orderType === 'LIMIT' ? (
            <CloseField label="Limit price" htmlFor={`${inputId}-limit`}>
              <div className="relative">
                <span className="absolute top-1/2 left-3 -translate-y-1/2 text-[14px] font-bold text-ink-muted">
                  $
                </span>
                <input
                  id={`${inputId}-limit`}
                  inputMode="decimal"
                  value={limitText}
                  onChange={(event) => setLimitText(event.target.value.replace(/[^\d.]/g, ''))}
                  className="liquid-control num h-11 w-full rounded-xl pr-3 pl-7 text-[16px] font-extrabold text-ink outline-none"
                />
              </div>
            </CloseField>
          ) : null}

          <dl className="liquid-inset space-y-2.5 rounded-[18px] p-3.5">
            <CloseRow label="Estimated credit" value={formatMoney(estimatedCredit)} emphasis />
            <CloseRow
              label="Estimated P/L"
              value={formatSignedMoney(estimatedPl)}
              tone={estimatedPl >= 0 ? 'up' : 'down'}
            />
            <div className="flex items-center justify-between gap-3 border-t border-line pt-2.5">
              <dt className="text-[11.5px] text-ink-soft">Send to</dt>
              <dd>
                {/* Live positions sit in one paper portfolio with no brokerage
                    to send to (HKP-PLT-6). Manual close is disabled in live
                    mode anyway until bkt grows an exit route (HKP-BKT-1). */}
                {position.brokerageId ? (
                  <BrokerageBadge id={position.brokerageId} showName showMask size="sm" />
                ) : (
                  <span className="text-[11.5px] font-semibold text-ink">Paper account</span>
                )}
              </dd>
            </div>
          </dl>

          <div className="liquid-inset flex items-start gap-2 rounded-[16px] border-brand-400/15 px-3 py-2.5 text-[11px] leading-relaxed text-[#cfe4ff]">
            <Info size={13} className="mt-0.5 shrink-0" />
            <span>
              Simulated closing order. Your position remains open until a broker fill is confirmed.
            </span>
          </div>

          {submitOrder.isError ? (
            <p className="rounded-xl bg-down-soft px-3 py-2.5 text-[11.5px] font-semibold text-down">
              The order could not be sent. Please try again.
            </p>
          ) : null}
        </div>
      )}
    </Modal>
  )
}

/** Percentage of the track to paint, clamped so the thumb never overruns. */
function sliderFillPct(value: number, max: number): number {
  if (max <= 1) return 100
  const clamped = Math.min(Math.max(value || 1, 1), max)
  return ((clamped - 1) / (max - 1)) * 100
}

function CloseField({
  label,
  aside,
  htmlFor,
  children,
}: {
  label: string
  aside?: string
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label
          htmlFor={htmlFor}
          className="text-[9.5px] font-bold tracking-[0.07em] text-ink-muted uppercase"
        >
          {label}
        </label>
        {aside ? <span className="text-[10px] text-ink-muted">{aside}</span> : null}
      </div>
      {children}
    </div>
  )
}

function CloseRow({
  label,
  value,
  emphasis,
  tone,
}: {
  label: string
  value: string
  emphasis?: boolean
  tone?: 'up' | 'down'
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[11.5px] text-ink-soft">{label}</dt>
      <dd
        className={cn(
          'num text-[12.5px] font-bold text-ink',
          emphasis && 'text-[15px] font-extrabold',
          tone === 'up' && 'text-up',
          tone === 'down' && 'text-down',
        )}
      >
        {value}
      </dd>
    </div>
  )
}

function CloseOrderSent({ order, unit }: { order: Order; unit: string }) {
  return (
    <div className="py-2 text-center">
      {order.brokerageId ? <OrderRoutingAnimation brokerageId={order.brokerageId} /> : null}
      <h3 className="mt-4 text-[18px] font-extrabold tracking-[-0.02em] text-ink">
        Sent to your broker
      </h3>
      <p className="mx-auto mt-1.5 max-w-[330px] text-[12.5px] leading-relaxed text-ink-soft">
        Sell {formatQty(order.quantity)} {unit} of {order.symbol}
        {order.price === undefined ? '' : ` at approximately ${formatMoney(order.price)}`}.
      </p>
      <dl className="liquid-inset mt-4 space-y-2.5 rounded-[18px] p-3.5 text-left">
        <CloseRow label="Order ID" value={order.id.toUpperCase()} />
        <CloseRow label="Status" value="Submitted · awaiting fill" />
        {order.estimatedValue === undefined ? null : (
          <CloseRow label="Estimated credit" value={formatMoney(order.estimatedValue)} emphasis />
        )}
      </dl>
    </div>
  )
}
