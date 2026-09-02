import type { BacktestDisclosuresView } from '@/api/researchTypes'
import { PROTOCOL_LABEL } from '@/components/research/researchFormat'

/**
 * What the backend discloses about its own evidence — rendered **verbatim**.
 *
 * Three disclosures, and the rule for all three is the same: state what the
 * backend states, in the backend's words, and never soften it into silence.
 *
 *  - `fill_protocol` (§19.1). A fill rate is a property of the protocol that
 *    produced it. `single_quote_legacy` runs share one quote between decision
 *    and fill, so they OVERSTATE realized entries and are not poolable with
 *    two-quote runs — bkt refuses to pool them (`MixedFillProtocolError`), and
 *    a UI that omitted the protocol would invite a reader to do it by eye.
 *  - `entry_gate` (§20). The Wave-2 decision tape stamps which gate evaluated
 *    a run; it may read `"TAPE"`. Unknown values are printed as they arrive —
 *    a gate this build has not heard of is still the gate that ran.
 *  - `gate_params_unevaluated` (§12.5/§19.6). ai's standing disclosure that
 *    `signal_weights`, `min_edge`, `vrp_max_rich`, `iv_percentile_cap`, the
 *    sizing knobs and the portfolio rails never reach bkt, which enters on its
 *    own entry rule and never runs `DecisionPolicy`. Neither the research desk
 *    nor a backtest run emits it today; the day one does, it appears here in
 *    full rather than being summarised into "some parameters not evaluated".
 */
export function RunDisclosures({ disclosures }: { disclosures: BacktestDisclosuresView }) {
  const protocolNote = PROTOCOL_LABEL[disclosures.fillProtocol]
  return (
    <section className="rounded-xl border border-line bg-white/[0.02] px-3 py-2.5">
      <h4 className="text-[10px] font-extrabold tracking-[0.06em] text-ink-soft uppercase">
        Disclosures
      </h4>
      <dl className="mt-1.5 space-y-1.5">
        <Row term="fill_protocol" value={disclosures.fillProtocol} note={protocolNote} />
        {disclosures.entryGate ? <Row term="entry_gate" value={disclosures.entryGate} /> : null}
        {disclosures.gateParamsUnevaluated && disclosures.gateParamsUnevaluated.length > 0 ? (
          <div>
            <dt className="num text-[9.5px] font-bold text-ink-muted">gate_params_unevaluated</dt>
            <dd className="num mt-0.5 flex flex-wrap gap-1">
              {disclosures.gateParamsUnevaluated.map((param) => (
                <span
                  key={param}
                  className="rounded-full border border-[#f5c26b]/30 bg-[#f5c26b]/10 px-2 py-0.5 text-[9.5px] font-semibold text-[#f5c26b]"
                >
                  {param}
                </span>
              ))}
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  )
}

function Row({ term, value, note }: { term: string; value: string; note?: string }) {
  return (
    <div>
      <dt className="num text-[9.5px] font-bold text-ink-muted">{term}</dt>
      <dd className="num text-[10.5px] font-semibold text-ink">{value}</dd>
      {note ? <p className="mt-0.5 text-[9.5px] leading-relaxed text-ink-muted">{note}</p> : null}
    </div>
  )
}
