import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bot,
  ChevronDown,
  ChevronRight,
  Pause,
  Pencil,
  UserRound,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useUpdatePlannerIdea } from '@/hooks/queries'
import { adjustPlanFromPrompt } from '@/lib/planPrompt'
import { formatMoney, formatQty, formatSignedMoney } from '@/lib/format'
import { sortPlansByTriggerSoon, triggerSoonPercent } from '@/lib/plannerSort'
import type { PlannerIdea } from '@/api/newsTypes'
import type { Position } from '@/api/types'
import type { PositionValuation } from '@/lib/portfolioMath'
import { Skeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { ManualCloseTicket } from '@/components/positions/ManualCloseTicket'
import { planExitSummary, planIntent, watchedPlanOptions } from '@/lib/planIntent'
import { PlanCriteriaList } from '@/components/plan/PlanCriteriaList'
import { Modal } from '@/components/ui/Modal'
import { usePlanExecutionStore } from '@/store/planExecutionStore'
import { useUiStore } from '@/store/uiStore'
import { PlanStopwatchIcon } from '@/components/plan/PlanStopwatchIcon'
import { useAssistantChatStore } from '@/store/assistantChatStore'

const DISABLE_HOLD_MS = 700

export function UpcomingTradePlans({
  plans,
  valuations,
  portfolioValue,
  loading,
}: {
  plans: PlannerIdea[]
  valuations: PositionValuation[]
  portfolioValue: number
  loading?: boolean
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAllPlans, setShowAllPlans] = useState(false)
  const aiTradingEnabled = useUiStore((state) => state.aiTradingEnabled)
  const [executionId, setExecutionId] = useState<string | null>(null)
  const disabledIds = usePlanExecutionStore((state) => state.disabledIds)
  const disablePlan = usePlanExecutionStore((state) => state.disablePlan)
  const activatePlan = usePlanExecutionStore((state) => state.activatePlan)
  const [holdingDisableId, setHoldingDisableId] = useState<string | null>(null)
  const [disableConfirmation, setDisableConfirmation] = useState<PlannerIdea | null>(null)
  const [disableReason, setDisableReason] = useState('')
  const sendMessage = useAssistantChatStore((state) => state.sendMessage)
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null)
  const [promptText, setPromptText] = useState('')
  const updatePlan = useUpdatePlannerIdea()
  const disableTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const upcoming = selectDemoPlans(plans)
  const visibleUpcoming = showAllPlans ? upcoming : upcoming.slice(0, 2)
  const executionPlan = upcoming.find((plan) => plan.id === executionId)
  const executionValuation = executionPlan
    ? findPlanPosition(executionPlan, valuations)
    : undefined
  const executionPosition = executionPlan
    ? executionValuation?.position ?? orderPositionFromPlan(executionPlan)
    : undefined
  const executionPrice =
    executionValuation?.price ??
    (executionPlan ? (executionPlan.entryLow + executionPlan.entryHigh) / 2 : 0)

  useEffect(
    () => () => {
      if (disableTimer.current) clearTimeout(disableTimer.current)
    },
    [],
  )

  const cancelDisableHold = () => {
    if (disableTimer.current) clearTimeout(disableTimer.current)
    disableTimer.current = null
    setHoldingDisableId(null)
  }

  const beginDisableHold = (plan: PlannerIdea) => {
    cancelDisableHold()
    setHoldingDisableId(plan.id)
    disableTimer.current = setTimeout(() => {
      disableTimer.current = null
      setHoldingDisableId(null)
      setDisableConfirmation(plan)
    }, DISABLE_HOLD_MS)
  }

  return (
    <>
      <div className="space-y-1.5">
        <div className="space-y-1 px-0.5">
          <div className="flex items-center gap-2">
            <Link
              to="/app/plan?sort=trigger-soon"
              className="inline-flex min-w-0 items-center gap-1.5 transition-colors hover:text-ink"
            >
              <PlanStopwatchIcon />
              {/* Exactly the `titleClassName` the Positions and Trade Theses
                  carousels pass, so the three home rows share one heading. */}
              <h2 className="text-[10px] font-extrabold tracking-[0.075em] text-ink-soft uppercase">
                Plans Executing Soon
              </h2>
            </Link>
            <Link
              to="/app/plan?sort=trigger-soon"
              aria-label="See all plans"
              className="nav-gloss-button ml-auto h-9 w-9"
            >
              <ChevronRight size={17} strokeWidth={2.5} />
            </Link>
          </div>
          <PlansExecutionTicker />
        </div>

        <section className="card overflow-hidden rounded-[22px]" aria-label="Plans Executing Soon">

      {loading ? (
        <div className="space-y-2 p-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-[58px] rounded-xl" />
          ))}
        </div>
      ) : upcoming.length === 0 ? (
        <p className="px-5 py-8 text-center text-[12px] text-ink-muted">
          No trade plans are nearing their criteria yet.
        </p>
      ) : (
        <div>
          {visibleUpcoming.map((plan, index) => {
            const expanded = expandedId === plan.id
            const userMade = plan.source === 'user'
            const valuation = findPlanPosition(plan, valuations)
            const closing = planIntent(plan) === 'close'
            const maxAmount = planMaxAmount(plan, portfolioValue, index, valuation)
            const watchedOptions = watchedPlanOptions(plan)
            const disabled = disabledIds.includes(plan.id)
            // AI Trading only governs AI-authored automation. User-authored
            // plans remain active when the global AI toggle is off.
            const inert = disabled || (!aiTradingEnabled && !userMade)
            const lastPrompt = plan.originalPrompt ?? plan.title
            const exit = planExitSummary(plan, valuation?.marketValue ?? maxAmount)

            return (
              <article
                key={plan.id}
                data-plan-source={plan.source}
                data-plan-disabled={disabled || undefined}
                className={cn(
                  'border-b border-line/60 last:border-b-0',
                  disabled && 'bg-down/[0.025]',
                )}
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : plan.id)}
                  aria-expanded={expanded}
                  className="relative grid w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.025]"
                >
                  <span
                    className={cn(
                      // Author at a glance: the logo's blue-to-violet ramp for
                      // StratFolio AI, flat brand blue for the user.
                      // Dim grounds so the white glyph is the bright element.
                      'grid h-7 w-7 place-items-center rounded-full border text-white shadow-[inset_0_1px_rgba(255,255,255,0.1)]',
                      userMade
                        ? 'border-brand-300/22 bg-[#25405f]'
                        : 'border-[#a875ff]/32 bg-[linear-gradient(135deg,#2b4680,#3d3a7a_48%,#523a78)]',
                    )}
                    aria-hidden
                  >
                    {userMade ? <UserRound size={17} /> : <Bot size={17} />}
                  </span>

                  <span className="min-w-0">
                    <span className="flex items-baseline gap-1.5">
                      <span className="text-[11.5px] font-extrabold text-ink">{plan.symbol}</span>
                      {/* Contract rides directly on the ticker so the two read as
                          one identifier, at full brightness rather than dimmed. */}
                      <span className="num truncate text-[10.5px] font-bold text-ink">
                        {compactContractRight(plan.contractDetail ?? plan.company)}
                      </span>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-1.5 py-px text-[7px] font-extrabold tracking-[0.06em] uppercase',
                          closing
                            ? 'bg-down/[0.08] text-down/75'
                            : 'bg-up/[0.08] text-up/75',
                        )}
                      >
                        {closing ? 'Close' : 'Open'}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'mt-0.5 block truncate text-[10px] font-semibold text-white/78',
                        inert && 'text-white/42 line-through decoration-down/75',
                      )}
                    >
                      {plan.originalPrompt || plan.title}
                    </span>
                  </span>

                  <span className={cn('flex items-center gap-1.5', inert && 'opacity-40 grayscale')}>
                    {disabled ? (
                      <span className="text-[8.5px] font-bold whitespace-nowrap text-down/80 uppercase">
                        Disabled
                      </span>
                    ) : (
                      <ReadinessRing percent={triggerSoonPercent(plan)} />
                    )}
                    <span className="grid h-6 w-6 place-items-center text-ink">
                      <ChevronDown
                        size={16}
                        strokeWidth={2.4}
                        className={cn('transition-transform duration-200', expanded && 'rotate-180')}
                      />
                    </span>
                  </span>
                  {disabled ? (
                    <span
                      className="pointer-events-none absolute inset-x-3 top-1/2 h-px bg-down/55 shadow-[0_0_6px_rgba(248,113,113,0.25)]"
                      aria-hidden
                    />
                  ) : null}
                </button>

                {expanded ? (
                  <div className="liquid-inset mx-3 mb-3 grid grid-cols-3 divide-x divide-white/[0.075] overflow-hidden rounded-[14px]">
                    <PlanPreviewFact
                      label="Entry"
                      value={formatRange(plan.entryLow, plan.entryHigh)}
                    />
                    <PlanPreviewFact
                      label="Target"
                      value={formatRange(plan.targetLow, plan.targetHigh)}
                    />
                    <PlanPreviewFact
                      label={closing ? 'Profit' : 'Max'}
                      value={
                        closing && valuation
                          ? formatSignedMoney(valuation.totalReturn ?? 0)
                          : formatMoney(maxAmount, { whole: true })
                      }
                    />
                    {closing && valuation ? (
                      <div className="col-span-3 grid grid-cols-2 divide-x divide-white/[0.075] border-t border-white/[0.075]">
                        <PlanPreviewFact
                          label="Qty"
                          value={formatQty(valuation.position.quantity)}
                        />
                        <PlanPreviewFact
                          label="Current value"
                          value={formatMoney(valuation.marketValue, { whole: true })}
                        />
                      </div>
                    ) : null}
                    <div className="col-span-3 border-t border-white/[0.075] px-3 py-2.5">
                      <PlanCriteriaList plan={plan} dimmed={inert} />
                    </div>
                    <div className="col-span-3 border-t border-white/[0.075] px-3 py-2.5">
                      <div className="text-[8px] font-extrabold tracking-[0.07em] text-white uppercase">
                        Exit plan
                      </div>
                      <dl className="mt-1.5 grid grid-cols-4 gap-2">
                        <ExitFact label="Exit range" value={exit.range} tone="up" />
                        <ExitFact
                          label="Est. P/L"
                          value={`${formatSignedMoney(exit.plLow)} to ${formatSignedMoney(exit.plHigh)}`}
                          tone={exit.plLow >= 0 ? 'up' : 'down'}
                        />
                        <ExitFact label="Risk/reward" value={exit.ratio} />
                        <ExitFact label="Time range" value={exit.time} />
                      </dl>
                    </div>
                    <div className="col-span-3 border-t border-white/[0.075] px-3 pt-1.5 pb-2.5">
                      {/* Identical mechanism to the position tile's Active Plans
                          sheet: read-only prompt, an explicit Edit, then a
                          prefilled textarea with cancel/save. */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-[8px] font-extrabold tracking-[0.07em] text-white uppercase">
                            Original prompt
                          </span>
                          <p className="mt-1 text-[11px] leading-relaxed text-white/85">
                            {lastPrompt}
                          </p>
                        </div>
                        {editingPromptId !== plan.id ? (
                          <button
                            type="button"
                            className="plan-action-button inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-brand-300/25 bg-brand-400/[0.16] px-2.5 text-[9.5px] font-bold text-[#b9dcff] shadow-[0_6px_16px_-12px_rgba(91,166,255,0.9)] hover:bg-brand-400/[0.25]"
                            onClick={() => {
                              setPromptText(lastPrompt)
                              setEditingPromptId(plan.id)
                            }}
                          >
                            <Pencil size={10} /> Reprompt
                          </button>
                        ) : null}
                      </div>
                      {editingPromptId === plan.id ? (
                        <div className="mt-2 space-y-2">
                          <textarea
                            rows={4}
                            value={promptText}
                            onChange={(event) => setPromptText(event.target.value)}
                            aria-label="Plan prompt"
                            className="liquid-control h-auto w-full resize-none rounded-[14px] px-3 py-2.5 text-[11.5px] leading-relaxed text-ink outline-none"
                          />
                          <p className="text-[10px] leading-relaxed text-white/62">
                            StratFolio AI will adjust intent, max per trade, entry, target, and stop
                            when you mention them.
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="border-white/[0.14] bg-white/[0.08] text-white/80 hover:bg-white/[0.13]"
                              onClick={() => setEditingPromptId(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              className="border border-emerald-300/25 bg-emerald-400/80 text-[#071a12] hover:bg-emerald-300"
                              disabled={updatePlan.isPending || !promptText.trim()}
                              onClick={async () => {
                                await updatePlan.mutateAsync({
                                  id: plan.id,
                                  input: adjustPlanFromPrompt(promptText),
                                })
                                setEditingPromptId(null)
                              }}
                            >
                              {updatePlan.isPending ? 'Saving…' : 'Save prompt'}
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                    {watchedOptions.length > 0 ? (
                      <div className="col-span-3 flex flex-wrap items-center gap-1.5 border-t border-white/[0.075] px-3 py-2">
                        <span className="mr-0.5 text-[7.5px] font-bold tracking-[0.06em] text-ink-muted uppercase">
                          Watching
                        </span>
                        {watchedOptions.map((option) => (
                          <span
                            key={option}
                            className="rounded-full border border-brand-300/32 bg-brand-400/[0.17] px-2 py-0.5 text-[9.5px] font-bold text-[#d3eaff] shadow-[inset_0_1px_rgba(255,255,255,0.09)]"
                          >
                            {option}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="col-span-3 grid grid-cols-[0.9fr_1.1fr] gap-2 border-t border-white/[0.075] p-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        className={cn(
                          'relative h-8 overflow-hidden border border-down/45 bg-transparent text-down/90 hover:bg-down/[0.06]',
                          disabled &&
                            'border-emerald-300/30 bg-emerald-400/[0.08] text-emerald-200/85 hover:bg-emerald-400/[0.15] hover:text-emerald-100',
                        )}
                        onPointerDown={() => {
                          if (!disabled) beginDisableHold(plan)
                        }}
                        onPointerUp={cancelDisableHold}
                        onPointerCancel={cancelDisableHold}
                        onPointerLeave={cancelDisableHold}
                        onClick={(event) => {
                          if (disabled) {
                            activatePlan(plan.id)
                          } else {
                            event.preventDefault()
                          }
                        }}
                        aria-label={disabled ? 'Activate plan' : 'Disable plan'}
                      >
                        {holdingDisableId === plan.id ? (
                          <span className="plan-disable-fill pointer-events-none absolute inset-0 origin-left bg-down/22" aria-hidden />
                        ) : null}
                        <span className="relative z-10">{disabled ? 'Activate plan' : 'Disable'}</span>
                      </Button>
                      <Button
                        size="sm"
                        // Same solid green as "Send order" — both commit a trade,
                        // so they should not read as different weights of action.
                        variant="success"
                        className="h-8 w-full"
                        onClick={() => setExecutionId(plan.id)}
                      >
                        <Zap size={13} fill="currentColor" />
                        Execute
                      </Button>
                    </div>
                  </div>
                ) : null}
              </article>
            )
          })}
          {upcoming.length > 2 ? (
            <button
              type="button"
              aria-expanded={showAllPlans}
              aria-label={showAllPlans ? 'Show fewer plans' : `Show ${upcoming.length - 2} more plans`}
              onClick={() => {
                setShowAllPlans((visible) => !visible)
                if (showAllPlans && expandedId === upcoming[2]?.id) setExpandedId(null)
              }}
              className="group flex h-3.5 w-full items-center justify-center border-t border-white/[0.065] bg-white/[0.018] text-ink-muted transition-[background-color,color] hover:bg-white/[0.045] hover:text-ink"
            >
              <ChevronDown
                size={11}
                className={cn('transition-transform duration-200', showAllPlans && 'rotate-180')}
              />
            </button>
          ) : null}
        </div>
      )}
        </section>
      </div>
      {executionPlan && executionPosition ? (
        // Same order ticket the position tile's close button opens, so
        // executing a plan and closing a holding are one flow, not two.
        <ManualCloseTicket
          position={executionPosition}
          price={executionPrice}
          previousClose={executionValuation?.previousClose}
          open
          onOpenChange={(open) => {
            if (!open) setExecutionId(null)
          }}
        />
      ) : null}
      <Modal
        open={Boolean(disableConfirmation)}
        onOpenChange={(open) => {
          if (!open) {
            setDisableConfirmation(null)
            setDisableReason('')
          }
        }}
        title={
          disableConfirmation ? (
            <span className="block">
              Disable plan for
              <span className="num block">
                {disableConfirmation.symbol}{' '}
                {compactContractRight(
                  disableConfirmation.contractDetail ?? disableConfirmation.company,
                )}
                ?
              </span>
            </span>
          ) : (
            'Disable plan?'
          )
        }
        description={
          disableConfirmation
            ? `${disableConfirmation.symbol} will stop executing automatically, but the plan will remain visible in this table.`
            : undefined
        }
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              className="border-white/[0.14] bg-white/[0.08] text-white/80 hover:bg-white/[0.13]"
              onClick={() => setDisableConfirmation(null)}
            >
              Keep active
            </Button>
            <Button
              // Solid red, like the other destructive confirmations — a tinted
              // outline read as the lesser of the two choices here.
              variant="danger"
              onClick={() => {
                const plan = disableConfirmation
                if (plan) {
                  disablePlan(plan.id)
                  const note = disableReason.trim()
                  // Why a plan was switched off is the signal worth keeping, so
                  // it rides along to the assistant rather than being discarded.
                  if (note) {
                    void sendMessage(`I disabled the ${plan.symbol} plan — ${note}`, {
                      kind: 'plan',
                      id: plan.id,
                      label: `${plan.symbol} plan`,
                      detail: plan.originalPrompt ?? plan.title,
                      to: `/app/plan/${plan.id}`,
                    })
                  }
                }
                setDisableConfirmation(null)
                setDisableReason('')
              }}
            >
              <Pause size={14} fill="currentColor" />
              Disable
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          {/* What the plan would have done, so the choice is made against the
              numbers rather than from memory. */}
          {disableConfirmation ? (
            <dl className="liquid-inset divide-y divide-white/[0.06] rounded-[16px] px-3.5 py-1">
              <DisableFact
                label={planIntent(disableConfirmation) === 'close' ? 'Closes' : 'Opens'}
                value={compactContractRight(
                  disableConfirmation.contractDetail ?? disableConfirmation.company,
                )}
              />
              <DisableFact
                label="Entry"
                value={formatRange(disableConfirmation.entryLow, disableConfirmation.entryHigh)}
              />
              <DisableFact
                label="Target"
                value={formatRange(disableConfirmation.targetLow, disableConfirmation.targetHigh)}
                tone="up"
              />
              <DisableFact
                label="Stop"
                value={formatMoney(disableConfirmation.stop)}
                tone="down"
              />
              <DisableFact label="Horizon" value={disableConfirmation.horizon} />
              <DisableFact
                label="Readiness"
                value={triggerSoonPercent(disableConfirmation)}
                tone="up"
              />
            </dl>
          ) : null}
          <label className="block">
            <span className="mb-1.5 block text-[9.5px] font-bold tracking-[0.07em] text-ink-muted uppercase">
              Tell AI why <span className="font-semibold normal-case opacity-70">Optional</span>
            </span>
            <textarea
              value={disableReason}
              onChange={(event) => setDisableReason(event.target.value)}
              rows={3}
              placeholder="(Optional) what changed your mind — it sends with the disable"
              className="liquid-control h-auto w-full resize-none rounded-[14px] px-3 py-2.5 text-[12.5px] leading-relaxed text-ink outline-none placeholder:text-ink-muted/65 placeholder:italic"
            />
          </label>
        </div>
      </Modal>
    </>
  )
}

