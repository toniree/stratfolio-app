import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { CheckCircle2, CircleSlash, Info, SendHorizontal } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatMoney, formatQty, formatSignedMoney } from '@/lib/format'
import type { Order, Position } from '@/api/types'
import { useRequestExit, useSubmitOrder } from '@/hooks/queries'
import { idempotencyKeys, newIdempotencyKey } from '@/api/http/idempotency'
import { ApiError } from '@/api/http/problem'
import { BrokerageBadge } from '@/components/shared/BrokerageBadge'
import { Button } from '@/components/ui/Button'
import { HoldToConfirmButton } from '@/components/ui/HoldToConfirmButton'
import { Modal } from '@/components/ui/Modal'
import { PositionContextPanel } from '@/components/positions/PositionContextPanel'
import { OrderRoutingAnimation } from '@/components/trade/OrderRoutingAnimation'
import { isLive } from '@/api/http/env'

type OrderType = 'MARKET' | 'LIMIT'

/**
 * Whether a user can close this position by hand.
 *
 * **True in live mode as of APP-114** (BKT-018 / contracts §17). bkt now has a
 * user-initiated exit route, and it is the monitor's own path with the rule
 * evaluation removed: the price is measured from the current mnd quote through
 * the exit fill model, the reason is fixed server-side to `USER_CLOSE`, and the
 * EXIT row is written before plt is told. Nothing about the fill is supplied by
 * this browser, which is exactly why the button may exist now and could not
 * before.
 *
 * The one live case that is still unavailable: a position plt did not link to a
 * silent trade. `POST /executions/exits` takes a `silent_trade_id` and nothing
 * else, and there is no id the app could invent in its place.
 */
export function isManualCloseAvailable(position?: Pick<Position, 'silentTradeId'>): boolean {
  if (!isLive('portfolio')) return true
  return position?.silentTradeId !== undefined
}

/**
 * Closing a position by hand.
 *
 * Two genuinely different products behind one entry point, chosen by data mode
 * rather than by a prop:
 *
 *  - **live** — a *request to exit*. No limit price and no partial quantity,
 *    because bkt's deterministic fill model takes neither: the whole trade
 *    closes at the price the model computes from the current quote. The ticket
 *    that showed a limit field would be promising control the backend does not
 *    offer.
 *  - **mock** — the demo's simulated brokerage close, untouched, with its
 *    quantity slider, limit/market toggle and routing animation. It writes to a
 *    demo book and its copy says so.
 */
