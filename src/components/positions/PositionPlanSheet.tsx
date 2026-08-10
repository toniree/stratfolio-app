import { useEffect, useState } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  Bot,
  Check,
  ChevronDown,
  CircleDollarSign,
  Newspaper,
  NotebookPen,
  Pencil,
  Plus,
  Sparkles,
  ShieldAlert,
  Target,
  UserRound,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatMoney } from '@/lib/format'
import type { Position } from '@/api/types'
import type { PlannerIdea, PlannerIdeaSource, PlannerIntent } from '@/api/newsTypes'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { PositionContextPanel } from '@/components/positions/PositionContextPanel'
import {
  useCreatePlannerIdea,
  usePortfolioMeta,
  usePositions,
  useUpdatePlannerIdea,
} from '@/hooks/queries'
import { planIntent, watchedPlanOptions } from '@/lib/planIntent'
import { adjustPlanFromPrompt, parseMaxAmountFromPrompt } from '@/lib/planPrompt'
import { usePrice, usePrices } from '@/store/priceStore'
import { useUiStore } from '@/store/uiStore'
import { computeTotals } from '@/lib/portfolioMath'
import { optionMark } from '@/lib/optionMath'

const ADD_PLAN_LIMIT = 3

interface PlanFormState {
  intent: PlannerIntent
  originalPrompt: string
  watchedOptions: string
}

export interface PositionPlanPresentation {
  source: PlannerIdeaSource
  title: string
  notes: string
  trigger: string
  target: string
}

