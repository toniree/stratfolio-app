import { useEffect, useMemo, useRef, useState } from 'react'
import { Info, Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatMoney, formatQty } from '@/lib/format'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { HoldToConfirmButton } from '@/components/ui/HoldToConfirmButton'
import { OrderRoutingAnimation } from '@/components/trade/OrderRoutingAnimation'
import { BrokerageBadge } from '@/components/shared/BrokerageBadge'
import { RecommendationChip } from '@/components/intelligence/TradeRecommendation'
import { useSubmitOrder } from '@/hooks/queries'
import type { Order, OrderSide, Position } from '@/api/types'

type Step = 'ticket' | 'review' | 'submitted'

interface TradeTicketProps {
  position: Position
  price: number
  open: boolean
  onOpenChange: (open: boolean) => void
  initialSide?: OrderSide
}

/**
 * Mock order entry: ticket → review → submitted.
 *
 * Submitting is deliberately non-destructive. A real fill arrives
 * asynchronously from a broker, so the position is never removed here — the
 * order simply lands in Activity as SUBMITTED.
 */
export function TradeTicket({
  position,
  price,
  open,
  onOpenChange,
  initialSide = 'SELL',
}: TradeTicketProps) {
  const [step, setStep] = useState<Step>('ticket')
  const [side, setSide] = useState<OrderSide>(initialSide)
  const [qtyText, setQtyText] = useState(String(Math.max(1, Math.floor(position.quantity / 3))))
  const [order, setOrder] = useState<Order | null>(null)
  const submitOrder = useSubmitOrder()
  const onOpenChangeRef = useRef(onOpenChange)
  onOpenChangeRef.current = onOpenChange

  const isOption = position.assetType === 'option'
  const contractMultiplier = isOption ? 100 : 1
  const unit = isOption ? 'contracts' : 'shares'

  const quantity = useMemo(() => {
    const parsed = Number(qtyText)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  }, [qtyText])

  const estimatedValue = quantity * price * contractMultiplier
  const exceedsHolding = side === 'SELL' && quantity > position.quantity
  const canReview = quantity > 0 && !exceedsHolding

  // Reset to a clean ticket each time the dialog opens.
  useEffect(() => {
    if (open) {
      setStep('ticket')
      setSide(initialSide)
      setQtyText(String(Math.max(1, Math.floor(position.quantity / 3))))
      setOrder(null)
      submitOrder.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialSide, position.quantity])

  useEffect(() => {
    if (step !== 'submitted') return
    const timeout = window.setTimeout(() => onOpenChangeRef.current(false), 2500)
    return () => window.clearTimeout(timeout)
  }, [step])

  const adjust = (delta: number) => {
    setQtyText((current) => {
      const next = Math.max(1, (Number(current) || 0) + delta)
      return String(next)
    })
  }

  const handleSubmit = async () => {
    const result = await submitOrder.mutateAsync({
      symbol: position.symbol,
      side,
      quantity,
      estimatedPrice: price,
      brokerageId: position.brokerageId,
      positionId: position.id,
    })
    setOrder(result)
    setStep('submitted')
  }

  const titles: Record<Step, string> = {
    ticket: `${side === 'BUY' ? 'Buy' : 'Sell'} ${position.symbol}`,
    review: 'Review order',
    submitted: 'Order submitted',
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="wide"
      showCloseButton={step !== 'submitted'}
      className={step === 'submitted' ? 'order-confirmation' : undefined}
      title={titles[step]}
      description={
        step === 'submitted'
          ? undefined
          : `${position.company}${position.contractDetail ? ` · ${position.contractDetail}` : ''}`
      }
      footer={
        step === 'ticket' ? (
          <Button className="w-full" size="lg" disabled={!canReview} onClick={() => setStep('review')}>
            Review order
          </Button>
        ) : step === 'review' ? (
          <div className="flex gap-2.5">
            <Button
              variant="secondary"
              size="lg"
              className="flex-1"
              onClick={() => setStep('ticket')}
              disabled={submitOrder.isPending}
            >
              Back
            </Button>
            <HoldToConfirmButton
              variant="success"
              size="lg"
              className="flex-[1.6]"
              pending={submitOrder.isPending}
              onComplete={() => void handleSubmit()}
            >
              {`Hold to submit ${side === 'BUY' ? 'buy' : 'sell'}`}
            </HoldToConfirmButton>
          </div>
        ) : undefined
      }
    >
      {step === 'ticket' ? (
        <TicketBody
          position={position}
          price={price}
          side={side}
          onSideChange={setSide}
          qtyText={qtyText}
          onQtyChange={setQtyText}
          onAdjust={adjust}
          quantity={quantity}
          estimatedValue={estimatedValue}
          exceedsHolding={exceedsHolding}
          unit={unit}
          isOption={isOption}
        />
      ) : step === 'review' ? (
        <TradeReviewModal
          position={position}
          side={side}
          quantity={quantity}
          price={price}
          estimatedValue={estimatedValue}
          unit={unit}
          error={submitOrder.isError ? 'Something went wrong. Try again.' : undefined}
        />
      ) : (
        <SubmittedBody order={order} unit={unit} />
      )}
    </Modal>
  )
}

function TicketBody(props: {
  position: Position
  price: number
  side: OrderSide
  onSideChange: (side: OrderSide) => void
  qtyText: string
  onQtyChange: (value: string) => void
  onAdjust: (delta: number) => void
  quantity: number
  estimatedValue: number
  exceedsHolding: boolean
  unit: string
  isOption: boolean
}) {
  const {
    position,
    price,
    side,
    onSideChange,
    qtyText,
    onQtyChange,
    onAdjust,
    estimatedValue,
    exceedsHolding,
    unit,
    isOption,
  } = props

  return (
    <div className="space-y-4">
      <div className="liquid-inset grid grid-cols-2 gap-1.5 rounded-full p-1">
        {(['BUY', 'SELL'] as OrderSide[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onSideChange(option)}
            aria-pressed={side === option}
            className={cn(
              'rounded-full py-2 text-[13.5px] font-bold transition-colors',
              side === option
                ? option === 'BUY'
                  ? 'bg-white/[0.07] text-up shadow-sm'
                  : 'bg-white/[0.07] text-down shadow-sm'
                : 'text-ink-muted',
            )}
          >
            {option === 'BUY' ? 'Buy' : 'Sell'}
          </button>
        ))}
      </div>

      <div>
        <label
          htmlFor="trade-qty"
          className="mb-1.5 block text-[11px] font-bold tracking-[0.07em] text-ink-muted uppercase"
        >
          Quantity ({unit})
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Decrease quantity"
            onClick={() => onAdjust(-1)}
            className="liquid-control grid h-11 w-11 shrink-0 place-items-center rounded-xl text-ink-soft active:scale-95"
          >
            <Minus size={16} />
          </button>
          <input
            id="trade-qty"
            inputMode="decimal"
            value={qtyText}
            onChange={(e) => onQtyChange(e.target.value.replace(/[^\d.]/g, ''))}
            className="liquid-control num h-11 min-w-0 flex-1 rounded-xl px-3 text-center text-[18px] font-bold text-ink outline-none"
          />
          <button
            type="button"
            aria-label="Increase quantity"
            onClick={() => onAdjust(1)}
            className="liquid-control grid h-11 w-11 shrink-0 place-items-center rounded-xl text-ink-soft active:scale-95"
          >
            <Plus size={16} />
          </button>
        </div>
        {exceedsHolding ? (
          <p className="mt-1.5 text-[12px] font-semibold text-down">
            You hold {formatQty(position.quantity)} {unit}.
          </p>
        ) : (
          <p className="mt-1.5 text-[12px] text-ink-muted">
            You hold {formatQty(position.quantity)} {unit} at {formatMoney(position.avgCost)} average
            premium.
          </p>
        )}
      </div>

      <dl className="liquid-inset space-y-2.5 rounded-[18px] p-3.5">
        <Row label="Order type" value="Market" />
        <Row label="Contract mark" value={formatMoney(price)} />
        {isOption ? <Row label="Contract multiplier" value="× 100" /> : null}
        <Row
          label="Estimated value"
          value={formatMoney(estimatedValue)}
          emphasis
        />
        <div className="flex items-center justify-between gap-2 border-t border-line pt-2.5">
          <dt className="text-[12.5px] text-ink-soft">Routed to</dt>
          <dd>
            {/* Live positions belong to one paper portfolio and have no
                brokerage to route to (HKP-PLT-6). */}
            {position.brokerageId ? (
              <BrokerageBadge id={position.brokerageId} showName showMask size="sm" />
            ) : (
              <span className="text-[12.5px] font-semibold text-ink">Paper account</span>
            )}
          </dd>
        </div>
      </dl>

      <div className="liquid-inset flex items-start gap-2 rounded-[16px] border-brand-400/15 px-3 py-2.5 text-[12px] leading-relaxed text-brand-200">
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          Simulated order. Nothing is routed to a real broker and no position is removed from your
          portfolio.
        </span>
      </div>
    </div>
  )
}