export function ManualCloseTicket(props: {
  position: Position
  price: number
  /** Prior session's option mark, used to derive the simulated last price. */
  previousClose?: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (isLive('portfolio')) {
    return (
      <SilentExitTicket
        position={props.position}
        price={props.price}
        open={props.open}
        onOpenChange={props.onOpenChange}
      />
    )
  }
  return <SimulatedCloseTicket {...props} />
}

/**
 * The live path: `POST /bkt/api/v1/executions/exits` (contracts §17).
 *
 * Key discipline is the same as the open ticket's (D6) and matters more here:
 * a close is a live operation a human retries on a slow network. A failed
 * *request* keeps its key, so a retry is answered with the recorded outcome
 * (200) rather than a second attempt against a newer quote. A returned
 * *outcome* — FILLED or NO_FILL — ends the operation, and a deliberate second
 * try after a NO_FILL mints a fresh key, because a NO_FILL left the position
 * open and a new attempt is a new operation.
 */
function SilentExitTicket({
  position,
  price,
  open,
  onOpenChange,
}: {
  position: Position
  price: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [order, setOrder] = useState<Order | null>(null)
  const operationId = useRef(newIdempotencyKey('exit'))
  const requestExit = useRequestExit()
  const available = isManualCloseAvailable(position)

  useEffect(() => {
    if (!open) return
    setOrder(null)
    operationId.current = newIdempotencyKey('exit')
    requestExit.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, position.id])

  const error = requestExit.error instanceof ApiError ? requestExit.error : undefined

  const send = async () => {
    if (!available) return
    let result: Order
    try {
      result = await requestExit.mutateAsync({
        positionId: position.id,
        silentTradeId: position.silentTradeId,
        symbol: position.symbol,
        quantity: position.quantity,
        idempotencyKey: idempotencyKeys.keyFor(operationId.current, 'exit'),
      })
    } catch {
      // The request failed, so the operation is *not* over and its key is
      // deliberately kept: "Hold to retry" re-sends the same operation and bkt
      // answers with whatever it recorded, if anything.
      return
    }
    idempotencyKeys.retireOperation(operationId.current)
    setOrder(result)
  }

  const startNewAttempt = () => {
    operationId.current = newIdempotencyKey('exit')
    requestExit.reset()
    setOrder(null)
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        order ? (
          'Exit result'
        ) : (
          <span className="-mt-[2mm] flex min-w-0 items-baseline gap-2">
            <span className="shrink-0">Close {position.symbol}</span>
            <span className="num min-w-0 truncate text-[14px] font-bold text-ink uppercase">
              {position.contractDetail ?? ''}
            </span>
          </span>
        )
      }
      description={
        order ? undefined : 'Silent paper exit — nothing is routed to a broker.'
      }
      className="sm:w-[min(500px,calc(100vw-2rem))]"
      footer={
        order ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Done
            </Button>
            {/* Only a NO_FILL leaves anything to try again: a fill closed the
                position, and trying again would have nothing to close. */}
            {order.status === 'NO_FILL' ? (
              <Button onClick={startNewAttempt}>Try again</Button>
            ) : null}
          </div>
        ) : !available ? (
          <Button variant="secondary" className="w-full" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        ) : (
          <div className="grid grid-cols-[0.8fr_1.2fr] gap-2">
            <Button
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={requestExit.isPending}
            >
              Cancel
            </Button>
            <HoldToConfirmButton
              variant="success"
              pending={requestExit.isPending}
              onComplete={() => void send()}
            >
              <SendHorizontal size={15} />
              {error ? 'Hold to retry' : 'Hold to request exit'}
            </HoldToConfirmButton>
          </div>
        )
      }
    >
      {order ? (
        <ExitOutcome order={order} mark={price} />
      ) : !available ? (
        <Notice>
          This position is not linked to a silent trade, and the execution service closes silent
          trades by id. There is no id to stand in for it, so closing by hand is unavailable for
          this row.
        </Notice>
      ) : (
        <div className="space-y-3">
          <dl className="liquid-inset space-y-2.5 rounded-[18px] p-3.5">
            <CloseRow label="Closing" value={`${formatQty(position.quantity)} contracts`} emphasis />
            <CloseRow label="Mark on this screen" value={formatMoney(price)} />
            <CloseRow label="Exit reason" value="USER_CLOSE" />
          </dl>

          <Notice tone="brand">
            The whole position closes at the price the execution service computes from the current
            quote — there is no limit price to set, and the fill may differ from the mark above.
            The reason is recorded as <code>USER_CLOSE</code>.
          </Notice>

          {error ? <ExitRequestError error={error} /> : null}
        </div>
      )}
    </Modal>
  )
}

/**
 * A failed *request*, typed by what bkt actually answers (§17).
 *
 * The distinction each message has to carry is whether anything was recorded:
 * a 503 recorded nothing and the position is untouched, a 409 means someone
 * else's exit already stands, and a 404 means the trade is not plt's at all.
 */
function ExitRequestError({ error }: { error: ApiError }) {
  const detail =
    error.status === 404
      ? 'The platform service has no such silent trade. Nothing was closed.'
      : error.status === 409
        ? 'This trade is already closed — its recorded exit stands and is not overwritten. Reload the position list to see it.'
        : error.status === 503
          ? 'No current quote for this contract, or the platform service could not be read. Nothing was recorded and the position is unchanged.'
          : error.isRetryable
            ? 'Retrying re-sends the same request under the same idempotency key, so a close that did go through is replayed rather than repeated.'
            : 'This request was refused before anything was recorded.'
  return (
    <div className="rounded-xl bg-down-soft px-3 py-2.5 text-[12.5px] text-down">
      <p className="font-semibold">{error.message}</p>
      <p className="mt-1 text-[11.5px] text-down/85">{detail}</p>
    </div>
  )
}

/**
 * The two honest endings of an exit attempt.
 *
 * `NO_FILL` is a *successful* 201 that closed nothing: the position stays
 * OPEN, the attempt is a durable row, and saying so is the whole point — "your
 * close did not go through" is information the user needs.
 */