function PlansExecutionTicker() {
  const copy =
    'Trade plans which are active and close to automatic execution by meeting plan criteria are shown below. You can choose to execute the trade plan prematurely, or disable the plan before it executes, from each dropdown.'

  return (
    <div className="max-w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_3%,black_94%,transparent)]">
      <div className="plans-execution-track flex w-max whitespace-nowrap text-[9.5px] font-medium">
        <span className="section-gloss-text pr-12">{copy}</span>
        <span className="section-gloss-text pr-12" aria-hidden>{copy}</span>
      </div>
    </div>
  )
}

/**
 * Readiness as a closed ring rather than a bare percentage — the ring reads as
 * "how far round to firing" at a glance, with the number inside it and the
 * label stacked beneath.
 */
function ReadinessRing({ percent }: { percent: string }) {
  const value = Math.max(0, Math.min(100, Number.parseFloat(percent) || 0))
  const radius = 13
  const circumference = 2 * Math.PI * radius

  return (
    <span className="flex flex-col items-center gap-0.5">
      <span className="relative grid h-8 w-8 place-items-center">
        <svg viewBox="0 0 32 32" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
          <circle cx="16" cy="16" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.6" />
          <circle
            cx="16"
            cy="16"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - value / 100)}
            className="text-up"
          />
        </svg>
        <span className="num relative text-[8.5px] font-semibold text-up">
          {Math.round(value)}
          <span className="text-[6px]">%</span>
        </span>
      </span>
      <span className="text-[6.5px] font-bold tracking-[0.08em] text-ink-muted lowercase">
        chance
      </span>
    </span>
  )
}

