import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowUpRight,
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  FilePenLine,
  MessageCircle,
  Minus,
  PieChart,
  RefreshCw,
  SendHorizonal,
  Settings,
  UserRound,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatSignedPercent, relativeTime } from '@/lib/format'
import type { ActivityEvent, PortfolioOutlook } from '@/api/types'
import type { PlannerIdea } from '@/api/newsTypes'
import type { PositionValuation } from '@/lib/portfolioMath'
import { Skeleton } from '@/components/ui/Skeleton'
import { SymbolIcon } from '@/components/shared/SymbolIcon'
import { AssistantAvatar } from '@/components/assistant/AssistantAvatar'
import { useAssistantChatStore, type AssistantChatMessage } from '@/store/assistantChatStore'
import { useRepromptStore, type RepromptRecord } from '@/store/repromptStore'
import { daysToExpiry, moneynessLabel } from '@/lib/optionMath'
import { RecommendationChip } from '@/components/intelligence/TradeRecommendation'
import { AIUnavailable, AIUnavailableChip } from '@/components/intelligence/AIUnavailable'
import { LogoMark } from '@/components/brand/Logo'
import { AISettingsModal } from '@/components/assistant/AISettingsModal'

const DRIVER_ICONS = [TrendingUp, CircleDollarSign, PieChart]

const byNewestReprompt = (a: RepromptRecord, b: RepromptRecord) =>
  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()

const PLACEHOLDERS = [
  'Ask me anything — e.g. "When should I sell my PLTRs?"',
  'Ask me anything — e.g. "Should I roll the SNDK calls?"',
  'Ask me anything — e.g. "What does the memory selloff mean for MU?"',
]

type OutlookTab = 'keys' | 'actions' | 'tests' | 'chats'

