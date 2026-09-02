import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, CircleSlash, Info, Minus, Plus, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatMoney, formatPercent, formatQty } from '@/lib/format'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { HoldToConfirmButton } from '@/components/ui/HoldToConfirmButton'
import { ProvenanceTag, StaleTag } from '@/components/shared/ProvenanceTag'
import { useSubmitOrder } from '@/hooks/queries'
import { isMarketLive, useLiveChain, useMarketSnapshot } from '@/hooks/marketQueries'
import { idempotencyKeys, newIdempotencyKey } from '@/api/http/idempotency'
import { ADVISORY_CAPS, EXECUTION_MODE, MIN_DTE, RISK_PROFILE } from '@/api/http/policy'
import { ApiError } from '@/api/http/problem'
import type { OptionQuote } from '@/api/marketData/types'
import type { Order, OrderContract, Provenance } from '@/api/types'

type Step = 'select' | 'review' | 'outcome'

/**
 * The silent-execution ticket (APP-112).
 *
 * What it is not: a brokerage order pad. There is no order type, no
 * time-in-force, no commission line and no routing destination, because
 * nothing downstream has any of those — plt validates a *plan* and bkt
 * *simulates* a fill against recorded market data. The copy says so.
 *
 * Three things here are load-bearing:
 *
 *  1. **Contract identity comes from the chain, not the browser.** Strike,
 *     expiration, DTE and mid are the server's numbers (B0). bkt re-resolves
 *     the contract and refuses a plan it cannot match, so a locally derived
 *     strike is not a shortcut — it is a rejection.
 *  2. **Policy inputs are pinned constants** (D11, `http/policy.ts`). Nothing
 *     on this screen sets `execution_mode` or `risk_profile`.
 *  3. **Key discipline** (D6). One logical operation gets one key. A failed
 *     *request* keeps it, so a retry replays rather than double-opens. A
 *     returned *outcome* — FILLED, NO_FILL, REJECTED — ends the operation, and
 *     "place another" mints a fresh key.
 */
