import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  MessageCircle,
  Minus,
  PieChart,
  RefreshCw,
  SendHorizonal,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatSignedPercent, relativeTime } from '@/lib/format'
import type { PortfolioOutlook } from '@/api/types'
import type { PositionValuation } from '@/lib/portfolioMath'
import { Skeleton } from '@/components/ui/Skeleton'
import { SymbolIcon } from '@/components/shared/SymbolIcon'
import { AssistantAvatar } from '@/components/assistant/AssistantAvatar'
import { useAssistantChatStore } from '@/store/assistantChatStore'
import { daysToExpiry, moneynessLabel } from '@/lib/optionMath'
import { RecommendationChip } from '@/components/intelligence/TradeRecommendation'

const DRIVER_ICONS = [TrendingUp, CircleDollarSign, PieChart]

const PLACEHOLDERS = [
  'Ask me anything — e.g. "When should I sell my PLTRs?"',
  'Ask me anything — e.g. "Should I roll the SNDK calls?"',
  'Ask me anything — e.g. "What does the memory selloff mean for MU?"',
]

/**
 * The AI Outlook panel.
 *
 * A horizontally swipeable stack: card one is the market/portfolio stance,
 * the rest are per-position commentary on the actual options book. A mocked
 * assistant sits at the foot. The panel is height-capped and each region
 * scrolls internally so it can never grow unbounded.
 */
export function AIOutlookPanel({
  outlook,
  valuations,
  loading,
  className,
  onRefresh,
  onMinimize,
  onChatStart,
}: {
  outlook?: PortfolioOutlook
  valuations: PositionValuation[]
  loading?: boolean
  className?: string
  onRefresh?: () => Promise<unknown> | void
  onMinimize?: () => void
  onChatStart?: () => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const [refreshedAt, setRefreshedAt] = useState(outlook?.updatedAt ?? new Date().toISOString())
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (outlook?.updatedAt) setRefreshedAt(outlook.updatedAt)
  }, [outlook?.updatedAt])

  // The commentary cards: options first (they carry the live thesis), then the
  // largest equity by conviction move.
  const commentary = useMemo(() => {
    const options = valuations.filter((v) => v.position.option)
    const equities = valuations
      .filter((v) => !v.position.option)
      .sort((a, b) => Math.abs(b.position.ai.convictionDelta) - Math.abs(a.position.ai.convictionDelta))
    return [...options, ...equities.slice(0, 3)]
  }, [valuations])

  const cardCount = 1 + commentary.length

  const scrollTo = (next: number) => {
    const el = trackRef.current
    if (!el) return
    const clamped = Math.max(0, Math.min(cardCount - 1, next))
    el.scrollTo({ left: clamped * el.clientWidth, behavior: 'smooth' })
    setIndex(clamped)
  }

  const onScroll = () => {
    const el = trackRef.current
    if (!el || el.clientWidth === 0) return
    setIndex(Math.round(el.scrollLeft / el.clientWidth))
  }

  const refresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await onRefresh?.()
      setRefreshedAt(new Date().toISOString())
    } finally {
      setRefreshing(false)
    }
  }

  if (loading || !outlook) {
    return <Skeleton className={cn('h-[560px] rounded-[20px]', className)} />
  }

  return (
    <section
      className={cn(
        'glass relative flex flex-col overflow-clip rounded-[20px]',
        className,
      )}
    >
      {/* Blue refraction sweep, as in the mockup's outlook panel. */}
      <div
        className="pointer-events-none absolute -top-10 -right-16 h-[280px] w-[280px] rounded-full opacity-60"
        style={{
          background:
            'radial-gradient(circle at 30% 30%, rgba(91,166,255,0.28), rgba(47,123,255,0.06) 55%, transparent 70%)',
        }}
        aria-hidden
      />

      <header className="relative flex items-center gap-2 border-b border-line px-4 py-3.5">
        <AssistantAvatar size={28} className="lg:hidden" />
        <span className="hidden h-7 w-7 place-items-center rounded-lg bg-brand-100 text-brand-300 lg:grid">
          <Sparkles size={15} />
        </span>
        <h2 className="text-[14.5px] font-bold text-ink">
          <span className="lg:hidden">StratFolio Insights</span>
          <span className="hidden lg:inline">AI Outlook</span>
        </h2>
        <Link
          to="/app/thesis"
          className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-lg border border-line bg-white/[0.04] px-2 py-1.5 text-[10px] font-bold text-ink transition-colors hover:bg-white/[0.08]"
        >
          View full outlook
          <ChevronRight size={12} />
        </Link>
        {onMinimize ? (
          <button
            type="button"
            onClick={onMinimize}
            aria-label="Minimize StratFolio Insights"
            className="liquid-control grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-muted transition-[color,transform] hover:text-ink active:scale-95"
          >
            <Minus size={14} strokeWidth={2.5} />
          </button>
        ) : null}
      </header>

      {/* ---- Swipeable card stack ---- */}
      <div className="relative min-h-0 flex-1 overflow-clip">
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="no-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth"
          role="group"
          aria-label="AI outlook cards"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') {
              e.preventDefault()
              scrollTo(index + 1)
            } else if (e.key === 'ArrowLeft') {
              e.preventDefault()
              scrollTo(index - 1)
            }
          }}
        >
          <MarketOutlookCard
            outlook={outlook}
            refreshedAt={refreshedAt}
            refreshing={refreshing}
            onRefresh={() => void refresh()}
          />
          {commentary.map((valuation) => (
            <PositionCommentaryCard key={valuation.position.id} valuation={valuation} />
          ))}
        </div>
      </div>

      {/* ---- Pips + arrows ---- */}
      <div className="relative flex items-center gap-2 border-t border-line px-4 py-2.5">
        <div className="flex items-center gap-1.5" role="tablist" aria-label="Outlook cards">
          {Array.from({ length: cardCount }).map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={i === 0 ? 'Market outlook' : `Position commentary ${i}`}
              onClick={() => scrollTo(i)}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === index ? 'w-5 bg-brand-500' : 'w-1.5 bg-white/25 hover:bg-white/40',
              )}
            />
          ))}
        </div>
        <span className="num ml-1 text-[11px] text-ink-muted">
          {index + 1}/{cardCount}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <PanelArrow label="Previous card" disabled={index === 0} onClick={() => scrollTo(index - 1)}>
            <ChevronLeft size={15} />
          </PanelArrow>
          <PanelArrow
            label="Next card"
            disabled={index >= cardCount - 1}
            onClick={() => scrollTo(index + 1)}
          >
            <ChevronRight size={15} />
          </PanelArrow>
        </div>
      </div>

      <AssistantChatLauncher onChatStart={onChatStart} />
    </section>
  )
}