/** The review step — a deliberate confirmation gate before anything is sent. */
export function TradeReviewModal({
  position,
  side,
  quantity,
  price,
  estimatedValue,
  unit,
  error,
}: {
  position: Position
  side: OrderSide
  quantity: number
  price: number
  estimatedValue: number
  unit: string
  error?: string
}) {
  return (
    <div className="space-y-4">
      <div className="liquid-inset rounded-[18px] p-4">
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              'text-[22px] font-extrabold tracking-[-0.02em]',
              side === 'BUY' ? 'text-up' : 'text-down',
            )}
          >
            {side === 'BUY' ? 'Buy' : 'Sell'}
          </span>
          <span className="num text-[22px] font-extrabold tracking-[-0.02em] text-ink">
            {formatQty(quantity)} {position.symbol}
          </span>
        </div>
        <p className="mt-1 text-[13px] text-ink-soft">
          {[position.company, position.contractDetail].filter(Boolean).join(' · ')}
        </p>
      </div>

      <dl className="space-y-2.5">
        <Row label="Order type" value="Market · Good for day" />
        <Row label="Quantity" value={`${formatQty(quantity)} ${unit}`} />
        <Row label="Estimated premium" value={formatMoney(price)} />
        <Row label="Estimated total" value={formatMoney(estimatedValue)} emphasis />
        <Row label="Estimated commission" value="$0.00" />
      </dl>

      {position.ai ? (
        <div className="liquid-inset flex items-start gap-2.5 rounded-[18px] border-brand-400/20 p-3.5">
          <RecommendationChip recommendation={position.ai.recommendation} />
          <p className="text-[12.5px] leading-relaxed text-ink-soft">
            StratFolio AI currently rates {position.symbol} at{' '}
            <span className="font-bold text-ink">{position.ai.conviction}/100</span> conviction.{' '}
            {position.ai.recommendationNote}
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl bg-down-soft px-3 py-2.5 text-[12.5px] font-semibold text-down">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/**
 * The four outcomes a silent-execution attempt can end in.
 *
 * `NO_FILL` is a *successful* bkt response (201) that leaves no silent-trade
 * row, and `platform_error` means bkt executed but could not tell plt — both
 * are recoverable states, not errors and not success toasts (D3, §7.8). The
 * ticket that actually submits these lands in Wave B (APP-112); the labels
 * exist now so no code path can render a NO_FILL as "awaiting fill".
 */
const ORDER_STATUS_LABEL: Record<Order['status'], string> = {
  SUBMITTED: 'Submitted · awaiting fill',
  FILLED: 'Filled',
  NO_FILL: 'No fill · nothing was opened',
  REJECTED: 'Rejected by policy',
}

function SubmittedBody({ order, unit }: { order: Order | null; unit: string }) {
  if (!order) return null
  return (
    <div className="py-2 text-center">
      {order.brokerageId ? <OrderRoutingAnimation brokerageId={order.brokerageId} /> : null}

      <h3 className="mt-4 text-[19px] font-extrabold tracking-[-0.02em] text-ink">
        Order submitted ✓
      </h3>
      <p className="mx-auto mt-1.5 max-w-[340px] text-[13px] leading-relaxed text-ink-soft">
        {order.side === 'BUY' ? 'Buy' : 'Sell'} {formatQty(order.quantity)} {unit} of{' '}
        {order.symbol}
        {order.price === undefined ? '' : ` at approximately ${formatMoney(order.price)}`}.
      </p>

      <dl className="liquid-inset mt-4 space-y-2.5 rounded-[18px] p-3.5 text-left">
        <Row label="Order ID" value={order.id.toUpperCase()} />
        <Row label="Status" value={ORDER_STATUS_LABEL[order.status]} />
        {order.estimatedValue === undefined ? null : (
          <Row label="Estimated total" value={formatMoney(order.estimatedValue)} emphasis />
        )}
      </dl>

      <p className="mt-3.5 text-[12px] leading-relaxed text-ink-muted">
        Your position stays open until the broker confirms a fill. Track this order in the Activity
        tab.
      </p>
    </div>
  )
}

function Row({
  label,
  value,
  emphasis,
}: {
  label: string
  value: string
  emphasis?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[12.5px] text-ink-soft">{label}</dt>
      <dd
        className={cn(
          'num truncate text-right text-[13px] font-semibold text-ink',
          emphasis && 'text-[15px] font-extrabold',
        )}
      >
        {value}
      </dd>
    </div>
  )
}