export function OpenOptionTicket({
  symbol,
  open,
  onOpenChange,
  thesisId,
  initialExpiration,
  initialRight = 'CALL',
}: {
  symbol: string
  open: boolean
  onOpenChange: (open: boolean) => void
  thesisId?: string
  initialExpiration?: string
  initialRight?: 'CALL' | 'PUT'
}) {
  const live = isMarketLive()
  const [step, setStep] = useState<Step>('select')
  const [right, setRight] = useState<'CALL' | 'PUT'>(initialRight)
  const [expiration, setExpiration] = useState<string | undefined>(initialExpiration)
  const [occSymbol, setOccSymbol] = useState<string | undefined>()
  const [qtyText, setQtyText] = useState('1')
  const [order, setOrder] = useState<Order | null>(null)

  // Identifies the *logical operation*, not the request. Stable across
  // re-renders and retries; replaced only when the user starts a new attempt.
  const operationId = useRef(newIdempotencyKey('ticket'))
  const submitOrder = useSubmitOrder()

  const snapshot = useMarketSnapshot(symbol, { enabled: open && live })
  const expirations = snapshot.data?.chainSummary?.expirations ?? []
  const chosenExpiration = expiration ?? expirations[0]
  const chain = useLiveChain(symbol, {
    expiration: chosenExpiration,
    enabled: open && live && Boolean(chosenExpiration),
  })

  const contracts = useMemo(
    () =>
      (chain.data?.contracts ?? [])
        .filter((c) => c.right === right && c.dte >= MIN_DTE)
        .sort((a, b) => a.strike - b.strike),
    [chain.data, right],
  )
  const selected = contracts.find((c) => c.occSymbol === occSymbol)
  const quantity = Number.parseInt(qtyText, 10) > 0 ? Number.parseInt(qtyText, 10) : 0
  const mid = selected?.mid
  const estimatedCost = mid === undefined ? undefined : mid * quantity * 100

  const overContractCap = quantity > ADVISORY_CAPS.maxContractsPerTrade
  const overCapitalCap =
    estimatedCost !== undefined && estimatedCost > ADVISORY_CAPS.maxCapitalPerTrade

  useEffect(() => {
    if (!open) return
    setStep('select')
    setRight(initialRight)
    setExpiration(initialExpiration)
    setOccSymbol(undefined)
    setQtyText('1')
    setOrder(null)
    operationId.current = newIdempotencyKey('ticket')
    submitOrder.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, symbol, initialExpiration, initialRight])

  const submitError = submitOrder.error instanceof ApiError ? submitOrder.error : undefined

  const handleSubmit = async () => {
    if (!selected) return
    const contract: OrderContract = {
      occSymbol: selected.occSymbol,
      right: selected.right,
      strike: selected.strike,
      expiry: selected.expiration,
      dte: selected.dte,
      mid: selected.mid,
      bid: selected.bid,
      ask: selected.ask,
      underlyingPrice: selected.underlyingPrice,
    }
    let result: Order
    try {
      result = await submitOrder.mutateAsync({
        symbol,
        side: 'BUY',
        intent: 'open',
        quantity,
        estimatedPrice: selected.mid ?? selected.ask ?? 0,
        contract,
        thesisId,
        // Same key for every retry of *this* attempt; plt replays a recorded
        // plan and bkt replays a recorded outcome rather than opening twice.
        idempotencyKey: idempotencyKeys.keyFor(operationId.current, 'open'),
      })
    } catch {
      // The request failed, so the operation is *not* finished and its key is
      // deliberately kept: the user stays on review, and "Hold to retry"
      // re-sends the same operation. The mutation's error state renders below.
      return
    }
    // An outcome came back, so this operation is finished. A deliberate second
    // attempt is a new operation and must not replay this one (D6).
    idempotencyKeys.retireOperation(operationId.current)
    setOrder(result)
    setStep('outcome')
  }

  const startNewAttempt = () => {
    operationId.current = newIdempotencyKey('ticket')
    submitOrder.reset()
    setOrder(null)
    setStep('select')
  }

  const titles: Record<Step, string> = {
    select: `Open ${symbol}`,
    review: 'Review silent execution',
    outcome: 'Execution result',
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="wide"
      title={titles[step]}
      description={step === 'outcome' ? undefined : 'Silent paper execution — nothing is routed to a broker.'}
      footer={
        step === 'select' ? (
          <Button
            className="w-full"
            size="lg"
            disabled={!selected || quantity <= 0}
            onClick={() => setStep('review')}
          >
            Review
          </Button>
        ) : step === 'review' ? (
          <div className="flex gap-2.5">
            <Button
              variant="secondary"
              size="lg"
              className="flex-1"
              onClick={() => setStep('select')}
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
              {submitError ? 'Hold to retry' : 'Hold to execute silently'}
            </HoldToConfirmButton>
          </div>
        ) : (
          <div className="flex gap-2.5">
            <Button variant="secondary" size="lg" className="flex-1" onClick={() => onOpenChange(false)}>
              Done
            </Button>
            <Button size="lg" className="flex-1" onClick={startNewAttempt}>
              Place another
            </Button>
          </div>
        )
      }
    >
      {!live ? (
        <UnavailableBody />
      ) : step === 'select' ? (
        <SelectBody
          symbol={symbol}
          right={right}
          onRightChange={setRight}
          expirations={expirations}
          expiration={chosenExpiration}
          onExpirationChange={(value) => {
            setExpiration(value)
            setOccSymbol(undefined)
          }}
          contracts={contracts}
          loading={chain.isLoading || snapshot.isLoading}
          error={chain.isError || snapshot.isError}
          occSymbol={occSymbol}
          onSelect={setOccSymbol}
          qtyText={qtyText}
          onQtyChange={setQtyText}
          estimatedCost={estimatedCost}
          overContractCap={overContractCap}
          overCapitalCap={overCapitalCap}
          provenance={chain.data?.provenance}
          stale={chain.data?.staleness?.stale}
        />
      ) : step === 'review' ? (
        <ReviewBody
          symbol={symbol}
          contract={selected}
          quantity={quantity}
          estimatedCost={estimatedCost}
          error={submitError}
        />
      ) : (
        <OutcomeBody order={order} />
      )}
    </Modal>
  )
}

function UnavailableBody() {
  return (
    <div className="liquid-inset flex items-start gap-2 rounded-[16px] px-3 py-3 text-[12.5px] leading-relaxed text-ink-soft">
      <Info size={15} className="mt-0.5 shrink-0" />
      <span>
        Opening a position needs the live options chain: the contract has to be a real one the
        execution service can re-resolve. Point <code>VITE_DATA_MARKET</code> and{' '}
        <code>VITE_DATA_PORTFOLIO</code> at <code>live</code> to enable it.
      </span>
    </div>
  )
}

