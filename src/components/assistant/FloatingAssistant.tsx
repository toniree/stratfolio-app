import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight, MessageCircle, Minus, SendHorizonal } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useAssistantChatStore } from '@/store/assistantChatStore'
import { AssistantAvatar } from '@/components/assistant/AssistantAvatar'
import { MobileAssistantSheet } from '@/components/assistant/MobileAssistantSheet'
import { useIsMobile } from '@/hooks/useMediaQuery'
import type { AssistantReference } from '@/store/repromptStore'

/** Settings owns the whole screen; the bubble would sit on top of its rows. */
const HIDDEN_ON = ['/app/profile']

export function FloatingAssistant() {
  const messages = useAssistantChatStore((s) => s.messages)
  const mode = useAssistantChatStore((s) => s.mode)
  const thinking = useAssistantChatStore((s) => s.thinking)
  const sendMessage = useAssistantChatStore((s) => s.sendMessage)
  const openWindow = useAssistantChatStore((s) => s.openWindow)
  const minimize = useAssistantChatStore((s) => s.minimize)
  const unread = useAssistantChatStore((s) => s.unread)
  const [value, setValue] = useState('')
  const logRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { pathname } = useLocation()
  const isMobile = useIsMobile()

  useEffect(() => {
    logRef.current?.scrollTo?.({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, thinking, mode])

  if (messages.length === 0) return null
  if (HIDDEN_ON.some((route) => pathname.startsWith(route))) return null

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const question = value.trim()
    if (!question || thinking) return
    setValue('')
    void sendMessage(question)
  }

  const handleMinimize = () => {
    // Blur before unmounting the fixed chat panel. On iOS this prevents the
    // keyboard focus state from leaving the visual viewport zoomed in.
    inputRef.current?.blur()
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    minimize()
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {mode === 'window' && isMobile ? (
        // Mobile parity: a tapped chat bubble opens the same StratFolio AI
        // box desktop shows — tabs, contents and AI settings included.
        <MobileAssistantSheet key="assistant-sheet" onMinimize={handleMinimize} />
      ) : mode === 'window' ? (
        <motion.section
          key="assistant-window"
          initial={{ opacity: 0, y: 18, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.96 }}
          transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
          role="region"
          aria-label="StratFolio assistant chat"
          className="glass-strong fixed right-3 bottom-[calc(72px+env(safe-area-inset-bottom))] left-3 z-50 flex h-[min(62svh,520px)] origin-bottom-right flex-col overflow-hidden rounded-[24px] shadow-[0_30px_80px_-28px_rgba(0,0,0,0.95)] sm:left-auto sm:w-[390px] lg:right-5 lg:bottom-5"
        >
          <header className="flex items-center gap-2.5 border-b border-line px-3.5 py-3">
            <AssistantAvatar size={34} />
            <div className="min-w-0 flex-1">
              <h2 className="text-[13.5px] font-extrabold text-ink">StratFolio AI</h2>
              <p className="text-[10.5px] text-ink-muted">
                {thinking ? 'Analyzing your portfolio…' : 'Conversation stays with you'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleMinimize}
              aria-label="Minimize assistant chat"
              className="grid h-8 w-8 place-items-center rounded-full text-ink-muted transition-colors hover:bg-white/[0.07] hover:text-ink"
            >
              <Minus size={16} strokeWidth={2.5} />
            </button>
          </header>

          <div
            ref={logRef}
            role="log"
            aria-live="polite"
            className="no-scrollbar min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3.5 py-3"
          >
            {messages.map((message, index) => {
              // Show the summary once per run of turns about the same entity.
              const previous = messages[index - 1]
              const showReference =
                Boolean(message.reference) &&
                message.reference?.id !== previous?.reference?.id

              return (
                <div key={message.id} className="space-y-1.5">
                  {showReference && message.reference ? (
                    <ReferenceCard reference={message.reference} onNavigate={minimize} />
                  ) : null}
                  <div
                    className={cn(
                      'max-w-[88%] rounded-2xl px-3 py-2.5 text-[12.5px] leading-relaxed',
                      message.role === 'user'
                        ? 'ml-auto rounded-br-md bg-brand-500 font-semibold text-white'
                        : 'rounded-bl-md border border-line bg-white/[0.05] text-ink-soft',
                    )}
                  >
                    {message.text}
                  </div>
                </div>
              )
            })}

            {thinking ? <ThinkingBubble /> : null}
          </div>

          <form onSubmit={submit} className="border-t border-line p-3">
            <div className="flex items-center gap-2 rounded-2xl border border-line bg-white/[0.04] p-1.5 pl-3 focus-within:border-brand-500/50">
              <input
                ref={inputRef}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="Ask a follow-up…"
                aria-label="Continue assistant chat"
                className="h-8 min-w-0 flex-1 bg-transparent text-[16px] text-ink placeholder:text-ink-muted focus:outline-none sm:text-[12.5px]"
              />
              <button
                type="submit"
                aria-label="Send follow-up"
                disabled={!value.trim() || thinking}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-500 text-white transition-opacity disabled:opacity-35"
              >
                <SendHorizonal size={14} />
              </button>
            </div>
            <p className="mt-1.5 px-1 text-[9.5px] text-ink-muted">
              Simulated insights · not investment advice
            </p>
          </form>
        </motion.section>
      ) : (
        <motion.button
          key="assistant-bubble"
          type="button"
          onClick={openWindow}
          initial={{ opacity: 0, y: 12, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.92 }}
          transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
          aria-label="Continue assistant chat"
          className="glass-strong fixed right-3 bottom-[calc(74px+env(safe-area-inset-bottom))] z-50 flex items-center gap-2 rounded-full py-1.5 pr-3 pl-1.5 text-[11.5px] font-bold text-ink shadow-[0_18px_46px_-18px_rgba(0,0,0,0.9)] lg:right-5 lg:bottom-5"
        >
          <span className="relative shrink-0">
            <AssistantAvatar size={30} className="rounded-full" notify={unread} />
            <span className="absolute -right-1 -bottom-0.5 rounded-full border border-brand-300/35 bg-[#172234] px-1 py-0.5 text-[6.5px] leading-none font-black tracking-[0.03em] text-brand-300">
              AI
            </span>
          </span>
          <MessageCircle size={17} strokeWidth={2.1} className="text-ink-soft" aria-hidden />
          {thinking ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-300" /> : null}
        </motion.button>
      )}
    </AnimatePresence>
  )
}

const REFERENCE_LABELS: Record<AssistantReference['kind'], string> = {
  thesis: 'Trade thesis',
  position: 'Position',
  plan: 'Trade plan',
}

/** Clickable summary of what a run of turns is about. */
function ReferenceCard({
  reference,
  onNavigate,
}: {
  reference: AssistantReference
  onNavigate: () => void
}) {
  return (
    <Link
      to={reference.to}
      onClick={onNavigate}
      className="flex items-center gap-2 rounded-[14px] border border-brand-400/25 bg-brand-500/[0.09] px-2.5 py-2 transition-colors hover:border-brand-300/40 hover:bg-brand-500/[0.14]"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[8.5px] font-bold tracking-[0.07em] text-brand-200 uppercase">
          {REFERENCE_LABELS[reference.kind]}
        </span>
        <span className="num mt-0.5 block truncate text-[12px] font-bold text-ink">
          {reference.label}
        </span>
        {reference.detail ? (
          <span className="mt-0.5 block truncate text-[10px] text-ink-muted">
            {reference.detail}
          </span>
        ) : null}
      </span>
      <ChevronRight size={15} className="shrink-0 text-brand-300" />
    </Link>
  )
}

function ThinkingBubble() {
  return (
    <div
      className="flex w-fit items-center gap-1 rounded-2xl rounded-bl-md border border-line bg-white/[0.05] px-3 py-3"
      aria-label="Assistant is thinking"
    >
      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          className="h-1.5 w-1.5 rounded-full bg-brand-300"
          animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
          transition={{ duration: 1, repeat: Infinity, delay: index * 0.16 }}
        />
      ))}
    </div>
  )
}
