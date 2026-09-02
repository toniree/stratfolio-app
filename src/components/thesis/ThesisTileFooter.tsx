import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Minus, SendHorizonal, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { ThesisView } from '@/api/types'
import { recordUserDecision } from '@/api/http/userActivity'
import { useAssistantChatStore } from '@/store/assistantChatStore'
import { useThesisDecisionStore } from '@/store/thesisDecisionStore'
import { PlanNoteIcon } from '@/components/shared/PlanNoteIcon'
import { ThesisDecisionModal } from '@/components/thesis/ThesisDecisionModal'

/**
 * A rival the trader is most likely to raise, so the prompt suggests the
 * question they were already going to ask. Falls back to a neutral phrasing
 * for anything outside the demo book.
 */
const RIVALS: Record<string, string> = {
  NVDA: 'AMD',
  AMD: 'NVDA',
  TSM: 'Samsung Foundry',
  MU: 'SK Hynix',
  SNDK: 'Micron',
  WDC: 'Seagate',
  AVGO: 'Marvell',
  PLTR: 'Snowflake',
  TSLA: 'BYD',
  AAPL: 'Samsung',
  MSFT: 'Google Cloud',
  GOOGL: 'Microsoft',
  AMZN: 'Walmart',
  META: 'TikTok',
  SMCI: 'Dell',
  CRDO: 'Astera Labs',
  WMT: 'Costco',
  SPY: 'QQQ',
}

/**
 * Shown once the composer opens. Deliberately weighted toward planning
 * instructions rather than questions — the field is the way into a plan, and
 * these teach the shape of an instruction the planner can act on.
 */
const ASK_EXAMPLES = [
  'Plan 1% of my capital on this',
  'Wait for more good news, then make a plan',
  "Let's put $100 on this, 1 year timeframe",
]

/**
 * Thesis tiles close with the same glossy banner the position tiles use, but
 * the actions differ: there is no position to exit yet, so the decisions are
 * "not for me" and "convince me".
 */