export function PositionPlanSheet({
  position,
  plans,
  open,
  onOpenChange,
  onOpenPlanner,
}: {
  position: Position
  plans: PlannerIdea[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenPlanner: (plan: PlannerIdea) => void
}) {
  const createPlan = useCreatePlannerIdea()
  const accountId = useUiStore((state) => state.accountId)
  const prices = usePrices()
  const { data: accountPositions } = usePositions(accountId)
  const { data: portfolioMeta } = usePortfolioMeta(accountId)
  const portfolioMarketValue = computeTotals(accountPositions ?? [], prices).marketValue
  const sizing = {
    balance: portfolioMarketValue + (portfolioMeta?.cash ?? 0),
    cash: portfolioMeta?.cash ?? 0,
  }
  const underlying = usePrice(position.symbol)
  const underlyingPrice = underlying?.price ?? position.avgCost
  // The panel quotes the instrument being planned: the contract when there is
  // one, otherwise the share price.
  const price = position.option ? optionMark(position.option, underlyingPrice) : underlyingPrice
  const [contextOpen, setContextOpen] = useState(true)
  const [expandedIds, setExpandedIds] = useState<string[]>([])
  const [adding, setAdding] = useState(false)
  const [promptError, setPromptError] = useState('')
  const [form, setForm] = useState<PlanFormState>(() => initialPlanForm(position))
  const canAdd = plans.length <= ADD_PLAN_LIMIT
  const suggestedMaxAmount = fallbackPositionMaxAmount(position)
  const promptAdjustment = adjustPlanFromPrompt(form.originalPrompt, sizing)
  const promptMaxAmount = promptAdjustment.maxAmount
  const canSavePlan =
    Boolean(form.originalPrompt.trim()) &&
    (form.intent === 'close' || Boolean(promptMaxAmount))

  useEffect(() => {
    if (!open) return
    setExpandedIds([])
    setAdding(false)
    setPromptError('')
    setForm(initialPlanForm(position))
    createPlan.reset()
    // The mutation object is intentionally omitted; including it retriggers on render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, position])

  const set = <K extends keyof PlanFormState>(key: K, value: PlanFormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const handleCreate = async () => {
    const prompt = form.originalPrompt.trim()
    const adjustment = adjustPlanFromPrompt(prompt, sizing)
    const maxAmount = adjustment.maxAmount ?? parseMaxAmountFromPrompt(prompt, sizing)
    if (form.intent === 'open' && !maxAmount) {
      setPromptError(
        'Include a max amount, e.g. “max $1,500,” “10% of balance,” or “1/4 of cash.”',
      )
      return
    }

    const created = await createPlan.mutateAsync({
      symbol: position.symbol,
      company: position.company,
      positionId: position.id,
      assetType: position.assetType,
      contractDetail: position.contractDetail,
      direction: 'LONG',
      intent: form.intent,
      title: prompt || `${position.symbol} position plan`,
      originalPrompt: prompt || undefined,
      notes: `AI-translated from your prompt: ${prompt}`,
      maxAmount: form.intent === 'open' ? maxAmount : undefined,
      entryLow: adjustment.entryLow ?? position.avgCost,
      entryHigh: adjustment.entryHigh ?? position.avgCost,
      targetLow: adjustment.targetLow ?? position.ai.targetLow,
      targetHigh: adjustment.targetHigh ?? position.ai.targetHigh,
      stop: adjustment.stop ?? Math.max(0.01, position.avgCost * 0.8),
      horizon: position.ai.horizon,
      watchedOptions: parseWatchedOptions(form.watchedOptions),
    })

    setAdding(false)
    setExpandedIds((ids) => [created.id, ...ids])
    setForm(initialPlanForm(position))
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      className="sm:w-[min(500px,calc(100vw-2rem))]"
      // Same centred banner the thesis tile's modal uses — the contract is
      // named in the body, so the header carries one label and nothing else.
      align="center"
      title={
        <span className="block text-[13px] font-extrabold tracking-[0.16em] text-ink uppercase">
          Active plans
        </span>
      }
      footer={
        adding ? (
          <div className="grid grid-cols-[0.8fr_1.2fr] gap-2">
            <Button variant="secondary" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button
              variant="success"
              onClick={handleCreate}
              disabled={createPlan.isPending || !canSavePlan}
            >
              {createPlan.isPending ? 'Saving…' : 'Save plan'}
            </Button>
          </div>
        ) : canAdd ? (
          // Same solid treatment as "Send order" and "Save plan" — committing a
          // plan is the same weight of action, so it reads the same.
          <Button
            variant="success"
            className="plan-action-button h-11 w-full rounded-[14px]"
            onClick={() => setAdding(true)}
          >
            <Plus size={15} strokeWidth={2.6} />
            Add plan
          </Button>
        ) : null
      }
    >
      <div className="space-y-3">
        <PositionContextPanel
          position={position}
          price={price}
          previousClose={price}
          expanded={contextOpen}
          onToggle={() => setContextOpen((current) => !current)}
          selectedQuote={null}
          onSelectQuote={() => {}}
        />
        {adding ? (
          <AddPlanForm
            form={form}
            set={set}
            promptError={promptError}
            clearPromptError={() => setPromptError('')}
            position={position}
            sizing={sizing}
          />
        ) : (
          <div className="space-y-2.5">
          {plans.length > 0 ? (
            plans.map((plan) => {
              const expanded = expandedIds.includes(plan.id)
              return (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  fallbackMaxAmount={suggestedMaxAmount}
                  expanded={expanded}
                  onToggle={() =>
                    setExpandedIds((ids) =>
                      expanded ? ids.filter((id) => id !== plan.id) : [...ids, plan.id],
                    )
                  }
                  onOpenPlanner={() => onOpenPlanner(plan)}
                />
              )
            })
          ) : (
            <EmptyPlans position={position} />
          )}

          {!canAdd ? (
            <p className="px-1 text-center text-[10.5px] leading-relaxed text-ink-muted">
              This position already has {plans.length} plans. Open Planner to archive one before
              adding another.
            </p>
          ) : null}
          </div>
        )}
      </div>
    </Modal>
  )
}

function PlanCard({
  plan,
  fallbackMaxAmount,
  expanded,
  onToggle,
  onOpenPlanner,
}: {
  plan: PlannerIdea
  fallbackMaxAmount: number
  expanded: boolean
  onToggle: () => void
  onOpenPlanner: () => void
}) {
  const updatePlan = useUpdatePlannerIdea()
  const userMade = plan.source === 'user'
  const prompt = originalPrompt(plan)
  const [editingPrompt, setEditingPrompt] = useState(false)
  const [promptText, setPromptText] = useState(prompt)
  const [editingOptions, setEditingOptions] = useState(false)
  const [optionText, setOptionText] = useState(() => watchedPlanOptions(plan).join('\n'))
  const options = watchedPlanOptions(plan)

  return (
    <article className="glass-flat overflow-hidden rounded-[18px] border-white/[0.09]">
      <button
        type="button"
        className="flex w-full items-start gap-3 px-3.5 py-3 text-left"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Hide' : 'Show'} full plan for ${plan.title}`}
      >
        <span
          className={cn(
            'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border shadow-[inset_0_1px_rgba(255,255,255,0.06)]',
            userMade
              ? 'border-white/10 bg-white/[0.04] text-ink-soft'
              : 'border-brand-400/20 bg-brand-500/[0.09] text-brand-300',
          )}
          aria-hidden
        >
          {userMade ? <UserRound size={15} /> : <Bot size={15} />}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span
              className={cn(
                'rounded-full border px-1.5 py-0.5 text-[8px] leading-none font-extrabold tracking-[0.05em] uppercase',
                userMade
                  ? 'border-white/[0.08] bg-white/[0.035] text-ink-soft'
                  : 'ai-criterion-rainbow border-white/20',
              )}
            >
              {userMade ? 'Your plan' : 'AI plan'}
            </span>
            <span className="rounded-full bg-up-soft px-1.5 py-px text-[8px] font-bold tracking-[0.05em] text-up uppercase">
              Active
            </span>
          </span>
          <span className="mt-1 line-clamp-2 text-[12.5px] leading-snug font-semibold text-ink">
            {prompt}
          </span>
        </span>

        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/[0.14] bg-white/[0.08] text-white/65 shadow-[inset_0_1px_rgba(255,255,255,0.08)]">
          <ChevronDown
            size={14}
            className={cn('transition-transform duration-200', expanded && 'rotate-180')}
          />
        </span>
      </button>

      {expanded ? (
        <div className="border-t border-white/[0.075] px-3.5 py-3">
          <div className="liquid-inset mb-3 rounded-[15px] px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[8.5px] font-bold tracking-[0.07em] text-ink-muted uppercase">
                <Sparkles size={11} className="text-brand-300" /> Plan prompt
              </span>
              {!editingPrompt ? (
                <button
                  type="button"
                  className="plan-action-button inline-flex h-7 items-center gap-1 rounded-full border border-brand-300/25 bg-brand-400/[0.16] px-2.5 text-[9.5px] font-bold text-[#b9dcff] shadow-[0_6px_16px_-12px_rgba(91,166,255,0.9)] hover:bg-brand-400/[0.25]"
                  onClick={() => {
                    setPromptText(prompt)
                    setEditingPrompt(true)
                  }}
                >
                  <Pencil size={10} /> Edit prompt
                </button>
              ) : null}
            </div>
            {editingPrompt ? (
              <div className="mt-2 space-y-2">
                <textarea
                  rows={4}
                  value={promptText}
                  onChange={(event) => setPromptText(event.target.value)}
                  aria-label="Plan prompt"
                  className={cn(planInputClass(false), 'h-auto resize-none py-2.5 leading-relaxed')}
                />
                <p className="text-[10px] leading-relaxed text-white/62">
                  StratFolio AI will adjust intent, max per trade, entry, target, and stop when you
                  mention them.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="border-white/[0.14] bg-white/[0.08] text-white/80 hover:bg-white/[0.13]"
                    onClick={() => setEditingPrompt(false)}
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
                      setEditingPrompt(false)
                    }}
                  >
                    <Sparkles size={12} />
                    {updatePlan.isPending ? 'Adjusting…' : 'Update with AI'}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mt-1.5 text-[11px] leading-relaxed font-semibold text-white/78">
                {prompt}
              </p>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-3">
            {planIntent(plan) === 'close' ? (
              <PlanDetail label="Position" value="Close existing position" />
            ) : (
              <PlanDetail
                icon={<CircleDollarSign size={12} />}
                label="Max"
                value={formatMoney(plan.maxAmount ?? fallbackMaxAmount, { whole: true })}
              />
            )}
            <PlanDetail
              label="Position intent"
              value={planIntent(plan) === 'close' ? 'Close position' : 'Open position'}
            />
            <PlanDetail
              icon={<UserRound size={12} />}
              label="Plan owner"
              value={userMade ? 'Your plan' : 'AI plan'}
            />
            <PlanDetail
              icon={<Target size={12} />}
              label="Entry target"
              value={formatRange(plan.entryLow, plan.entryHigh)}
            />
            <PlanDetail
              icon={<Target size={12} />}
              label="Exit target"
              value={formatRange(plan.targetLow, plan.targetHigh)}
            />
            <PlanDetail
              icon={<ShieldAlert size={12} />}
              label="Risk"
              value={plan.risks[0] || 'No specific risk recorded.'}
              wide
            />
            <PlanDetail label="Reason" value={plan.notes || 'No reason recorded.'} wide />
            <PlanDetail
              icon={<Newspaper size={12} />}
              label="Related news"
              value={plan.relatedNews || plan.sourceArticleHeadline || 'No related news.'}
              wide
            />
          </dl>

          <div className="mt-3 border-t border-white/[0.075] pt-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[8.5px] font-bold tracking-[0.07em] text-ink-muted uppercase">
                Options to watch · {options.length}/3
              </span>
              {!editingOptions ? (
                <button
                  type="button"
                  className="plan-action-button inline-flex h-7 items-center gap-1 rounded-full border border-brand-300/25 bg-brand-400/[0.16] px-2.5 text-[9.5px] font-bold text-[#b9dcff] shadow-[0_6px_16px_-12px_rgba(91,166,255,0.9)] hover:bg-brand-400/[0.25]"
                  onClick={() => setEditingOptions(true)}
                >
                  <Pencil size={10} /> Edit
                </button>
              ) : null}
            </div>
            {editingOptions ? (
              <div className="mt-2 space-y-2">
                <textarea
                  rows={3}
                  value={optionText}
                  onChange={(event) => setOptionText(event.target.value)}
                  placeholder="One option contract per line (up to 3)"
                  className={cn(planInputClass(false), 'h-auto resize-none py-2.5 leading-relaxed')}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="border-white/[0.14] bg-white/[0.08] text-white/80 hover:bg-white/[0.13]"
                    onClick={() => setEditingOptions(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="border border-emerald-300/25 bg-emerald-400/80 text-[#071a12] hover:bg-emerald-300"
                    disabled={updatePlan.isPending}
                    onClick={async () => {
                      await updatePlan.mutateAsync({
                        id: plan.id,
                        input: { watchedOptions: parseWatchedOptions(optionText) },
                      })
                      setEditingOptions(false)
                    }}
                  >
                    {updatePlan.isPending ? 'Saving…' : 'Save watch list'}
                  </Button>
                </div>
              </div>
            ) : options.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {options.map((option) => (
                  <span
                    key={option}
                    className="rounded-full border border-brand-300/30 bg-brand-400/[0.16] px-2.5 py-1 text-[9.5px] font-semibold text-[#b9dcff] shadow-[inset_0_1px_rgba(255,255,255,0.08)]"
                  >
                    {option}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-1.5 text-[10.5px] text-white/65">No option contracts watched yet.</p>
            )}
          </div>

          <Button
            size="lg"
            variant="success"
            className="plan-action-button mt-3 h-11 w-full justify-center rounded-[14px]"
            onClick={onOpenPlanner}
          >
            Open full plan
          </Button>
        </div>
      ) : null}
    </article>
  )
}

function PlanDetail({
  icon,
  label,
  value,
  wide,
}: {
  icon?: React.ReactNode
  label: string
  value: string
  wide?: boolean
}) {
  return (
    <div className={cn('min-w-0', wide && 'col-span-2')}>
      <dt className="flex items-center gap-1 text-[8.5px] font-bold tracking-[0.07em] text-ink-muted uppercase">
        {icon ? <span className="text-brand-300">{icon}</span> : null}
        {label}
      </dt>
      <dd className="mt-0.5 text-[11px] leading-relaxed font-semibold text-white/78">{value}</dd>
    </div>
  )
}

function EmptyPlans({ position }: { position: Position }) {
  return (
    <div className="liquid-inset rounded-[18px] px-5 py-6 text-center">
      {/* Notepad and badge share one dimmed tone so neither reads as active. */}
      <span className="relative mx-auto grid h-10 w-10 place-items-center rounded-full border border-brand-400/20 bg-brand-500/[0.08] text-brand-200">
        <NotebookPen size={18} />
        <span className="absolute -right-1.5 -bottom-1.5 grid h-[17px] w-[17px] place-items-center rounded-full border border-brand-400/30 bg-[#101a2b] text-[10px] leading-none font-black text-brand-200">
          ?
        </span>
      </span>
      <h3 className="mt-2.5 text-[14px] font-extrabold text-ink">No plans for this position</h3>
      <p className="mx-auto mt-1 max-w-[310px] text-[11.5px] leading-relaxed text-ink-muted">
        Add a plan scoped specifically to {position.contractDetail ?? position.symbol}. Other
        contracts will not appear here.
      </p>
    </div>
  )
}

function AddPlanForm({
  form,
  set,
  promptError,
  clearPromptError,
  position,
  sizing,
}: {
  form: PlanFormState
  set: <K extends keyof PlanFormState>(key: K, value: PlanFormState[K]) => void
  promptError: string
  clearPromptError: () => void
  position: Position
  sizing: { balance: number; cash: number }
}) {
  const adjustment = adjustPlanFromPrompt(form.originalPrompt, sizing)
  const inferredEntryLow = adjustment.entryLow ?? position.avgCost
  const inferredEntryHigh = adjustment.entryHigh ?? position.avgCost
  const inferredTargetLow = adjustment.targetLow ?? position.ai.targetLow
  const inferredTargetHigh = adjustment.targetHigh ?? position.ai.targetHigh
  const inferredStop = adjustment.stop ?? Math.max(0.01, position.avgCost * 0.8)

  return (
    <div className="space-y-3.5">
      <PlanField label="Open or close">
        <DropdownMenu.Root modal={false}>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label="Open or close"
              className="liquid-control flex h-11 w-full items-center rounded-xl px-3 text-left text-[13px] font-semibold text-white/88 outline-none transition-[border-color,background-color,box-shadow] data-[state=open]:border-brand-300/30 data-[state=open]:bg-brand-400/[0.1] data-[state=open]:shadow-[0_0_0_3px_rgba(91,166,255,0.07)]"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full border border-brand-300/18 bg-brand-400/[0.09] text-brand-200">
                {form.intent === 'open' ? <Plus size={13} /> : <Target size={13} />}
              </span>
              <span className="ml-2.5">{form.intent === 'open' ? 'Open position' : 'Close position'}</span>
              <ChevronDown
                size={14}
                className="ml-auto text-white/55 transition-transform duration-200 [[data-state=open]_&]:rotate-180"
              />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="start"
              sideOffset={5}
              className="menu-surface z-[80] w-[var(--radix-dropdown-menu-trigger-width)] origin-[var(--radix-dropdown-menu-content-transform-origin)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=closed]:fade-out data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-1"
            >
              {(['open', 'close'] as const).map((intent) => {
                const active = form.intent === intent
                return (
                  <DropdownMenu.Item
                    key={intent}
                    onSelect={() => {
                      clearPromptError()
                      set('intent', intent)
                    }}
                    className="menu-item"
                  >
                    <span
                      className={cn(
                        'grid h-7 w-7 place-items-center rounded-full border',
                        active
                          ? 'border-brand-300/25 bg-brand-400/[0.14] text-brand-200'
                          : 'border-white/[0.08] bg-white/[0.035] text-white/55',
                      )}
                    >
                      {intent === 'open' ? <Plus size={13} /> : <Target size={13} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] font-bold text-white/88">
                        {intent === 'open' ? 'Open position' : 'Close position'}
                      </span>
                      <span className="mt-0.5 block text-[9.5px] text-white/52">
                        {intent === 'open'
                          ? 'Add or increase exposure'
                          : 'Reduce or exit this holding'}
                      </span>
                    </span>
                    {active ? <Check size={14} className="text-brand-200" /> : null}
                  </DropdownMenu.Item>
                )
              })}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </PlanField>
      <PlanField label="Plan prompt" required={form.intent === 'open'} error={promptError}>
        <textarea
          rows={4}
          value={form.originalPrompt}
          onChange={(event) => {
            clearPromptError()
            set('originalPrompt', event.target.value)
          }}
          placeholder="Max dollars, % or fraction of balance/cash, targets, risk, horizon…"
          aria-invalid={Boolean(promptError)}
          className={cn(
            planInputClass(Boolean(promptError)),
            'h-auto resize-none py-2.5 leading-relaxed placeholder:italic',
          )}
        />
        <span className="mt-1 block text-[10px] leading-relaxed text-white/58">
          {form.intent === 'open'
            ? 'Set max sizing in dollars or naturally, like “5% of capital” or “1/3 of cash.” A max amount is required to open.'
            : 'Type anything from price targets and bands to a de-risk strategy or horizon.'}
        </span>
      </PlanField>

      <section className="liquid-inset overflow-hidden rounded-[18px] border-white/[0.085]">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-3 py-2.5">
          <span className="flex items-center gap-1.5 text-[9px] font-extrabold tracking-[0.07em] text-white/68 uppercase">
            <Sparkles size={11} className="text-brand-300" /> Live AI plan fields
          </span>
          <span className="inline-flex items-center gap-1 text-[8.5px] font-bold text-up/80">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-up" /> Parsing prompt
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 px-3 py-3">
          {form.intent === 'open' ? (
            <LivePlanField
              label="Max amount"
              value={
                adjustment.maxAmount
                  ? formatMoney(adjustment.maxAmount, { whole: true })
                  : 'Required in prompt'
              }
              missing={!adjustment.maxAmount}
            />
          ) : (
            <LivePlanField label="Position" value="Close existing position" />
          )}
          <LivePlanField
            label="Entry"
            value={formatRange(inferredEntryLow, inferredEntryHigh)}
            inferred={!adjustment.entryLow}
          />
          <LivePlanField
            label="Target"
            value={formatRange(inferredTargetLow, inferredTargetHigh)}
            inferred={!adjustment.targetLow}
          />
          <LivePlanField
            label="Stop"
            value={formatMoney(inferredStop)}
            inferred={!adjustment.stop}
          />
        </dl>
        <p className="border-t border-white/[0.07] px-3 py-2 text-[9.5px] leading-relaxed text-white/56">
          Mention sizing, entry, target, stop, timing, risk, or news naturally. Missing values use
          the live position and AI thesis context.
        </p>
      </section>

      <PlanField label="Options to watch (up to 3)">
        <textarea
          rows={3}
          value={form.watchedOptions}
          onChange={(event) => set('watchedOptions', event.target.value)}
          placeholder="One option contract per line"
          className={cn(planInputClass(false), 'h-auto resize-none py-2.5 leading-relaxed')}
        />
      </PlanField>
    </div>
  )
}

function LivePlanField({
  label,
  value,
  inferred,
  missing,
}: {
  label: string
  value: string
  inferred?: boolean
  missing?: boolean
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[8px] font-bold tracking-[0.07em] text-white/48 uppercase">
        {label}
      </dt>
      <dd className={cn('mt-0.5 truncate text-[11px] font-bold text-white/82', missing && 'text-down/90')}>
        {value}
      </dd>
      {inferred ? <span className="text-[8px] font-semibold text-brand-200/58">AI inferred</span> : null}
    </div>
  )
}

function PlanField({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[9.5px] font-bold tracking-[0.07em] text-ink-muted uppercase">
        {label}
        {required ? <span className="ml-1 text-brand-300">Required</span> : null}
      </span>
      {children}
      {error ? <span className="mt-1 block text-[10.5px] font-semibold text-down">{error}</span> : null}
    </label>
  )
}

function planInputClass(hasError: boolean): string {
  return cn(
    'liquid-control h-10 w-full rounded-xl px-3 text-[13px] font-medium text-ink outline-none placeholder:text-ink-muted/65',
    hasError && 'border-down',
  )
}

function initialPlanForm(position: Position): PlanFormState {
  return {
    intent: 'open',
    originalPrompt: '',
    watchedOptions: position.contractDetail ?? '',
  }
}

function parseWatchedOptions(value: string): string[] {
  return [...new Set(value.split(/[\n,]/).map((option) => option.trim()).filter(Boolean))].slice(0, 3)
}

function fallbackPositionMaxAmount(position: Position): number {
  const multiplier = position.assetType === 'option' ? 100 : 1
  const costBasis = position.avgCost * position.quantity * multiplier
  return Math.max(250, Math.round((costBasis * 0.15) / 50) * 50)
}

function originalPrompt(plan: PlannerIdea): string {
  return plan.originalPrompt?.trim() || plan.title.trim() || plan.notes.trim()
}

function formatRange(low: number, high: number): string {
  return low === high ? formatMoney(low) : `${formatMoney(low)} – ${formatMoney(high)}`
}

export function positionPlanPresentation(
  position: Position,
  plan?: PlannerIdea,
): PositionPlanPresentation {
  if (plan) {
    return {
      source: plan.source,
      title: plan.title,
      notes: plan.notes,
      trigger: plan.horizon,
      target: `${formatMoney(plan.targetLow)} – ${formatMoney(plan.targetHigh)}`,
    }
  }

  const earningsTrigger = position.option?.earningsDate
    ? `Before ${formatPlanDate(position.option.earningsDate)} earnings`
    : position.ai.horizon

  return {
    source: 'ai',
    title: 'Trim half before earnings on a run-up',
    notes: `${position.ai.recommendationNote} Keep the remaining position working only while the core thesis and risk limit remain intact.`,
    trigger: earningsTrigger,
    target: `${formatMoney(position.ai.targetLow)} – ${formatMoney(position.ai.targetHigh)}`,
  }
}

function formatPlanDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(iso))
}
