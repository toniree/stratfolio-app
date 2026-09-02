import type { BacktestRequestView } from '@/api/researchTypes'
import { MISSING, formatMoney } from '@/lib/format'
import { SELECTION_LABEL, ratioPercent } from '@/components/research/researchFormat'

/**
 * The request that produced this run — read-only (APP-122 §1).
 *
 * These are shown, not edited. The selection mode and its parameters are the
 * claim the run's evidence is *about*: a `DELTA_BAND` run picked the contract
 * ai's live selector would have picked, inside the band and above the
 * open-interest floor (§19.2), while a `NEAREST_DELTA` run picked the closest
 * strike to one point delta and is a baseline. Letting a user retype the band
 * in a text box would produce runs that look like the strategy and are not it —
 * and a persisted run whose parameters were free-form is a run nothing can be
 * audited against.
 *
 * `min_contract_oi` is shown even when it is 0, because §19.2 requires it to be
 * *stated*: an unspoken liquidity floor silently becoming "no floor" is exactly
 * what a reader cannot audit later.
 */
export function RunParameters({ request }: { request: BacktestRequestView }) {
  const band = request.targetDeltaRange
  return (
    <section className="rounded-xl border border-line bg-white/[0.02] px-3 py-2.5">
      <header className="flex flex-wrap items-baseline gap-2">
        <h4 className="text-[10px] font-extrabold tracking-[0.06em] text-ink-soft uppercase">
          Selection & rules
        </h4>
        <span className="num text-[9px] text-ink-muted">
          {SELECTION_LABEL[request.selection] ?? request.selection}
        </span>
      </header>

      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
        <Item label="Option type" value={request.right} />
        <Item
          label="|Δ| band"
          value={band ? `${band[0].toFixed(2)} – ${band[1].toFixed(2)}` : MISSING}
          hint={band ? undefined : 'Not a banded selection: this run targets a single delta.'}
        />
        <Item
          label="Target |Δ|"
          value={request.targetDelta === undefined ? MISSING : request.targetDelta.toFixed(2)}
          hint={
            request.targetDelta === undefined
              ? 'Sent as an explicit null: a band states no point target (§19.2).'
              : undefined
          }
        />
        <Item label="Min contract OI" value={String(request.minContractOi)} />
        <Item label="DTE window" value={`${request.minDte} – ${request.maxDte}`} />
        <Item label="Quantity" value={String(request.quantity)} />
        <Item
          label="Profit target"
          value={ratioPercent(request.profitTargetPct, 0)}
          hint="A fraction of entry premium (§12.3): 1.0 is +100%."
        />
        <Item
          label="Stop loss"
          value={ratioPercent(request.stopLossPct, 0)}
          hint="A fraction of entry premium (§12.3): 0.5 is −50%."
        />
        <Item
          label="Max holding"
          value={
            request.maxHoldingDays === undefined ? MISSING : `${request.maxHoldingDays} sessions`
          }
        />
        <Item label="Force close DTE" value={String(request.forceCloseDte)} />
        <Item label="Capital base" value={formatMoney(request.initialCapital, { whole: true })} />
        <Item label="Window" value={`${request.start} → ${request.end}`} />
      </dl>

      <p className="num mt-2 text-[9.5px] text-ink-muted">
        Symbols: {request.symbols.join(' · ') || MISSING}
      </p>
    </section>
  )
}

function Item({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0" title={hint}>
      <dt className="text-[8.5px] font-extrabold tracking-[0.06em] text-ink-muted uppercase">
        {label}
      </dt>
      <dd className="num mt-0.5 truncate text-[11px] font-bold text-ink">{value}</dd>
    </div>
  )
}
