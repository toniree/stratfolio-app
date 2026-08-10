import { useMemo } from 'react'
import { Bell, Search, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { formatSignedPercent } from '@/lib/format'
import { computeTotals } from '@/lib/portfolioMath'
import { usePrices } from '@/store/priceStore'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'
import { usePortfolioMeta, usePositions } from '@/hooks/queries'
import { Logo } from '@/components/brand/Logo'
import { BrokerageSelector } from '@/components/portfolio/BrokerageFilter'
import { DemoBadge } from '@/components/shell/DemoBadge'
import { MobilePortfolioSummary } from '@/components/shell/MobilePortfolioSummary'
import { MobileMarketTicker } from '@/components/portfolio/MobileMarketTicker'

/** Index levels are derived from SPY so the strip never contradicts the tape. */
const INDICES = [
  { label: 'S&P 500', base: 5321.41, factor: 1 },
  { label: 'NASDAQ', base: 16832.62, factor: 1.68 },
  { label: 'DOW', base: 39742.42, factor: 0.42 },
]

export function TopBar() {
  const prices = usePrices()
  const spy = prices.SPY
  const user = useAuthStore((s) => s.session?.user)
  const accountId = useUiStore((s) => s.accountId)
  const brokerageFilter = useUiStore((s) => s.brokerageFilter)
  const { data: positions, isLoading: positionsLoading } = usePositions(accountId)
  const { data: portfolioMeta, isLoading: metaLoading } = usePortfolioMeta(accountId)
  const counts = useMemo(() => {
    const result: Record<string, number> = {}
    for (const position of positions ?? []) {
      result[position.brokerageId] = (result[position.brokerageId] ?? 0) + 1
    }
    return result
  }, [positions])
  const selectedPositions = useMemo(
    () =>
      brokerageFilter === 'all'
        ? (positions ?? [])
        : (positions ?? []).filter((position) => position.brokerageId === brokerageFilter),
    [brokerageFilter, positions],
  )
  const totals = useMemo(() => computeTotals(selectedPositions, prices), [selectedPositions, prices])
  const basePct = spy?.dayChangePct ?? 0

  return (
    <header className="glass-nav sticky top-0 z-20 border-b border-line lg:pl-[236px]">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-1.5 px-3 sm:gap-3 sm:px-6">
        {/* Compact mobile lockup; the wordmark yields only on very narrow phones. */}
        <div className="hidden min-[360px]:block lg:hidden">
          <Logo size={32} wordmarkClassName="hidden text-[18.5px] min-[375px]:inline" />
        </div>

        {/* Search — the mockup's most prominent top-bar element. */}
        <label className="relative hidden min-w-0 flex-1 items-center lg:flex lg:max-w-[340px]">
          <Search size={16} className="pointer-events-none absolute left-3.5 text-ink-muted" />
          <input
            type="search"
            placeholder="Search markets, assets, ideas"
            className="h-10 w-full rounded-xl border border-line bg-white/[0.04] pr-3 pl-10 text-[13.5px] text-ink placeholder:text-ink-muted focus:border-brand-500/50 focus:outline-none"
          />
        </label>

        <div className="ml-auto min-w-0 lg:hidden">
          <BrokerageSelector counts={counts} />
        </div>

        <MobilePortfolioSummary
          marketValue={totals.marketValue}
          cash={portfolioMeta?.cash ?? 0}
          dayPl={totals.dayPl}
          dayPlPct={totals.dayPlPct}
          loading={positionsLoading || metaLoading}
        />

        {/* Index strip */}
        <div className="ml-auto hidden items-center gap-5 xl:flex">
          {INDICES.map((index) => {
            const pct = basePct * index.factor
            const value = index.base * (1 + pct / 100)
            return (
              <div key={index.label} className="text-right">
                <div className="text-[10.5px] font-semibold tracking-[0.04em] text-ink-muted uppercase">
                  {index.label}
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="num text-[13px] font-bold text-ink">
                    {value.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <span
                    className={cn(
                      'num text-[11.5px] font-bold',
                      pct >= 0 ? 'text-up' : 'text-down',
                    )}
                  >
                    {formatSignedPercent(pct)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex items-center gap-1.5 xl:ml-5">
          <DemoBadge />
          <IconButton label="Notifications" to="/app/activity" badge>
            <Bell size={17} />
          </IconButton>
          <IconButton label="Settings" to="/app/profile">
            <Settings size={17} />
          </IconButton>
          <Link
            to="/app/profile"
            aria-label="Profile"
            className="group ml-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full"
          >
            <span className="grid h-8 w-8 place-items-center rounded-full border border-brand-300/15 bg-[#173254] text-[11.5px] font-bold text-white/82 shadow-[inset_0_1px_rgba(255,255,255,0.07)] transition-[background-color,transform] group-hover:bg-[#1b3b64] group-active:scale-95">
              {(user?.name ?? 'Demo User')
                .split(' ')
                .map((part) => part[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </span>
          </Link>
        </div>
      </div>
      <div className="lg:hidden">
        <MobileMarketTicker />
      </div>
    </header>
  )
}

function IconButton({
  children,
  label,
  to,
  badge,
}: {
  children: React.ReactNode
  label: string
  to: string
  badge?: boolean
}) {
  return (
    <Link
      to={to}
      aria-label={label}
      className="relative hidden h-9 w-9 place-items-center rounded-full text-ink-soft transition-colors hover:bg-white/[0.07] hover:text-ink lg:grid"
    >
      {children}
      {badge ? (
        <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-brand-500 ring-2 ring-[#12171f]" />
      ) : null}
    </Link>
  )
}
