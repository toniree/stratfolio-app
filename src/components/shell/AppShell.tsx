import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ChevronRight, MoreHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { NAV_ITEMS } from '@/components/shell/navItems'
import { Logo } from '@/components/brand/Logo'
import { AITradingControl } from '@/components/shell/AITradingControl'
import { OrderToastHost } from '@/components/shell/OrderToastHost'
import { TopBar } from '@/components/shell/TopBar'
import { NewsToastHost } from '@/components/news/NewsToastHost'
import { FloatingAssistant } from '@/components/assistant/FloatingAssistant'
import { Watchlist } from '@/components/terminal/Watchlist'
import { usePositions } from '@/hooks/queries'
import { useUiStore } from '@/store/uiStore'
import { MobileNotificationSettings } from '@/components/shell/MobileNotificationSettings'
import { SidebarBrokerageSelector } from '@/components/portfolio/BrokerageFilter'

/**
 * Chrome vs content.
 *
 * Desktop is the dense dashboard from the mockup: a slim left rail with the
 * wordmark, six destinations and a buying-power card pinned to the bottom.
 * Mobile keeps the carousel home behind a bottom tab bar. Both share the one
 * dark liquid-glass design system.
 */
export function AppShell() {
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const accountId = useUiStore((s) => s.accountId)
  const hasUnreadNews = useUiStore((s) => s.hasUnreadNews)
  const setHasUnreadNews = useUiStore((s) => s.setHasUnreadNews)
  const { data: positions } = usePositions(accountId)
  const brokerageCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const position of positions ?? []) {
      // Live positions carry no brokerage (one paper portfolio, HKP-PLT-6).
      if (!position.brokerageId) continue
      counts[position.brokerageId] = (counts[position.brokerageId] ?? 0) + 1
    }
    return counts
  }, [positions])

  useEffect(() => {
    window.scrollTo({ top: 0 })
    setMoreOpen(false)
    if (location.pathname.startsWith('/app/news')) setHasUnreadNews(false)
  }, [location.pathname, setHasUnreadNews])

  const rail = NAV_ITEMS.filter((i) => i.rail)
  const primary = NAV_ITEMS.filter((i) => i.primary).sort(
    (a, b) =>
      (a.mobileOrder ?? NAV_ITEMS.indexOf(a)) - (b.mobileOrder ?? NAV_ITEMS.indexOf(b)),
  )
  const secondary = NAV_ITEMS.filter((i) => !i.primary)
  const secondaryActive = secondary.some((i) => location.pathname.startsWith(i.to))

  return (
    <div className="min-h-svh">
      <OrderToastHost />
      {/* ---------- Desktop: slim left rail ---------- */}
      <aside className="glass-nav fixed inset-y-0 left-0 z-30 hidden w-[284px] flex-col border-r border-line px-3 py-5 lg:flex">
        <div className="px-2 pb-7">
          <Logo size={40} wordmarkClassName="text-[24px]" />
        </div>

        <nav className="flex flex-col gap-1" aria-label="Primary">
          {rail.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              aria-label={item.to === '/app/news' && hasUnreadNews ? 'News, unread' : item.label}
              className={({ isActive }) =>
                cn(
                  'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-semibold transition-colors',
                  isActive
                    ? 'bg-brand-100 text-ink'
                    : 'text-ink-soft hover:bg-white/[0.05] hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive ? (
                    <span
                      className="absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-500"
                      aria-hidden
                    />
                  ) : null}
                  <item.icon
                    size={18}
                    className={isActive ? 'text-brand-300' : 'text-ink-muted'}
                  />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Live ticker collection fills the rail between nav and the foot. */}
        <Watchlist className="mt-4 flex-1 border-t border-line pt-3" />

        {/* Buying power card pinned to the rail's foot, per the mockup. */}
        <div className="mt-4 space-y-2.5">
          <AITradingControl />
          <SidebarBrokerageSelector counts={brokerageCounts} />
        </div>
      </aside>

      <TopBar />

      {/* ---------- Content ---------- */}
      <main className="lg:pl-[284px]">
        <div className="mx-auto max-w-[1440px] px-4 pt-4 pb-28 sm:px-6 lg:max-w-[1392px] lg:px-0 lg:pb-10">
          <Outlet />
        </div>
      </main>

      {/* ---------- Mobile: bottom tab bar ---------- */}
      <nav
        className="glass-nav fixed inset-x-0 bottom-0 z-30 border-t border-line pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Primary"
      >
        <div className="mx-auto grid max-w-[520px] grid-cols-5">
          {primary.map((item) => {
            const MobileIcon = item.mobileIcon ?? item.icon
            const mobileLabel = item.mobileLabel ?? item.label
            return (
              <NavLink
                key={item.to}
                to={item.to}
                aria-label={item.to === '/app/news' && hasUnreadNews ? 'News, unread' : mobileLabel}
                className={({ isActive }) =>
                  cn(
                    'relative flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-bold transition-colors',
                    isActive ? 'text-brand-300' : 'text-ink-muted',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive ? (
                      <span
                        className="absolute top-0 h-[3px] w-9 rounded-b-full bg-brand-500"
                        aria-hidden
                      />
                    ) : null}
                    <span className="relative">
                      <MobileIcon size={20} strokeWidth={isActive ? 2.4 : 2} />
                      {item.to === '/app/news' && hasUnreadNews ? (
                        <span
                          className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-[#ff4d5e] ring-2 ring-[#12171f]"
                          aria-hidden
                        />
                      ) : null}
                    </span>
                    {mobileLabel}
                  </>
                )}
              </NavLink>
            )
          })}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            className={cn(
              'relative flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-bold transition-colors',
              moreOpen || secondaryActive ? 'text-brand-300' : 'text-ink-muted',
            )}
          >
            {moreOpen || secondaryActive ? (
              <span className="absolute top-0 h-[3px] w-9 rounded-b-full bg-brand-500" aria-hidden />
            ) : null}
            {moreOpen ? (
              <X size={20} strokeWidth={2.4} />
            ) : (
              <MoreHorizontal size={20} strokeWidth={2.2} />
            )}
            More
          </button>
        </div>
      </nav>

      {/* ---------- Mobile: "More" menu ---------- */}
      {moreOpen ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-30 bg-[#04070d]/78 backdrop-blur-[6px] lg:hidden"
            onClick={() => setMoreOpen(false)}
          />
          <div className="modal-surface no-scrollbar fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] z-30 mx-3 max-h-[calc(100svh-84px)] overflow-y-auto rounded-[24px] p-3 lg:hidden">
            {/* Every destination stacked in one column, styled as the
                notification row is, so the sheet reads as one list. */}
            <div className="mb-2 space-y-1.5">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 rounded-2xl border border-line bg-white/[0.035] px-3 py-2.5 transition-colors hover:bg-white/[0.055]',
                      isActive && 'border-brand-300/30 bg-brand-400/[0.1]',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn(
                          'grid h-8 w-8 shrink-0 place-items-center rounded-xl',
                          isActive
                            ? 'bg-brand-500/25 text-brand-200'
                            : 'bg-brand-500/12 text-brand-300',
                        )}
                      >
                        <item.icon size={15} />
                      </span>
                      <span className="min-w-0 flex-1 text-[12.5px] font-bold text-ink">
                        {item.label}
                      </span>
                      <ChevronRight size={15} className="shrink-0 text-ink-muted" />
                    </>
                  )}
                </NavLink>
              ))}
            </div>
            <div className="mb-2">
              <MobileNotificationSettings />
            </div>
            <AITradingControl variant="row" />
          </div>
        </>
      ) : null}

      <FloatingAssistant />
      <NewsToastHost />
    </div>
  )
}