/** One label/value line in the disable recap. */
function DisableFact({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'up' | 'down'
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-[9px] font-bold tracking-[0.07em] text-ink-muted uppercase">{label}</dt>
      <dd
        className={cn(
          'num min-w-0 truncate text-[11.5px] font-bold text-ink',
          tone === 'up' && 'text-up',
          tone === 'down' && 'text-down',
        )}
      >
        {value}
      </dd>
    </div>
  )
}

function compactContractRight(label: string) {
  return label.replace(/\bCall\b/gi, 'C').replace(/\bPut\b/gi, 'P')
}

/** Keep the demo legible: two human plans and one AI plan whenever available. */
function selectDemoPlans(plans: PlannerIdea[]): PlannerIdea[] {
  const ranked = sortPlansByTriggerSoon(plans).filter(
    (plan) => plan.symbol !== 'GOOGL' && plan.symbol !== 'UBER',
  )
  const selected = [
    ...ranked.filter((plan) => plan.source === 'user').slice(0, 2),
    ...ranked.filter((plan) => plan.source === 'ai').slice(0, 1),
  ]
  if (selected.length < 3) {
    selected.push(...ranked.filter((plan) => !selected.includes(plan)).slice(0, 3 - selected.length))
  }
  return sortPlansByTriggerSoon(selected).slice(0, 3)
}