const OUTLOOK_TABS: { id: OutlookTab; label: string }[] = [
  { id: 'keys', label: 'Keys' },
  { id: 'actions', label: 'Actions' },
  { id: 'tests', label: 'Tests' },
  { id: 'chats', label: 'Chats' },
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
  activity = [],
  plans = [],
  full = false,
  initialTab = 'keys',
}: {
  outlook?: PortfolioOutlook
  valuations: PositionValuation[]
  loading?: boolean
  className?: string
  onRefresh?: () => Promise<unknown> | void
  onMinimize?: () => void
  onChatStart?: () => void
  activity?: ActivityEvent[]
  plans?: PlannerIdea[]
  /**
   * Force the desktop treatment (tabs, StratFolio AI identity, AI settings)
   * regardless of breakpoint — used by the mobile assistant sheet so a tapped
   * chat bubble opens the exact desktop chatbox.
   */
  full?: boolean
  initialTab?: OutlookTab
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const [refreshedAt, setRefreshedAt] = useState(outlook?.updatedAt ?? new Date().toISOString())
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<OutlookTab>(initialTab)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const messages = useAssistantChatStore((state) => state.messages)
  const repromptsByEntity = useRepromptStore((state) => state.byEntity)
  const reprompts = useMemo(
    () => Object.values(repromptsByEntity).flat().sort(byNewestReprompt),
    [repromptsByEntity],
  )

  useEffect(() => {
    if (outlook?.updatedAt) setRefreshedAt(outlook.updatedAt)
  }, [outlook?.updatedAt])

  // The commentary cards: options first (they carry the live thesis), then the
  // largest equity by conviction move.
  const commentary = useMemo(() => {
    const options = valuations.filter((v) => v.position.option)
    const equities = valuations
      .filter((v) => !v.position.option)
      // Unassessed holdings sort last rather than as a zero-magnitude move:
      // "no conviction change recorded" is not "conviction did not change".
      .sort(
        (a, b) =>
          Math.abs(b.position.ai?.convictionDelta ?? -1) -
          Math.abs(a.position.ai?.convictionDelta ?? -1),
      )
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

      <header className="relative border-b border-line px-4 pt-3.5 pb-2.5">
        <div className="flex items-center gap-2">
          <AssistantAvatar size={28} className={cn(full ? 'hidden' : 'lg:hidden')} />
          <span
            className={cn(
              'h-7 w-7 place-items-center rounded-lg bg-brand-100',
              full ? 'grid' : 'hidden lg:grid',
            )}
          >
            <LogoMark size={23} trace />
          </span>
          <h2 className="text-[14.5px] font-bold text-ink">
            <span className={cn(full ? 'hidden' : 'lg:hidden')}>StratFolio Insights</span>
            <span className={cn(full ? 'inline' : 'hidden lg:inline')}>StratFolio AI</span>
          </h2>
          <Link
            to="/app/thesis"
            className={cn(
              'ml-auto inline-flex shrink-0 items-center gap-1 rounded-lg border border-line bg-white/[0.04] px-2 py-1.5 text-[10px] font-bold text-ink transition-colors hover:bg-white/[0.08]',
              full ? 'hidden' : 'lg:hidden',
            )}
          >
            View full outlook
            <ChevronRight size={12} />
          </Link>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className={cn(
              'ml-auto shrink-0 items-center gap-1.5 rounded-lg border border-line bg-white/[0.04] px-2 py-1.5 text-[10px] font-bold text-ink transition-colors hover:bg-white/[0.08]',
              full ? 'inline-flex' : 'hidden lg:inline-flex',
            )}
          >
            <Settings size={12} />
            AI settings
          </button>
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
        </div>

        <nav
          className={cn(
            'mt-2.5 grid-cols-4 gap-1 rounded-lg bg-black/15 p-1',
            full ? 'grid' : 'hidden lg:grid',
          )}
          aria-label="StratFolio AI sections"
        >
          {OUTLOOK_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id)
                setSelectedChatId(null)
              }}
              aria-current={tab === item.id ? 'page' : undefined}
              className={cn(
                'rounded-md px-1 py-1.5 text-[10px] font-bold transition-colors',
                tab === item.id
                  ? 'bg-brand-500/25 text-brand-200'
                  : 'text-ink-muted hover:bg-white/[0.05] hover:text-ink',
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <div className={cn('relative min-h-0 flex-1 overflow-hidden', full ? 'block' : 'hidden lg:block')}>
        {tab === 'keys' ? (
          <MarketOutlookCard
            outlook={outlook}
            refreshedAt={refreshedAt}
            refreshing={refreshing}
            onRefresh={() => void refresh()}
          />
        ) : null}
        {tab === 'actions' ? <ActionsPanel activity={activity} plans={plans} reprompts={reprompts} /> : null}
        {tab === 'tests' ? <TestsPanel /> : null}
        {tab === 'chats' ? (
          <ChatsPanel
            messages={messages}
            reprompts={reprompts}
            selectedId={selectedChatId}
            onSelect={setSelectedChatId}
          />
        ) : null}
      </div>

      {/* ---- Mobile swipeable card stack ---- */}
      <div className={cn('relative min-h-0 flex-1 overflow-clip', full ? 'hidden' : 'lg:hidden')}>
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
      <div
        className={cn(
          'relative flex items-center gap-2 border-t border-line px-4 py-2.5',
          full ? 'hidden' : 'lg:hidden',
        )}
      >
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

      <AISettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </section>
  )
}

/** Mobile-only fixed launcher that turns the inline Insights panel into a dialog. */
export function MobileAIInsights({
  outlook,
  valuations,
  loading,
  onRefresh,
  activity = [],
  plans = [],
}: {
  outlook?: PortfolioOutlook
  valuations: PositionValuation[]
  loading?: boolean
  onRefresh?: () => Promise<unknown> | void
  activity?: ActivityEvent[]
  plans?: PlannerIdea[]
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
                  full
                  outlook={outlook}
                  valuations={valuations}
                  activity={activity}
                  plans={plans}
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

      <h4 className="mt-1 hidden text-[12.5px] font-bold text-ink lg:block">
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

type TimelineItem = {
  id: string
  title: string
  /** Absent when the source row carried nothing to describe (plt activity
   *  rows have no free-text detail; a payload-less row has none). */
  detail?: string
  at: string
  kind: 'trade' | 'plan' | 'reprompt'
}

function ActionsPanel({
  activity,
  plans,
  reprompts,
}: {
  activity: ActivityEvent[]
  plans: PlannerIdea[]
  reprompts: RepromptRecord[]
}) {
  const items = useMemo<TimelineItem[]>(() => {
    const events = activity.map((event) => ({
      id: event.id,
      title: event.title,
      detail: event.detail,
      at: event.at,
      kind: 'trade' as const,
    }))
    const planEvents = plans.map((plan) => ({
      id: `plan-${plan.id}`,
      title: `${plan.symbol} trade plan ${plan.status}`,
      detail: `${plan.source === 'ai' ? 'AI-created' : 'User-created'} ${plan.intent ?? 'open'} plan · ${plan.title}`,
      at: plan.createdAt,
      kind: 'plan' as const,
    }))
    const edits = reprompts
      .filter((record) => record.reference.kind === 'plan')
      .map((record) => ({
        id: `action-${record.id}`,
        title: `${record.reference.label} plan revised`,
        detail: `AI re-evaluated the plan after: “${record.question}”`,
        at: record.createdAt,
        kind: 'reprompt' as const,
      }))
    return [...events, ...planEvents, ...edits].sort(byNewest).slice(0, 12)
  }, [activity, plans, reprompts])

  return (
    <PanelList empty="No AI or trading actions yet.">
      {items.map((item) => {
        const Icon = item.kind === 'trade' ? CheckCircle2 : item.kind === 'plan' ? ClipboardCheck : FilePenLine
        return (
          <div key={item.id} className="flex gap-2.5 border-b border-line/70 py-2.5 last:border-0">
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-100 text-brand-300">
              <Icon size={13} />
            </span>
            <div className="min-w-0">
              <div className="text-[11.5px] leading-snug font-bold text-ink">{item.title}</div>
              {item.detail ? (
                <p className="mt-0.5 line-clamp-2 text-[10.5px] leading-snug text-ink-muted">
                  {item.detail}
                </p>
              ) : null}
              <time className="mt-1 block text-[9px] text-ink-muted/65">{dateTime(item.at)}</time>
            </div>
          </div>
        )
      })}
    </PanelList>
  )
}

const SIGNIFICANT_TESTS = [
  {
    id: 'test-ai-concentration',
    source: 'AI' as const,
    title: 'Concentration shock · −18% NVDA',
    result: 'Portfolio drawdown held to −6.4%; concentration guardrail breached.',
    at: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
  },
  {
    id: 'test-user-mu',
    source: 'User' as const,
    title: 'MU volatility crush after earnings',
    result: 'Jan calls retained 61% of modeled value under a 24-point IV contraction.',
    at: new Date(Date.now() - 5.2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'test-ai-rates',
    source: 'AI' as const,
    title: 'Higher-for-longer rate regime',
    result: 'Growth sleeve underperformed benchmark by 3.1%; no stop levels triggered.',
    at: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
  },
]

function TestsPanel() {
  return (
    <PanelList empty="No significant tests yet.">
      {SIGNIFICANT_TESTS.map((test) => (
        <div key={test.id} className="border-b border-line/70 py-2.5 last:border-0">
          <div className="flex items-start gap-2">
            <span className={cn(
              'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg',
              test.source === 'AI' ? 'bg-brand-100 text-brand-300' : 'bg-white/[0.06] text-ink-soft',
            )}>
              {test.source === 'AI' ? <Bot size={13} /> : <UserRound size={13} />}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[11.5px] leading-snug font-bold text-ink">{test.title}</span>
                <span className="rounded bg-white/[0.06] px-1 py-0.5 text-[8px] font-black tracking-wide text-ink-muted uppercase">
                  {test.source}
                </span>
              </div>
              <p className="mt-1 text-[10.5px] leading-snug text-ink-muted">{test.result}</p>
              <time className="mt-1 block text-[9px] text-ink-muted/65">{dateTime(test.at)}</time>
            </div>
          </div>
        </div>
      ))}
    </PanelList>
  )
}

type ChatSummary = {
  id: string
  title: string
  at: string
  reference?: RepromptRecord['reference']
  turns: { role: 'user' | 'assistant'; text: string }[]
  actions: string[]
}

const DEMO_CHAT_SUMMARIES: ChatSummary[] = [
  {
    id: 'demo-chat-mu',
    title: 'Should we keep the MU calls through the next earnings cycle?',
    at: new Date(Date.now() - 2.1 * 60 * 60 * 1000).toISOString(),
    turns: [
      { role: 'user', text: 'Should we keep the MU calls through the next earnings cycle?' },
      { role: 'assistant', text: 'Keep the position, but cap event risk. The calls still have enough duration to absorb one volatility reset, while the current sizing remains inside the portfolio risk budget.' },
    ],
    actions: ['Ran an earnings volatility-crush test', 'Kept the plan active with the existing max allocation'],
  },
  {
    id: 'demo-reprompt-wmt',
    title: 'WMT plan reprompt: prioritize capital preservation',
    at: new Date(Date.now() - 19 * 60 * 60 * 1000).toISOString(),
    turns: [
      { role: 'user', text: 'Rewrite this plan to prioritize capital preservation after the earnings gap.' },
      { role: 'assistant', text: 'I tightened the invalidation level, reduced the maximum allocation, and changed the entry requirement to wait for confirmation above the post-earnings range.' },
    ],
    actions: ['Reduced maximum plan allocation', 'Tightened stop criteria', 'Added post-earnings confirmation requirement'],
  },
  {
    id: 'demo-chat-nvda',
    title: 'How exposed are we if NVDA drops 15–20%?',
    at: new Date(Date.now() - 3.2 * 24 * 60 * 60 * 1000).toISOString(),
    turns: [
      { role: 'user', text: 'How exposed are we if NVDA drops 15–20%?' },
      { role: 'assistant', text: 'A modeled 18% NVDA decline produces an estimated 6.4% portfolio drawdown. The largest secondary effect is correlation expansion across the AI-compute sleeve.' },
    ],
    actions: ['Ran the NVDA concentration shock test', 'Flagged the concentration guardrail breach'],
  },
]

function ChatsPanel({
  messages,
  reprompts,
  selectedId,
  onSelect,
}: {
  messages: AssistantChatMessage[]
  reprompts: RepromptRecord[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  const chats = useMemo(() => buildChatSummaries(messages, reprompts), [messages, reprompts])
  const selected = chats.find((chat) => chat.id === selectedId)

  if (selected) {
    return (
      <div className="no-scrollbar h-full overflow-y-auto px-4 py-3">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="inline-flex items-center gap-1 text-[10px] font-bold text-brand-300 hover:text-brand-200"
        >
          <ArrowLeft size={12} /> Back to chats
        </button>
        <h3 className="mt-2 text-[12px] font-bold text-ink">{selected.title}</h3>
        <time className="mt-0.5 block text-[9px] text-ink-muted/65">{dateTime(selected.at)}</time>
        <div className="mt-3 space-y-2">
          {selected.turns.map((turn, index) => (
            <div
              key={`${turn.role}-${index}`}
              className={cn(
                'rounded-xl px-2.5 py-2 text-[10.5px] leading-relaxed',
                turn.role === 'user' ? 'ml-5 bg-brand-500/15 text-ink' : 'mr-3 bg-white/[0.05] text-ink-soft',
              )}
            >
              <span className="mb-1 block text-[8px] font-black tracking-wide text-ink-muted uppercase">
                {turn.role === 'user' ? 'You' : 'StratFolio AI'}
              </span>
              {turn.text}
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-xl border border-brand-400/20 bg-brand-500/[0.08] p-2.5">
          <div className="text-[9px] font-black tracking-wide text-brand-300 uppercase">AI actions taken</div>
          <ul className="mt-1.5 space-y-1">
            {selected.actions.map((action) => (
              <li key={action} className="flex gap-1.5 text-[10px] leading-snug text-ink-soft">
                <CheckCircle2 size={11} className="mt-0.5 shrink-0 text-up" /> {action}
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  return (
    <PanelList empty="Your AI chats and reprompts will appear here.">
      {chats.map((chat) => (
        <button
          key={chat.id}
          type="button"
          onClick={() => onSelect(chat.id)}
          className="flex w-full gap-2.5 border-b border-line/70 py-2.5 text-left last:border-0 hover:bg-white/[0.025]"
        >
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-100 text-brand-300">
            <MessageCircle size={13} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 text-[11px] leading-snug font-bold text-ink">{chat.title}</span>
            <span className="mt-1 block text-[9px] text-ink-muted/65">{dateTime(chat.at)}</span>
          </span>
          <ChevronRight size={13} className="mt-1 shrink-0 text-ink-muted" />
        </button>
      ))}
    </PanelList>
  )
}

function PanelList({ children, empty }: { children: React.ReactNode; empty: string }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return (
    <div className="no-scrollbar h-full overflow-y-auto px-4 py-2">
      {hasChildren ? children : <p className="py-8 text-center text-[11px] text-ink-muted">{empty}</p>}
    </div>
  )
}

function buildChatSummaries(messages: AssistantChatMessage[], reprompts: RepromptRecord[]): ChatSummary[] {
  const summaries: ChatSummary[] = []
  for (let i = 0; i < messages.length; i += 1) {
    const message = messages[i]
    if (message.role !== 'user') continue
    const answer = messages.slice(i + 1).find((candidate) => candidate.role === 'assistant')
    summaries.push({
      id: `chat-${message.id}`,
      title: message.reference ? `${message.reference.label}: ${message.text}` : message.text,
      at: message.createdAt ?? timestampFromId(message.id),
      reference: message.reference,
      turns: [
        { role: 'user', text: message.text },
        ...(answer ? [{ role: 'assistant' as const, text: answer.text }] : []),
      ],
      actions: message.reference
        ? [`Reviewed the linked ${message.reference.kind}`, 'Updated guidance using the user’s constraint']
        : ['Reviewed current portfolio context', 'Returned an evidence-based recommendation'],
    })
  }

  const representedQuestions = new Set(summaries.flatMap((summary) => summary.turns.filter((turn) => turn.role === 'user').map((turn) => turn.text)))
  for (const record of reprompts) {
    if (representedQuestions.has(record.question)) continue
    summaries.push({
      id: record.id,
      title: `${record.reference.label}: ${record.question}`,
      at: record.createdAt,
      reference: record.reference,
      turns: [
        { role: 'user', text: record.question },
        ...(record.answer ? [{ role: 'assistant' as const, text: record.answer }] : []),
      ],
      actions: [
        `Re-evaluated the linked ${record.reference.kind}`,
        record.reference.kind === 'plan' ? 'Updated trade-plan guidance' : 'Updated conviction and risk guidance',
      ],
    })
  }
  const ids = new Set(summaries.map((summary) => summary.id))
  return [...summaries, ...DEMO_CHAT_SUMMARIES.filter((summary) => !ids.has(summary.id))].sort(byNewest)
}

function byNewest(a: { at?: string; createdAt?: string }, b: { at?: string; createdAt?: string }) {
  return new Date(b.at ?? b.createdAt ?? 0).getTime() - new Date(a.at ?? a.createdAt ?? 0).getTime()
}

function timestampFromId(id: string) {
  const timestamp = Number(id.split('-').find((part) => /^\d{13}$/.test(part)))
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : new Date().toISOString()
}

function dateTime(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
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
            {contract
              ? `$${contract.strike} ${contract.right === 'CALL' ? 'Call' : 'Put'} · ${contract.expiryLabel}`
              : (position.company ?? position.symbol)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {ai ? (
          <>
            <RecommendationChip recommendation={ai.recommendation} />
            <span className="num rounded-md bg-brand-100 px-1.5 py-0.5 text-[10.5px] font-bold text-brand-300">
              {ai.conviction}/100
            </span>
          </>
        ) : (
          <AIUnavailableChip />
        )}
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

      {ai ? (
        <>
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
        </>
      ) : (
        <AIUnavailable className="mt-3" />
      )}

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