/** Mobile-only fixed launcher that turns the inline Insights panel into a dialog. */
export function MobileAIInsights({
  outlook,
  valuations,
  loading,
  onRefresh,
}: {
  outlook?: PortfolioOutlook
  valuations: PositionValuation[]
  loading?: boolean
  onRefresh?: () => Promise<unknown> | void
}) {
  const [open, setOpen] = useState(false)
  const messageCount = useAssistantChatStore((state) => state.messages.length)
  const ready = !loading && Boolean(outlook)

  useEffect(() => {
    if (messageCount > 0) setOpen(false)
  }, [messageCount])

  // Once a conversation exists, FloatingAssistant owns this same fixed slot.
  if (messageCount > 0) return null

  const minimize = () => setOpen(false)

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <motion.button
          type="button"
          disabled={!ready}
          whileTap={ready ? { scale: 0.97 } : undefined}
          aria-label={ready ? 'Open StratFolio AI Insights' : 'StratFolio AI Insights loading'}
          className="glass-strong fixed right-3 bottom-[calc(78px+env(safe-area-inset-bottom))] z-30 flex h-12 items-center gap-2 rounded-full py-1.5 pr-4 pl-1.5 text-left shadow-[0_20px_50px_-20px_rgba(0,0,0,0.95),0_10px_26px_-20px_rgba(47,123,255,0.8)] transition-[border-color,filter] hover:border-brand-400/35 hover:brightness-110 disabled:opacity-65 lg:hidden"
        >
          <span className="relative shrink-0">
            <AssistantAvatar size={38} className="rounded-full" />
            <span className="absolute -right-1 -bottom-0.5 rounded-full border border-brand-300/35 bg-[#172234] px-1 py-0.5 text-[7px] leading-none font-black tracking-[0.03em] text-brand-300 shadow-[0_4px_10px_-5px_rgba(0,0,0,0.9)]">
              AI
            </span>
          </span>
          <MessageCircle
            size={18}
            strokeWidth={2.1}
            className={cn(
              'ml-0.5 shrink-0',
              ready ? 'text-ink-soft' : 'text-ink-muted',
            )}
            aria-hidden
          />
        </motion.button>
      </Dialog.Trigger>

      <Dialog.Portal forceMount>
        <AnimatePresence>
          {open ? (
            <>
            <Dialog.Overlay forceMount asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-40 bg-[#04070d]/78 backdrop-blur-[6px] lg:hidden"
              />
            </Dialog.Overlay>
            <Dialog.Content forceMount asChild>
              <motion.section
                initial={{ opacity: 0, y: 24, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 18, scale: 0.96 }}
                transition={{ duration: 0.24, ease: [0.22, 0.61, 0.36, 1] }}
                className="fixed right-3 bottom-[calc(72px+env(safe-area-inset-bottom))] left-3 z-50 h-[min(72svh,610px)] origin-bottom-right focus:outline-none lg:hidden"
              >
                <Dialog.Title className="sr-only">StratFolio Insights</Dialog.Title>
                <Dialog.Description className="sr-only">
                  Portfolio insights and StratFolio AI chat
                </Dialog.Description>
                <AIOutlookPanel
                  outlook={outlook}
                  valuations={valuations}
                  className="h-full rounded-[24px] border-brand-400/20 shadow-[0_30px_80px_-28px_rgba(0,0,0,0.98)]"
                  onRefresh={onRefresh}
                  onMinimize={minimize}
                  onChatStart={minimize}
                />
              </motion.section>
            </Dialog.Content>
            </>
          ) : null}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function PanelArrow({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode
  label: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'nav-gloss-button h-7 w-7',
        disabled && 'opacity-30',
      )}
    >
      {children}
    </button>
  )
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="no-scrollbar h-full w-full shrink-0 snap-start overflow-y-auto px-4 py-4">
      {children}
    </div>
  )
}