function findPlanPosition(
  plan: PlannerIdea,
  valuations: PositionValuation[],
): PositionValuation | undefined {
  return valuations.find((valuation) => {
    const position = valuation.position
    if (plan.positionId) return position.id === plan.positionId
    return (
      position.symbol === plan.symbol &&
      position.assetType === plan.assetType &&
      (position.assetType !== 'option' || position.contractDetail === plan.contractDetail)
    )
  })
}

function planMaxAmount(
  plan: PlannerIdea,
  portfolioValue: number,
  index: number,
  valuation?: PositionValuation,
): number {
  const allocationPct = [0.006, 0.008, 0.01][index] ?? 0.0075
  const portfolioLimit =
    portfolioValue > 0 ? Math.max(250, Math.round((portfolioValue * allocationPct) / 50) * 50) : 0
  const configured = plan.maxAmount && plan.maxAmount > 0 ? plan.maxAmount : portfolioLimit || 1000
  const sized = portfolioLimit > 0 ? Math.min(configured, portfolioLimit) : configured
  return valuation ? Math.min(sized, Math.max(250, valuation.marketValue)) : sized
}

/** One cell of the exit-plan strip: label above, wrapped value below. */
function ExitFact({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'up' | 'down'
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[7px] font-bold tracking-[0.06em] text-ink-muted uppercase">{label}</dt>
      <dd
        className={cn(
          'num mt-0.5 text-[9px] leading-snug font-extrabold break-words text-ink',
          tone === 'up' && 'text-up',
          tone === 'down' && 'text-down',
        )}
      >
        {value}
      </dd>
    </div>
  )
}