function ExitOutcome({ order, mark }: { order: Order; mark: number }) {
  const filled = order.status === 'FILLED'
  const platformError = filled && order.reportedToPlatform === false
  // The model's fill price is not the number the user was looking at. Saying
  // which is which is the difference between a fill and a claim.
  const differsFromMark = order.price !== undefined && Math.abs(order.price - mark) >= 0.005

  return (
    <div className="space-y-3.5">
      <div className="py-1 text-center">
        <div
          className={cn(
            'liquid-inset mx-auto grid h-14 w-14 place-items-center rounded-full',
            filled && 'border-up/25 bg-up-soft',
          )}
        >
          {filled ? (
            <CheckCircle2 size={30} className="text-up" strokeWidth={2.2} />
          ) : (
            <CircleSlash size={28} className="text-ink-muted" strokeWidth={2.2} />
          )}
        </div>
        <h3 className="mt-3 text-[19px] font-extrabold tracking-[-0.02em] text-ink">
          {filled ? 'Position closed' : 'No fill — still open'}
        </h3>
        <p className="mx-auto mt-1.5 max-w-[360px] text-[13px] leading-relaxed text-ink-soft">
          {filled
            ? 'The exit filled against the current quote and the trade is closed.'
            : 'The exit was evaluated and did not fill. Your position is still open and unchanged — nothing was sold.'}
        </p>
      </div>

      {order.replayed ? (
        <Notice>
          This close had already been recorded under the same key. The recorded outcome was replayed
          — nothing was re-simulated and no second exit was attempted.
        </Notice>
      ) : null}

      {platformError ? (
        <div className="rounded-xl border border-[#f5c26b]/30 bg-[#f5c26b]/10 px-3 py-2.5 text-[12.5px] text-[#f5c26b]">
          <p className="font-semibold">Closed, but the platform service was not updated.</p>
          <p className="mt-1 leading-relaxed">
            {order.platformError ?? 'The execution service could not report the close.'} The exit is
            durable and reconciliation will pick it up. Do not close again.
          </p>
        </div>
      ) : null}

      <dl className="liquid-inset space-y-2.5 rounded-[18px] p-3.5 text-left">
        {order.contractDetail ? <CloseRow label="Contract" value={order.contractDetail} /> : null}
        <CloseRow label="Quantity" value={`${formatQty(order.quantity)} contracts`} />
        {order.price === undefined ? null : (
          <CloseRow label="Model fill price" value={formatMoney(order.price)} emphasis />
        )}
        {order.estimatedValue === undefined ? null : (
          <CloseRow label="Proceeds" value={formatMoney(order.estimatedValue)} />
        )}
        {order.reasonCode ? <CloseRow label="Reason" value={order.reasonCode} /> : null}
        {order.exitReason ? <CloseRow label="Exit reason" value={order.exitReason} /> : null}
        {order.executionId ? <CloseRow label="Execution" value={order.executionId} /> : null}
      </dl>

      {filled && differsFromMark ? (
        <p className="text-[11.5px] leading-relaxed text-ink-muted">
          The fill price is the execution service's, computed from the quote it read at close time
          through its fill model. It differs from the {formatMoney(mark)} mark shown a moment ago,
          and the fill — not the mark — is what was recorded.
        </p>
      ) : null}

      {!filled && order.sessionOnly ? (
        <p className="text-[11.5px] leading-relaxed text-ink-muted">
          The attempt is recorded by the execution service, but it opened and closed nothing, so no
          row for it exists in the platform service's history (HKP-BKT-4). It is kept here for this
          session only.
        </p>
      ) : null}
    </div>
  )
}

function Notice({ children, tone }: { children: React.ReactNode; tone?: 'brand' }) {
  return (
    <div
      className={cn(
        'liquid-inset flex items-start gap-2 rounded-[16px] px-3 py-3 text-[12.5px] leading-relaxed',
        tone === 'brand' ? 'border-brand-400/15 text-[#cfe4ff]' : 'text-ink-soft',
      )}
    >
      <Info size={15} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

function SimulatedCloseTicket({
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
                {/* Demo book only: this ticket does not render in live mode,
                    where positions sit in one paper portfolio with no
                    brokerage to send to (HKP-PLT-6). */}
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