function MarketOutlookCard({
  outlook,
  refreshedAt,
  refreshing,
  onRefresh,
}: {
  outlook: PortfolioOutlook
  refreshedAt: string
  refreshing: boolean
  onRefresh: () => void
}) {
  return (
    <CardShell>
      <div className="-mt-2 mb-0.5 flex items-center justify-end gap-1.5">
        <span className="text-[8.5px] font-medium text-ink-muted/45">
          Updated {relativeTime(refreshedAt)}
        </span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Reload portfolio outlook"
          className="grid h-6 w-6 place-items-center rounded-full border border-line/70 bg-white/[0.025] text-ink-muted/60 transition-colors hover:bg-white/[0.07] hover:text-ink disabled:opacity-40"
        >
          <RefreshCw size={10.5} className={refreshing ? 'animate-spin' : undefined} />
        </button>
      </div>

      <h3 className="hidden text-[24px] leading-tight font-extrabold tracking-[-0.02em] text-brand-300 lg:block">
        {outlook.stance.split('·')[0].trim()}
      </h3>

      <h4 className="mt-3.5 hidden border-t border-line pt-3 text-[12.5px] font-bold text-ink lg:block">
        Key drivers
      </h4>
      <ul className="space-y-2 lg:mt-2.5">
        {outlook.signals.slice(0, 3).map((signal, i) => {
          const Icon = DRIVER_ICONS[i % DRIVER_ICONS.length]
          return (
            <li key={signal.label} className="flex gap-2.5">
              <span
                className={cn(
                  'grid h-8 w-8 shrink-0 place-items-center rounded-full',
                  signal.tone === 'caution'
                    ? 'bg-down-soft text-down'
                    : signal.tone === 'positive'
                      ? 'bg-up-soft text-up'
                      : 'bg-brand-100 text-brand-300',
                )}
              >
                <Icon size={15} />
              </span>
              <div className="min-w-0">
                <div className="text-[12.5px] font-bold text-ink">{signal.label}</div>
                <p className="text-[11.5px] leading-snug text-ink-muted">{signal.detail}</p>
              </div>
            </li>
          )
        })}
      </ul>

    </CardShell>
  )
}

