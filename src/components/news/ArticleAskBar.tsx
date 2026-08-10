import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Minus, SendHorizonal } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { NewsArticle } from '@/api/newsTypes'
import { useAssistantChatStore } from '@/store/assistantChatStore'

/**
 * Prompts a reader would raise about a story rather than about a holding —
 * what it implies, who it hurts, and whether it is worth acting on.
 */
const ARTICLE_EXAMPLES = [
  'Make a plan from this story',
  'Who does this hurt?',
  'Is this already priced in?',
]

/** Ask-or-plan bar pinned to the bottom of a news story. */
export function ArticleAskBar({ article }: { article: NewsArticle }) {
  const [question, setQuestion] = useState('')
  const [minimized, setMinimized] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const sendMessage = useAssistantChatStore((state) => state.sendMessage)
  const thinking = useAssistantChatStore((state) => state.thinking)

  const draft = question.trim()
  const expanded = question.length > 0 && !minimized

  const ask = (event: React.FormEvent) => {
    event.preventDefault()
    if (!draft || thinking) return
    setQuestion('')
    setMinimized(false)
    void sendMessage(`About "${article.headline}" — ${draft}`, {
      kind: 'thesis',
      id: article.id,
      label: article.source,
      detail: article.headline,
      to: `/app/news/${article.id}`,
    })
  }

  const prompt = 'Ask AI about this story… ex) "make a plan from this"'

  return (
    <div className="glass-chrome sticky bottom-[76px] z-30 rounded-[20px] border border-brand-300/25 px-3 py-2 shadow-[0_18px_44px_-20px_rgba(0,0,0,0.9),inset_0_1px_rgba(255,255,255,0.12)] lg:bottom-4 lg:mx-auto lg:max-w-[520px]">
      <form onSubmit={ask} className="relative min-h-9 min-w-0">
        <motion.div
          layout
          transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
          className={cn(
            'flex flex-col',
            expanded &&
              'glass-chrome absolute inset-x-0 bottom-0 z-30 gap-2 rounded-[18px] border border-line p-2.5 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.95)]',
          )}
        >
          <div className={cn('items-center justify-between', expanded ? 'flex' : 'hidden')}>
            <span className="min-w-0 truncate text-[9.5px] font-bold tracking-[0.09em] text-ink-muted uppercase">
              Ask or plan · {article.source}
            </span>
            <button
              type="button"
              aria-label="Minimize the story composer"
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
                aria-label="Ask AI about this story"
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
              className="ml-1.5 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-brand-300/30 bg-brand-400/[0.16] text-white transition-[background-color,transform] hover:bg-brand-400/[0.24] active:scale-95 disabled:opacity-40"
            >
              <SendHorizonal size={15} strokeWidth={2.2} />
            </button>
          </div>

          <div className={cn('flex-wrap gap-1.5', expanded ? 'flex' : 'hidden')}>
            {ARTICLE_EXAMPLES.map((example) => (
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
  )
}