export function ThesisTileFooter({
  thesis,
  variant = 'tile',
  onDecided,
}: {
  thesis: ThesisView
  /**
   * `tile` sits inside a carousel card and hides on desktop, where the tile
   * grows its own stat strip. `page` is the sticky bar on a thesis details
   * page, which has no such alternative and so shows at every width.
   */
  variant?: 'tile' | 'page'
  /**
   * Fires once a thesis is added or rejected. A tile can simply drop out of the
   * feed, but a details page is still showing a thesis that no longer belongs
   * there, so the page uses this to navigate away.
   */
  onDecided?: () => void
}) {
  const [question, setQuestion] = useState('')
  const [minimized, setMinimized] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const sendMessage = useAssistantChatStore((state) => state.sendMessage)
  const thinking = useAssistantChatStore((state) => state.thinking)
  const decide = useThesisDecisionStore((state) => state.decide)
  const [rejecting, setRejecting] = useState(false)
  const [planning, setPlanning] = useState(false)
  const [saving, setSaving] = useState(false)
  const idea = thesis.idea
  const rival = RIVALS[thesis.symbol] ?? 'the market leader'

  // Composing starts at the first character, not at focus — tapping the field
  // should still let you read the scrolling prompt before committing to it.
  const draft = question.trim()
  const expanded = question.length > 0 && !minimized

  const reset = () => {
    setQuestion('')
    setMinimized(false)
    if (inputRef.current) inputRef.current.style.height = ''
  }

  /**
   * The composer is anchored to the footer's bottom edge, so growing the
   * field's height expands the bubble upward. Height tracks content up to
   * four lines, then the field scrolls internally.
   */
  const autosize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`
  }

  const contract = idea?.option
    ? `${thesis.symbol} $${idea.option.strike}${idea.option.right === 'CALL' ? 'C' : 'P'} ${idea.option.expiryLabel}`
    : thesis.symbol

  /**
   * Accepting a thesis.
   *
   * This used to derive a whole trade plan from the thesis in the browser —
   * an entry band from the demo idea's numbers, a stop at 65% of the entry
   * low, a title lifted from the model's first sentence — and save it as if
   * the user had written it. plt records no disposition on a thesis
   * (HKP-PLT-3), and a client that answers a missing field by *inventing a
   * trade plan* is the fabrication §3.3 deletes.
   *
   * What an acceptance is now: local state, plus a schema-valid `USER_ACTIVITY`
   * row in plt so the decision is durable and auditable. Turning a thesis into
   * a position is the ticket's job, with a real contract.
   */
  const acceptThesis = async (note: string) => {
    if (saving) return
    setSaving(true)
    decide(thesis.id, 'added', note || undefined)
    // The audit row is best-effort by design: the decision is already recorded
    // locally, so a failed write must not undo it.
    await recordUserDecision({
      decision: 'THESIS_ACCEPTED',
      entityType: 'thesis',
      entityId: thesis.id,
      reason: note || undefined,
    })
    setSaving(false)
    reset()
    setPlanning(false)
    onDecided?.()
  }

  const ask = (event: React.FormEvent) => {
    event.preventDefault()
    event.stopPropagation()
    const text = question.trim()
    if (!text || thinking) return
    reset()
    // Carry the contract into the shared thread so the reply has context even
    // though the conversation continues in the floating assistant.
    void sendMessage(`About the ${contract} thesis — ${text}`, {
      kind: 'thesis',
      id: thesis.id,
      label: contract,
      detail: idea?.ai
        ? `${idea.ai.recommendation} · ${idea.ai.conviction}/100 conviction`
        : `${thesis.direction} thesis`,
      to: `/app/thesis/${thesis.id}`,
    })
  }

  const prompt = `Ask AI anything about this thesis… ex) "why not ${rival}?"`

  /**
   * A rejection with a reason is the most valuable kind: it tells the model
   * what it got wrong in the user's own words, so the note goes to the
   * assistant thread as well as into the decision record.
   */
  const closeThesis = (reason: string) => {
    decide(thesis.id, 'rejected', reason || undefined)
    void recordUserDecision({
      decision: 'THESIS_REJECTED',
      entityType: 'thesis',
      entityId: thesis.id,
      reason: reason || undefined,
    })
    setRejecting(false)
    onDecided?.()
    if (!reason) return
    void sendMessage(`I passed on the ${contract} thesis — ${reason}`, {
      kind: 'thesis',
      id: thesis.id,
      label: contract,
      detail: idea?.ai
        ? `${idea.ai.recommendation} · ${idea.ai.conviction}/100 conviction`
        : `${thesis.direction} thesis`,
      to: `/app/thesis/${thesis.id}`,
    })
  }

  return (
    <>
    <div
      className={cn(
        'grid min-h-[50px] grid-cols-[40px_minmax(0,1fr)] items-center gap-2.5 py-2',
        variant === 'tile'
          ? 'tile-footer-gloss mt-auto -mx-3.5 -mb-3.5 px-3.5 lg:hidden'
          : 'glass-chrome sticky bottom-[76px] z-30 rounded-[20px] border border-brand-300/25 px-3 shadow-[0_18px_44px_-20px_rgba(0,0,0,0.9),inset_0_1px_rgba(255,255,255,0.12)] lg:bottom-4 lg:mx-auto lg:max-w-[520px]',
      )}
    >
      <button
        type="button"
        aria-label={`Reject the ${thesis.symbol} thesis`}
        onClick={(event) => {
          event.stopPropagation()
          setRejecting(true)
        }}
        className="group grid h-10 w-10 place-items-center justify-self-start rounded-full border border-red-300/22 bg-red-400/[0.09] text-red-200/95 transition-transform active:translate-y-px active:scale-[0.96]"
      >
        <X size={17} strokeWidth={2.4} />
      </button>

      {/*
        Every element below stays mounted across both states and switches with
        classes alone. Swapping the field for a taller one on the first keystroke
        would remount it, dropping focus and closing the phone keyboard.
      */}
      <form onSubmit={ask} className="relative min-h-9 min-w-0">
        <motion.div
          layout
          transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
          // The tile itself is a link; taps inside the composer must not reach it.
          onClick={(event) => event.stopPropagation()}
          className={cn(
            'flex flex-col',
            // Reaches back over the reject button so the composer owns the full
            // width, and grows upward from the footer it is anchored to.
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
              aria-label="Minimize the thesis composer"
              onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => {
                event.stopPropagation()
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
              <textarea
                ref={inputRef}
                rows={1}
                value={question}
                onChange={(event) => {
                  setQuestion(event.target.value)
                  autosize(event.target)
                }}
                onKeyDown={(event) => {
                  // Enter sends, Shift+Enter breaks the line — the same contract
                  // as every desktop chat composer.
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    event.currentTarget.form?.requestSubmit()
                  }
                }}
                onClick={(event) => event.stopPropagation()}
                onFocus={() => setMinimized(false)}
                aria-label={`Ask AI about the ${thesis.symbol} thesis`}
                // Kept for assistive tech, but drawn by the marquee below so the
                // whole prompt can be read rather than truncated.
                placeholder={prompt}
                className={cn(
                  'liquid-control block max-h-24 min-h-9 w-full min-w-0 resize-none overflow-y-auto rounded-[18px] px-3 py-2 text-[11px] leading-[1.45] text-ink outline-none',
                  'placeholder:text-transparent',
                )}
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
              onClick={(event) => event.stopPropagation()}
              className={cn(
                // White glyph, not brand-200 — that token is a 26%-alpha blue and
                // all but disappears against the button's own blue fill.
                'ml-1.5 h-9 w-9 shrink-0 place-items-center rounded-full border border-brand-300/30 bg-brand-400/[0.16] text-white transition-[background-color,transform] hover:bg-brand-400/[0.24] active:scale-95 disabled:opacity-40',
                expanded ? 'grid' : 'hidden',
              )}
            >
              <SendHorizonal size={15} strokeWidth={2.2} />
            </button>

            {/* Planning is a decision about the thesis, not about the draft, so
                it steps aside while a question is being written. */}
            <button
              type="button"
              aria-label={`Accept the ${thesis.symbol} thesis`}
              disabled={saving}
              onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => {
            event.stopPropagation()
            setPlanning(true)
          }}
              className={cn(
                'ml-1.5 h-9 w-9 shrink-0 place-items-center rounded-full border border-emerald-200/28 bg-emerald-400/[0.16] text-emerald-100/95 transition-[background-color,transform] hover:bg-emerald-400/[0.25] active:scale-95 disabled:opacity-40',
                expanded ? 'hidden' : 'grid',
              )}
            >
              <PlanNoteIcon size={19} />
            </button>
          </div>

          <div className={cn('flex-wrap gap-1.5', expanded ? 'flex' : 'hidden')}>
            {[...ASK_EXAMPLES, `Why not ${rival}?`].map((example) => (
              <button
                key={example}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={(event) => {
                  event.stopPropagation()
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

      <ThesisDecisionModal
        symbol={thesis.symbol}
        label={idea?.contractDetail ?? idea?.company}
        mode="add"
        open={planning}
        pending={saving}
        initialReason={draft}
        onOpenChange={setPlanning}
        onConfirm={acceptThesis}
      />

      <ThesisDecisionModal
        symbol={thesis.symbol}
        label={idea?.contractDetail ?? idea?.company}
        mode="reject"
        open={rejecting}
        onOpenChange={setRejecting}
        onConfirm={closeThesis}
      />
    </>
  )
}