function PositionCommentaryCard({ valuation }: { valuation: PositionValuation }) {
  const { position, underlyingPrice, totalReturnPct } = valuation
  const contract = position.option
  const ai = position.ai

  return (
    <CardShell>
      <div className="flex items-center gap-2.5">
        <SymbolIcon symbol={position.symbol} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[15px] font-extrabold tracking-[-0.02em] text-ink">
              {position.symbol}
            </span>
            <span className={cn('num text-[12px] font-bold', totalReturnPct >= 0 ? 'text-up' : 'text-down')}>
              {formatSignedPercent(totalReturnPct, 1)}
            </span>
          </div>
          <p className="truncate text-[11px] text-ink-muted">
            {contract ? `$${contract.strike} ${contract.right === 'CALL' ? 'Call' : 'Put'} · ${contract.expiryLabel}` : position.company}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <RecommendationChip recommendation={ai.recommendation} />
        <span className="num rounded-md bg-brand-100 px-1.5 py-0.5 text-[10.5px] font-bold text-brand-300">
          {ai.conviction}/100
        </span>
        {contract ? (
          <>
            <span className="num rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-soft">
              {daysToExpiry(contract)} DTE
            </span>
            <span className="num rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-soft">
              {moneynessLabel(contract, underlyingPrice)}
            </span>
          </>
        ) : null}
      </div>

      <p className="mt-3 text-[12.5px] leading-relaxed font-semibold text-ink">
        {ai.recommendationNote}
      </p>

      <ul className="mt-2.5 space-y-2">
        {ai.thesis.slice(0, 2).map((bullet, i) => (
          <li key={i} className="flex gap-2 text-[11.5px] leading-relaxed text-ink-muted">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-500" aria-hidden />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>

      {contract?.earningsNote ? (
        <p className="mt-3 rounded-xl border border-line bg-white/[0.04] px-2.5 py-2 text-[11px] leading-snug text-ink-soft">
          {contract.earningsNote}
        </p>
      ) : null}

      <Link
        to={`/app/positions/${position.id}`}
        className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-bold text-brand-300 hover:underline"
      >
        Open position
        <ArrowUpRight size={13} />
      </Link>
    </CardShell>
  )
}

/** Starts or resumes the app-wide floating assistant thread. */
function AssistantChatLauncher({ onChatStart }: { onChatStart?: () => void }) {
  const [value, setValue] = useState('')
  const [placeholder, setPlaceholder] = useState(0)
  const messageCount = useAssistantChatStore((s) => s.messages.length)
  const thinking = useAssistantChatStore((s) => s.thinking)
  const sendMessage = useAssistantChatStore((s) => s.sendMessage)
  const openWindow = useAssistantChatStore((s) => s.openWindow)

  useEffect(() => {
    if (messageCount > 0) return
    const t = setInterval(() => setPlaceholder((p) => (p + 1) % PLACEHOLDERS.length), 5200)
    return () => clearInterval(t)
  }, [messageCount])

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const question = value.trim()
    if (!question || thinking) return
    setValue('')
    onChatStart?.()
    void sendMessage(question)
  }

  return (
    <div className="relative border-t border-line">
      {messageCount > 0 ? (
        <button
          type="button"
          onClick={() => {
            onChatStart?.()
            openWindow()
          }}
          className="mx-3 mt-2.5 flex w-[calc(100%-1.5rem)] items-center gap-2 rounded-xl border border-line bg-white/[0.04] px-3 py-2 text-left text-[11.5px] font-bold text-ink transition-colors hover:bg-white/[0.07]"
        >
          <AssistantAvatar size={25} className="rounded-lg" />
          Continue floating chat
          <span className="num ml-auto text-[10px] font-medium text-ink-muted">
            {messageCount} messages
          </span>
        </button>
      ) : null}

      <form onSubmit={submit} className="flex items-center gap-2 px-3 py-3">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={messageCount > 0 ? 'Ask a follow-up…' : PLACEHOLDERS[placeholder]}
          aria-label="Ask the StratFolio assistant"
          className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-white/[0.04] px-3 text-[12.5px] text-ink placeholder:text-ink-muted focus:border-brand-500/50 focus:outline-none"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!value.trim() || thinking}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500 text-white transition-opacity disabled:opacity-40"
        >
          <SendHorizonal size={16} />
        </button>
      </form>
      <p className="px-4 pb-3 text-[10.5px] text-ink-muted">
        Opens the floating assistant · not investment advice
      </p>
    </div>
  )
}
