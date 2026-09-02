import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { PlannerIdea } from '@/api/newsTypes'
import { planCriteria } from '@/lib/planIntent'
import { useUpdatePlannerIdea } from '@/hooks/queries'
import { Button } from '@/components/ui/Button'
import {
  CRITERION_UNKNOWN_NOTE,
  CriterionIcon,
  criterionTextClass,
} from '@/components/plan/CriterionIcon'

/**
 * A plan's conditions, each with its evaluation state.
 *
 * Editing swaps the list for a one-condition-per-line textarea and persists
 * through the planner update API. A criterion whose wording survives the edit
 * keeps its state; new lines start `unknown` — not `unmet`. Nothing evaluates
 * an entry condition anywhere in the backend (HKP-XSV-1), so the app must not
 * imply it has checked and found the condition false.
 */
export function PlanCriteriaList({
  plan,
  editable = true,
  dimmed = false,
  className,
}: {
  plan: PlannerIdea
  editable?: boolean
  dimmed?: boolean
  className?: string
}) {
  const criteria = planCriteria(plan)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const updatePlan = useUpdatePlannerIdea()

  const save = async () => {
    const lines = draft
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 5)
    if (lines.length === 0) return
    await updatePlan.mutateAsync({
      id: plan.id,
      input: {
        criteria: lines.map((text) => ({
          text,
          state: criteria.find((c) => c.text === text)?.state ?? 'unknown',
        })),
      },
    })
    setEditing(false)
  }

  return (
    <div className={cn('min-w-0', dimmed && 'opacity-50', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[8px] font-extrabold tracking-[0.07em] text-white uppercase">
          Execution criteria
        </span>
        {editable && !editing ? (
          <button
            type="button"
            aria-label={`Edit the ${plan.symbol} plan criteria`}
            className="plan-action-button inline-flex h-6 shrink-0 items-center gap-1 rounded-full border border-white/[0.14] bg-white/[0.06] px-2 text-[9px] font-bold text-white/75 hover:bg-white/[0.12] hover:text-white"
            onClick={(event) => {
              event.stopPropagation()
              setDraft(criteria.map((c) => c.text).join('\n'))
              setEditing(true)
            }}
          >
            <Pencil size={9} /> Edit
          </button>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-2 space-y-2" onClick={(event) => event.stopPropagation()}>
          <textarea
            rows={4}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-label={`${plan.symbol} plan criteria, one per line`}
            className="liquid-control h-auto w-full resize-none rounded-[14px] px-3 py-2.5 text-[11px] leading-relaxed text-ink outline-none"
          />
          <p className="text-[9.5px] leading-relaxed text-white/62">
            One criterion per line. {CRITERION_UNKNOWN_NOTE}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="border-white/[0.14] bg-white/[0.08] text-white/80 hover:bg-white/[0.13]"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="border border-emerald-300/25 bg-emerald-400/80 text-[#071a12] hover:bg-emerald-300"
              disabled={updatePlan.isPending || !draft.trim()}
              onClick={save}
            >
              {updatePlan.isPending ? 'Saving…' : 'Save criteria'}
            </Button>
          </div>
        </div>
      ) : (
        <ul className="mt-1.5 space-y-1.5">
          {criteria.map((criterion) => (
            <li key={criterion.text} className="flex items-start gap-1.5">
              <CriterionIcon state={criterion.state} />
              <span className={cn('min-w-0 text-[10px] leading-snug', criterionTextClass(criterion.state))}>
                {criterion.text}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
