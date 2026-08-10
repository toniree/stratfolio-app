import { useEffect, useState } from 'react'
import { BrainCircuit, Check, MessageCircle, Trash2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { Idea } from '@/api/types'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

export type ThesisDecisionMode = 'reject' | 'add'

export function ThesisDecisionModal({
  idea,
  mode,
  open,
  pending,
  initialReason = '',
  onOpenChange,
  onConfirm,
}: {
  idea: Idea
  mode: ThesisDecisionMode
  open: boolean
  pending?: boolean
  /** Carries a note already typed elsewhere into the field. */
  initialReason?: string
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string) => void | Promise<void>
}) {
  const [reason, setReason] = useState(initialReason)
  const adding = mode === 'add'

  useEffect(() => {
    if (open) setReason(initialReason)
  }, [open, mode, initialReason])

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      className="sm:w-[min(460px,calc(100vw-2rem))]"
      // Adding is a single-purpose sheet, and the contract is already named in
      // the body — so it carries one centred banner instead of a title block.
      align={adding ? 'center' : 'left'}
      title={
        adding ? (
          <span className="block text-[13px] font-extrabold tracking-[0.16em] text-ink uppercase">
            Active plans
          </span>
        ) : (
          <span className="-mt-[2mm] block">{`Reject ${idea.symbol} thesis`}</span>
        )
      }
      description={adding ? undefined : (idea.contractDetail ?? idea.company)}
      footer={
        <div className="grid grid-cols-[0.8fr_1.2fr] gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {adding ? 'Cancel' : 'Back'}
          </Button>
          <Button
            variant={adding ? 'success' : 'danger'}
            onClick={() => void onConfirm(reason.trim())}
            disabled={pending}
          >
            {adding ? <Check size={15} /> : <Trash2 size={15} />}
            {pending ? 'Saving…' : adding ? 'Add trade plan' : 'Close thesis'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3.5">
        <div
          className={cn(
            'liquid-inset flex items-start gap-3 rounded-[18px] px-3.5 py-3 text-[12px] leading-relaxed text-ink-soft',
            adding ? 'border-emerald-300/15' : 'border-white/[0.08]',
          )}
        >
          <span
            className={cn(
              'grid h-8 w-8 shrink-0 place-items-center rounded-full border',
              adding
                ? 'border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-200'
                : 'border-white/10 bg-white/[0.035] text-ink-muted',
            )}
          >
            <BrainCircuit size={15} />
          </span>
          <p>
            {adding
              ? 'Prompt is optional. Type anything from max capital, price targets and bands, to a de-risk strategy or horizon.'
              : 'A reason is optional. Sharing one helps the model learn which theses fit your strategy and which ones do not.'}
          </p>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[9.5px] font-bold tracking-[0.07em] text-ink-muted uppercase">
            Reason <span className="font-semibold normal-case opacity-70">Optional</span>
          </span>
          <span className="liquid-inset flex items-start gap-2.5 rounded-[18px] border border-white/[0.08] p-2.5 shadow-[inset_0_1px_rgba(255,255,255,0.045)] focus-within:border-brand-300/25">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-brand-300/45 bg-brand-400/[0.13] text-white">
              <MessageCircle size={14} />
            </span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              placeholder={
                adding
                  ? '(Optional) max capital, targets and bands, de-risk strategy, horizon…'
                  : '(Optional) give a reason for AI to understand the rejection'
              }
              className="min-h-[96px] w-full resize-none bg-transparent px-1 py-1.5 text-[13px] leading-relaxed text-ink outline-none placeholder:text-ink-muted/65 placeholder:italic"
            />
          </span>
        </label>
      </div>
    </Modal>
  )
}
