import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { BellOff, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useNewsArticles } from '@/hooks/queries'
import { useUiStore } from '@/store/uiStore'
import { usePrice } from '@/store/priceStore'
import { Sparkline } from '@/components/charts/Sparkline'
import { useAssistantChatStore } from '@/store/assistantChatStore'
import { useNotificationPreferencesStore } from '@/store/notificationPreferencesStore'

const CYCLE_MS = 15_000
const VISIBLE_MS = 5_000

/**
 * Ambient demo news ticker.
 *
 * One toast at most, on a ~15s cycle, auto-dismissing after 5s. It pauses
 * while any modal/sheet is open (overlayCount > 0) and while the tab is
 * hidden, never blocks interaction, and can be muted outright. Clicking it
 * cancels the dismiss timer and deep-links into the article.
 */
export function NewsToastHost() {
  const navigate = useNavigate()
  const location = useLocation()
  const { data: articles } = useNewsArticles()
  const enabled = useNotificationPreferencesStore((state) => state.newsEnabled)
  const setEnabled = useNotificationPreferencesStore((state) => state.setNewsEnabled)
  const setHasUnreadNews = useUiStore((s) => s.setHasUnreadNews)
  const overlayCount = useUiStore((s) => s.overlayCount)
  const assistantWindowOpen = useAssistantChatStore(
    (s) => s.messages.length > 0 && s.mode === 'window',
  )

  const [activeId, setActiveId] = useState<string | null>(null)
  const indexRef = useRef(0)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearHideTimer = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }

  const dismiss = useCallback(() => {
    clearHideTimer()
    setActiveId(null)
  }, [])

  // The 15s cycle. Suspended entirely while an overlay is open or when muted.
  useEffect(() => {
    if (
      !enabled ||
      overlayCount > 0 ||
      assistantWindowOpen ||
      location.pathname.startsWith('/app/news') ||
      !articles ||
      articles.length === 0
    ) {
      dismiss()
      return
    }

    const show = () => {
      if (document.hidden) return
      const article = articles[indexRef.current % articles.length]
      indexRef.current += 1
      setActiveId(article.id)
      setHasUnreadNews(true)
      clearHideTimer()
      hideTimer.current = setTimeout(() => setActiveId(null), VISIBLE_MS)
    }

    const first = setTimeout(show, 4000)
    const interval = setInterval(show, CYCLE_MS)
    return () => {
      clearTimeout(first)
      clearInterval(interval)
      clearHideTimer()
    }
  }, [
    enabled,
    overlayCount,
    assistantWindowOpen,
    articles,
    dismiss,
    location.pathname,
    setHasUnreadNews,
  ])

  useEffect(() => () => clearHideTimer(), [])

  const article = articles?.find((a) => a.id === activeId)

  return (
    <div
      className="pointer-events-none fixed bottom-[calc(78px+env(safe-area-inset-bottom))] left-3 z-40 flex w-[calc(100vw-99px)] max-w-[276px] lg:right-5 lg:bottom-5 lg:left-auto lg:w-auto lg:max-w-none"
      aria-live="polite"
    >
      <AnimatePresence>
        {article ? (
          <motion.div
            key={article.id}
            // Fade only — no slide or scale. The toast is a tap target that
            // appears unannounced, so any movement means reaching for something
            // that is still travelling out from under the finger.
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
            className="pointer-events-auto w-full lg:w-[350px]"
          >
            <ToastCard
              headline={article.headline}
              source={article.source}
              recency={demoRecency(article.id)}
              symbol={article.tickers[0]?.symbol ?? ''}
              onOpen={() => {
                clearHideTimer()
                setActiveId(null)
                setHasUnreadNews(false)
                navigate(`/app/news/${article.id}`)
              }}
              onDismiss={dismiss}
              onMute={() => {
                dismiss()
                setEnabled(false)
                setHasUnreadNews(false)
              }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function ToastCard({
  headline,
  source,
  recency,
  symbol,
  onOpen,
  onDismiss,
  onMute,
}: {
  headline: string
  source: string
  recency: string
  symbol: string
  onOpen: () => void
  onDismiss: () => void
  onMute: () => void
}) {
  const snap = usePrice(symbol)
  // No quote for this ticker means no day move to report; a 0.00% here would
  // be a claim about a symbol we never priced.
  const pct = snap?.dayChangePct
  const up = (pct ?? 0) >= 0

  return (
    <div className="glass-toast mobile-news-toast relative min-h-[108px] rounded-[22px]">

      <button
        type="button"
        onClick={onOpen}
        className="block w-full px-3.5 pt-3.5 pb-3 text-left"
      >
        <div className="flex min-w-0 items-center gap-1.5 pr-11 text-[10.5px] font-bold tracking-[0.06em] text-ink-muted uppercase">
          <Sparkles size={11} className="text-brand-300" />
          <span className="truncate">{source}</span>
          <span className="shrink-0 font-medium normal-case">· {recency}</span>
        </div>

        <p className="mt-1 line-clamp-2 pr-8 text-[13px] leading-snug font-semibold text-ink">
          {headline}
        </p>

        {symbol ? (
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="num text-[10.5px] font-bold text-ink-soft">{symbol}</span>
            <Sparkline
              data={snap?.history ?? []}
              tone={up ? 'up' : 'down'}
              width={26}
              height={11}
              filled={false}
            />
            <span
              className={cn(
                'num text-[10.5px] font-bold',
                pct === undefined ? 'text-ink-muted' : up ? 'text-up' : 'text-down',
              )}
            >
              {pct === undefined ? '—' : `${up ? '+' : '−'}${Math.abs(pct).toFixed(2)}%`}
            </span>
          </div>
        ) : null}
      </button>

      <div className="absolute top-2 right-2 flex items-center gap-0.5">
        <button
          type="button"
          aria-label="Turn off live news alerts"
          onClick={onMute}
          className="grid h-6 w-6 place-items-center rounded-full text-ink-muted transition-colors hover:bg-white/[0.08] hover:text-ink"
        >
          <BellOff size={12} />
        </button>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="grid h-6 w-6 place-items-center rounded-full text-ink-muted transition-colors hover:bg-white/[0.08] hover:text-ink"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  )
}

/** Stable demo recency, deliberately independent from the seeded article timestamp. */
function demoRecency(id: string): string {
  let hash = 0
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0
  }
  const seconds = 15 + (hash % 46)
  return seconds === 60 ? '1m ago' : `${seconds}s ago`
}
