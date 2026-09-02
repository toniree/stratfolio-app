import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { LogOut, Minus, SendHorizonal } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { PlannerIdea } from '@/api/newsTypes'
import type { Position } from '@/api/types'
import { PlanNoteIcon } from '@/components/shared/PlanNoteIcon'
import { ManualCloseTicket, isManualCloseAvailable } from '@/components/positions/ManualCloseTicket'
import { PositionPlanSheet } from '@/components/positions/PositionPlanSheet'
import { useAssistantChatStore } from '@/store/assistantChatStore'

/**
 * Shown once the composer opens. Weighted toward instructions a holder would
 * give about a position they already own — sizing up, trimming, and exits —
 * rather than the entry questions the thesis composer suggests.
 */
const POSITION_EXAMPLES = [
  'Make a plan for adding onto this position throughout the month',
  'Trim 25% if it gaps up',
  'Close half before earnings',
]

/**
 * The action bar under a position: exit, ask or plan, and open the plan sheet.
 * Mirrors the thesis footer so the two detail pages behave identically — the
 * verbs differ because the position is already owned.
 */
export function PositionActionFooter({
  position,
  price,
  previousClose,
  plans,
  onOpenPlanner,
}: {
  position: Position
  price: number
  previousClose?: number
  plans: PlannerIdea[]
  onOpenPlanner: (plan: PlannerIdea) => void
}) {
  const [question, setQuestion] = useState('')
  const [minimized, setMinimized] = useState(false)
  const [closing, setClosing] = useState(false)
  const [planning, setPlanning] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const sendMessage = useAssistantChatStore((state) => state.sendMessage)
  const thinking = useAssistantChatStore((state) => state.thinking)

  const draft = question.trim()
  const expanded = question.length > 0 && !minimized
  const contract = position.contractDetail
    ? `${position.symbol} ${position.contractDetail}`
    : position.symbol

  const ask = (event: React.FormEvent) => {
    event.preventDefault()
    const text = draft
    if (!text || thinking) return
    setQuestion('')
    setMinimized(false)
    void sendMessage(`About my ${contract} position — ${text}`, {
      kind: 'position',
      id: position.id,
      label: contract,
      detail: position.ai
        ? `${position.ai.recommendation} · ${position.ai.conviction}/100 conviction`
        : undefined,
      to: `/app/positions/${position.id}`,
    })
  }

  const prompt = `Ask AI anything about this position… ex) "should I add here?"`

  return (
    <>
      <div className="glass-chrome sticky bottom-[76px] z-30 grid min-h-[50px] grid-cols-[40px_minmax(0,1fr)] items-center gap-2.5 rounded-[20px] border border-brand-300/25 px-3 py-2 shadow-[0_18px_44px_-20px_rgba(0,0,0,0.9),inset_0_1px_rgba(255,255,255,0.12)] lg:bottom-4 lg:mx-auto lg:max-w-[520px]">
        <button
          type="button"
          aria-label={`Exit the ${position.symbol} position`}
          // Disabled, not hidden, for the one live row that cannot be exited:
          // a position the platform service never linked to a silent trade has
          // no id bkt's exit route can take. The user should see that exiting
          // exists rather than wonder where the control went.
          disabled={!isManualCloseAvailable(position)}
          title={
            isManualCloseAvailable(position)
              ? undefined
              : 'This position is not linked to a silent trade, so the execution service cannot close it.'
          }
          onClick={() => setClosing(true)}
          className="grid h-10 w-10 place-items-center justify-self-start rounded-full border border-red-300/22 bg-red-400/[0.09] text-red-200/95 transition-transform active:translate-y-px active:scale-[0.96] disabled:opacity-40"
        >
          <LogOut size={16} strokeWidth={2.4} />
        </button>

        {/* Everything below stays mounted across both states and switches with
            classes alone: remounting the field on the first keystroke would
            drop focus and close the phone keyboard. */}
        <form onSubmit={ask} className="relative min-h-9 min-w-0">
          <motion.div
            layout
            transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
            className={cn(
              'flex flex-col',
              expanded &&
                'glass-chrome absolute right-0 -left-[50px] bottom-0 z-30 gap-2 rounded-[18px] border border-line p-2.5 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.95)]',
            )}
          >
            <div className={cn('items-center justify-between', expanded ? 'flex' : 'hidden')}>
              <span className="min-w-0 truncate text-[9.5px] font-bold tracking-[0.09em] text-ink-muted uppercase">
                Ask or plan · {contract}
              </span>
              <button
                type="button"
                aria-label="Minimize the position composer"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setMinimized(true)
                  inputRef.current?.blur()
                }}
                className="grid h-6 w-6 place-items-center rounded-full text-ink-muted transition-colors hover:bg-white/[0.07] hover:text-ink"
              >
                <Minus size={13} strokeWidth={2.6} />
              </button>
            </div>

            <div className="flex min-w-0 items-center">
              <div className="relative min-w-0 flex-1">
                <input
                  ref={inputRef}
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  onFocus={() => setMinimized(false)}
                  aria-label={`Ask AI about the ${position.symbol} position`}
                  placeholder={prompt}
                  className="liquid-control h-9 w-full min-w-0 rounded-full px-3 text-[11px] text-ink outline-none placeholder:text-transparent"
                />
                {question === '' ? (
                  <div className="pointer-events-none absolute inset-y-0 right-3 left-3 flex items-center overflow-hidden">
                    <div className="thesis-ask-track flex shrink-0 whitespace-nowrap text-[9.5px] text-[#8b97ad] italic">
                      <span className="pr-8">{prompt}</span>
                      <span className="pr-8" aria-hidden>
                        {prompt}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>

              <button
                type="submit"
                aria-label="Send question to StratFolio AI"
                disabled={!draft || thinking}
                onMouseDown={(event) => event.preventDefault()}
                className={cn(
                  'ml-1.5 h-9 w-9 shrink-0 place-items-center rounded-full border border-brand-300/30 bg-brand-400/[0.16] text-white transition-[background-color,transform] hover:bg-brand-400/[0.24] active:scale-95 disabled:opacity-40',
                  expanded ? 'grid' : 'hidden',
                )}
              >
                <SendHorizonal size={15} strokeWidth={2.2} />
              </button>

              {/* Planning is a decision about the position, not about the draft,
                  so it steps aside while a question is being written. */}
              <button
                type="button"
                aria-label={`Plan the ${position.symbol} position`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setPlanning(true)}
                className={cn(
                  'ml-1.5 h-9 w-9 shrink-0 place-items-center rounded-full border border-emerald-200/28 bg-emerald-400/[0.16] text-emerald-100/95 transition-[background-color,transform] hover:bg-emerald-400/[0.25] active:scale-95',
                  expanded ? 'hidden' : 'grid',
                )}
              >
                <PlanNoteIcon size={19} />
              </button>
            </div>

            <div className={cn('flex-wrap gap-1.5', expanded ? 'flex' : 'hidden')}>
              {POSITION_EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setQuestion(example)
                    inputRef.current?.focus()
                  }}
                  className="rounded-full border border-line bg-white/[0.04] px-2.5 py-1 text-[9.5px] text-ink-soft transition-colors hover:bg-white/[0.09] hover:text-ink"
                >
                  {example}
                </button>
              ))}
            </div>
          </motion.div>
        </form>
      </div>

      <ManualCloseTicket
        position={position}
        price={price}
        previousClose={previousClose}
        open={closing}
        onOpenChange={setClosing}
      />
      <PositionPlanSheet
        position={position}
        plans={plans}
        open={planning}
        onOpenChange={setPlanning}
        onOpenPlanner={onOpenPlanner}
      />
    </>
  )
}