function SelectBody(props: {
  symbol: string
  right: 'CALL' | 'PUT'
  onRightChange: (right: 'CALL' | 'PUT') => void
  expirations: string[]
  expiration?: string
  onExpirationChange: (value: string) => void
  contracts: OptionQuote[]
  loading: boolean
  error: boolean
  occSymbol?: string
  onSelect: (occSymbol: string) => void
  qtyText: string
  onQtyChange: (value: string) => void
  estimatedCost?: number
  overContractCap: boolean
  overCapitalCap: boolean
  provenance?: Provenance
  stale?: boolean
}) {
  const { contracts, occSymbol } = props
  return (
    <div className="space-y-4">
      <div className="liquid-inset grid grid-cols-2 gap-1.5 rounded-full p-1">
        {(['CALL', 'PUT'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => props.onRightChange(option)}
            aria-pressed={props.right === option}
            className={cn(
              'rounded-full py-2 text-[13.5px] font-bold transition-colors',
              props.right === option ? 'bg-white/[0.07] text-ink shadow-sm' : 'text-ink-muted',
            )}
          >
            {option === 'CALL' ? 'Call' : 'Put'}
          </button>
        ))}
      </div>

      <div>
        <label
          htmlFor="ticket-expiration"
          className="mb-1.5 block text-[11px] font-bold tracking-[0.07em] text-ink-muted uppercase"
        >
          Expiration
        </label>
        <select
          id="ticket-expiration"
          value={props.expiration ?? ''}
          onChange={(event) => props.onExpirationChange(event.target.value)}
          className="liquid-control h-11 w-full rounded-xl px-3 text-[14px] font-semibold text-ink outline-none"
        >
          {props.expirations.length === 0 ? <option value="">No expirations available</option> : null}
          {props.expirations.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        {/* The expiration list comes from the snapshot's whole-chain roll-up,
            which stays correct even when a chain *page* is truncated (§15.4). */}
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold tracking-[0.07em] text-ink-muted uppercase">
            Contract
          </span>
          <span className="flex items-center gap-1.5">
            <ProvenanceTag provenance={props.provenance} />
            <StaleTag stale={props.stale} />
          </span>
        </div>
        {props.error ? (
          <p className="text-[12.5px] font-semibold text-down">
            The chain could not be loaded. Nothing is guessed in its place.
          </p>
        ) : props.loading ? (
          <p className="text-[12.5px] text-ink-muted">Loading the chain…</p>
        ) : contracts.length === 0 ? (
          <p className="text-[12.5px] text-ink-muted">
            No {props.right.toLowerCase()} contracts at this expiration with {MIN_DTE}+ days to
            expiry.
          </p>
        ) : (
          <ul
            className="liquid-inset max-h-[220px] space-y-px overflow-y-auto rounded-[16px] p-1"
            aria-label="Option contracts"
          >
            {contracts.map((contract) => (
              <li key={contract.occSymbol}>
                <button
                  type="button"
                  onClick={() => props.onSelect(contract.occSymbol)}
                  aria-pressed={occSymbol === contract.occSymbol}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left transition-colors',
                    occSymbol === contract.occSymbol ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]',
                  )}
                >
                  <span className="num text-[13px] font-bold text-ink">
                    ${contract.strike}
                    <span className="ml-1.5 text-[10.5px] font-semibold text-ink-muted">
                      {contract.dte}d
                    </span>
                  </span>
                  <span className="num flex items-center gap-2.5 text-[11.5px] text-ink-soft">
                    {/* Server numbers or nothing: the in-browser IV model does
                        not run in live mode (§6). */}
                    <Cell label="Bid" value={contract.bid} />
                    <Cell label="Ask" value={contract.ask} />
                    <Cell label="Mid" value={contract.mid} emphasis />
                    <span className="text-[10.5px] text-ink-muted">
                      IV{' '}
                      {contract.impliedVolatility === undefined
                        ? '—'
                        : formatPercent(contract.impliedVolatility * 100, 0)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <label
          htmlFor="ticket-qty"
          className="mb-1.5 block text-[11px] font-bold tracking-[0.07em] text-ink-muted uppercase"
        >
          Contracts
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Decrease quantity"
            onClick={() => props.onQtyChange(String(Math.max(1, (Number(props.qtyText) || 0) - 1)))}
            className="liquid-control grid h-11 w-11 shrink-0 place-items-center rounded-xl text-ink-soft active:scale-95"
          >
            <Minus size={16} />
          </button>
          <input
            id="ticket-qty"
            inputMode="numeric"
            value={props.qtyText}
            onChange={(event) => props.onQtyChange(event.target.value.replace(/[^\d]/g, ''))}
            className="liquid-control num h-11 min-w-0 flex-1 rounded-xl px-3 text-center text-[18px] font-bold text-ink outline-none"
          />
          <button
            type="button"
            aria-label="Increase quantity"
            onClick={() => props.onQtyChange(String((Number(props.qtyText) || 0) + 1))}
            className="liquid-control grid h-11 w-11 shrink-0 place-items-center rounded-xl text-ink-soft active:scale-95"
          >
            <Plus size={16} />
          </button>
        </div>
        {props.estimatedCost === undefined ? (
          <p className="mt-1.5 text-[12px] text-ink-muted">
            No mid quote for this contract — the cost cannot be estimated.
          </p>
        ) : (
          <p className="mt-1.5 text-[12px] text-ink-muted">
            About {formatMoney(props.estimatedCost)} at the current mid, before slippage.
          </p>
        )}
        {props.overContractCap || props.overCapitalCap ? (
          <p className="mt-1.5 flex items-start gap-1.5 text-[12px] font-semibold text-down">
            <ShieldAlert size={13} className="mt-0.5 shrink-0" />
            <span>
              Above the default policy cap ({ADVISORY_CAPS.maxContractsPerTrade} contracts /{' '}
              {formatMoney(ADVISORY_CAPS.maxCapitalPerTrade, { whole: true })}). The platform
              service decides — this is a warning, not the rule.
            </span>
          </p>
        ) : null}
      </div>
    </div>
  )
}

function Cell({ label, value, emphasis }: { label: string; value?: number; emphasis?: boolean }) {
  return (
    <span className={cn('text-[10.5px] text-ink-muted', emphasis && 'text-[11.5px] text-ink')}>
      {label} {value === undefined ? '—' : formatMoney(value)}
    </span>
  )
}

function ReviewBody({
  symbol,
  contract,
  quantity,
  estimatedCost,
  error,
}: {
  symbol: string
  contract?: OptionQuote
  quantity: number
  estimatedCost?: number
  error?: ApiError
}) {
  if (!contract) return null
  return (
    <div className="space-y-4">
      <div className="liquid-inset rounded-[18px] p-4">
        <div className="flex items-baseline gap-2">
          <span className="text-[22px] font-extrabold tracking-[-0.02em] text-up">Buy to open</span>
          <span className="num text-[22px] font-extrabold tracking-[-0.02em] text-ink">
            {formatQty(quantity)} {symbol}
          </span>
        </div>
        <p className="num mt-1 text-[13px] text-ink-soft">
          ${contract.strike} {contract.right === 'PUT' ? 'Put' : 'Call'} · {contract.expiration} ·{' '}
          {contract.dte}d
        </p>
        <p className="num mt-0.5 text-[11px] text-ink-muted">{contract.occSymbol}</p>
      </div>

      {/* No order type, no time in force, no commission: nothing downstream
          has any of them. What the backend actually decides is shown instead. */}
      <dl className="space-y-2.5">
        <Row label="Execution mode" value={EXECUTION_MODE} />
        <Row label="Risk profile" value={RISK_PROFILE} />
        <Row label="Contract mid" value={contract.mid === undefined ? '—' : formatMoney(contract.mid)} />
        <Row
          label="Estimated cost"
          value={estimatedCost === undefined ? '—' : formatMoney(estimatedCost)}
          emphasis
        />
      </dl>

      <div className="liquid-inset flex items-start gap-2 rounded-[16px] border-brand-400/15 px-3 py-2.5 text-[12px] leading-relaxed text-brand-200">
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          This submits a trade plan for validation and then a silent execution against recorded
          market data. The fill is simulated; the plan and its verdict are real records.
        </span>
      </div>

      {error ? <RequestErrorNotice error={error} /> : null}
    </div>
  )
}

/**
 * A failed *request* — as distinct from a returned outcome.
 *
 * The distinction is the whole of D6: nothing is known about whether the
 * server acted, so retrying reuses the key and the servers replay whatever
 * they recorded. Telling the user to "try again" with a new key here is how a
 * position gets opened twice.
 */
function RequestErrorNotice({ error }: { error: ApiError }) {
  return (
    <div className="rounded-xl bg-down-soft px-3 py-2.5 text-[12.5px] text-down">
      <p className="font-semibold">{error.message}</p>
      <p className="mt-1 text-[11.5px] text-down/85">
        {error.isRetryable
          ? 'Retrying re-sends the same request under the same idempotency key, so a submission that did go through is replayed rather than repeated.'
          : 'This request was refused before anything was recorded.'}
      </p>
    </div>
  )
}

const OUTCOME: Record<
  Order['status'],
  { title: string; detail: string; tone: 'up' | 'down' | 'neutral' }
> = {
  FILLED: {
    title: 'Filled',
    detail: 'The silent execution filled and the position is recorded.',
    tone: 'up',
  },
  // A successful 201 that opened nothing. Not an error, not "pending".
  NO_FILL: {
    title: 'No fill',
    detail: 'The execution completed and nothing was opened. No position and no cost.',
    tone: 'neutral',
  },
  REJECTED: {
    title: 'Rejected by policy',
    detail: 'The platform service refused the plan. Nothing was executed.',
    tone: 'down',
  },
  SUBMITTED: {
    title: 'Submitted',
    detail: 'The plan is recorded; the execution result has not come back.',
    tone: 'neutral',
  },
}

function OutcomeBody({ order }: { order: Order | null }) {
  if (!order) return null
  const outcome = OUTCOME[order.status]
  const platformError = order.status === 'FILLED' && order.reportedToPlatform === false

  return (
    <div className="space-y-3.5">
      <div className="py-1 text-center">
        <div
          className={cn(
            'liquid-inset mx-auto grid h-14 w-14 place-items-center rounded-full',
            outcome.tone === 'up' && 'border-up/25 bg-up-soft',
            outcome.tone === 'down' && 'border-down/25 bg-down-soft',
          )}
        >
          {order.status === 'FILLED' ? (
            <CheckCircle2 size={30} className="text-up" strokeWidth={2.2} />
          ) : order.status === 'REJECTED' ? (
            <AlertTriangle size={28} className="text-down" strokeWidth={2.2} />
          ) : (
            <CircleSlash size={28} className="text-ink-muted" strokeWidth={2.2} />
          )}
        </div>
        <h3 className="mt-3 text-[19px] font-extrabold tracking-[-0.02em] text-ink">
          {outcome.title}
        </h3>
        <p className="mx-auto mt-1.5 max-w-[360px] text-[13px] leading-relaxed text-ink-soft">
          {outcome.detail}
        </p>
      </div>

      {/* bkt executed but could not tell plt. The trade happened and the system
          of record does not know — recoverable, and never a success toast. */}
      {platformError ? (
        <div className="rounded-xl border border-[#f5c26b]/30 bg-[#f5c26b]/10 px-3 py-2.5 text-[12.5px] text-[#f5c26b]">
          <p className="font-semibold">Filled, but the platform service was not updated.</p>
          <p className="mt-1 leading-relaxed">
            {order.platformError ?? 'The execution service could not report the fill.'} The position
            may not appear until the services reconcile. Do not re-submit — that would open a second
            position.
          </p>
        </div>
      ) : null}

      {order.rejectionReasons && order.rejectionReasons.length > 0 ? (
        <div className="liquid-inset rounded-[16px] p-3">
          <p className="mb-1.5 text-[9px] font-bold tracking-[0.07em] text-ink-muted uppercase">
            Rejection reasons
          </p>
          {/* Verbatim and in wire order; a code may legitimately repeat (§7.5). */}
          <ul className="space-y-1">
            {order.rejectionReasons.map((reason, index) => (
              <li key={`${reason}-${index}`} className="num text-[12px] font-semibold text-down">
                {reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <dl className="liquid-inset space-y-2.5 rounded-[18px] p-3.5 text-left">
        {order.contractDetail ? <Row label="Contract" value={order.contractDetail} /> : null}
        <Row label="Quantity" value={`${formatQty(order.quantity)} contracts`} />
        {order.price === undefined ? null : <Row label="Fill price" value={formatMoney(order.price)} />}
        {order.estimatedValue === undefined ? null : (
          <Row label="Total" value={formatMoney(order.estimatedValue)} emphasis />
        )}
        {order.reasonCode ? <Row label="Reason" value={order.reasonCode} /> : null}
        {order.tradePlanId ? <Row label="Trade plan" value={order.tradePlanId} /> : null}
        {order.executionId ? <Row label="Execution" value={order.executionId} /> : null}
      </dl>

      {order.sessionOnly ? (
        <p className="text-[11.5px] leading-relaxed text-ink-muted">
          This result leaves no durable row anywhere — the execution service has no history
          endpoint yet (HKP-BKT-4), so it is kept for this session only and disappears on reload.
        </p>
      ) : null}
    </div>
  )
}

function Row({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
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