function PlanPreviewFact({ label, value }: { label: string; value: string }) {
  return (
    <dl className="min-w-0 px-2 py-2 text-center">
      <dt className="text-[7.5px] font-bold tracking-[0.06em] text-ink-muted uppercase">{label}</dt>
      <dd className="num mt-0.5 truncate text-[9.5px] font-extrabold text-ink">{value}</dd>
    </dl>
  )
}

function formatRange(low: number, high: number): string {
  return low === high ? formatMoney(low) : `${formatMoney(low)}–${formatMoney(high)}`
}

function orderPositionFromPlan(plan: PlannerIdea): Position {
  const price = (plan.entryLow + plan.entryHigh) / 2
  return {
    id: `planned-${plan.id}`,
    symbol: plan.symbol,
    company: plan.company,
    assetType: plan.assetType,
    contractDetail: plan.contractDetail,
    brokerageId: 'robinhood',
    quantity: 3,
    avgCost: price,
    openedAt: new Date().toISOString(),
    ai: plan.ai ?? {
      conviction: 70,
      convictionDelta: 0,
      recommendation: 'BUY',
      upsideTarget: (plan.targetLow + plan.targetHigh) / 2,
      downsideRisk: plan.stop,
      riskRewardRatio: 2,
      horizon: plan.horizon,
      targetLow: plan.targetLow,
      targetHigh: plan.targetHigh,
      thesis: [plan.title],
      recommendationNote: plan.notes,
      updatedAt: plan.createdAt,
    },
  }
}
