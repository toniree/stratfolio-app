import { useMemo } from 'react'
import { Bell, Search, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { formatSignedPercent } from '@/lib/format'
import { computeTotals } from '@/lib/portfolioMath'
import { usePrices, useTrackedSymbols } from '@/store/priceStore'
import { useOptionMarks } from '@/hooks/marketQueries'
import { ProvenanceTag, StaleTag } from '@/components/shared/ProvenanceTag'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'
import { usePortfolioMeta, usePositions } from '@/hooks/queries'
import { Logo } from '@/components/brand/Logo'
import { BrokerageSelector } from '@/components/portfolio/BrokerageFilter'
import { DemoBadge } from '@/components/shell/DemoBadge'
import { MobilePortfolioSummary } from '@/components/shell/MobilePortfolioSummary'
import { MobileMarketTicker } from '@/components/portfolio/MobileMarketTicker'
import { HeaderOrders } from '@/components/shell/HeaderOrders'

/**
 * Tickers the strip *offers* to show, in order. It shows the ones the bound
 * data source actually serves and nothing else.
 *
 * This replaces a DOW tile whose level was manufactured from SPY's day change
 * times 0.42 (§6, "DOW-from-SPY"). No dataset in this system carries the Dow,
 * and a plausible-looking index level is the most dangerous kind of fabricated
 * number: nobody checks a number they recognise. Nothing here is derived from
 * anything else — each tile is one symbol's own quote or it is absent.
 */
const INDEX_SYMBOLS = ['SPY', 'QQQ', 'IWM'] as const

export function TopBar() {
  const prices = usePrices()
  useTrackedSymbols(INDEX_SYMBOLS)
  const user = useAuthStore((s) => s.session?.user)
  const accountId = useUiStore((s) => s.accountId)
  const brokerageFilter = useUiStore((s) => s.brokerageFilter)
  const { data: positions, isLoading: positionsLoading } = usePositions(accountId)
  const { data: portfolioMeta, isLoading: metaLoading } = usePortfolioMeta(accountId)
  const counts = useMemo(() => {
    const result: Record<string, number> = {}
    for (const position of positions ?? []) {
      // Live positions carry no brokerage (one paper portfolio, HKP-PLT-6), so
      // they simply do not contribute to a per-brokerage count.
      if (!position.brokerageId) continue
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
  // Real contract marks, when the market domain is live. `{}` in mock mode,
  // which leaves the demo option model exactly as it was.
  const { marks } = useOptionMarks(positions)
  const totals = useMemo(
    () => computeTotals(selectedPositions, prices, marks),
    [selectedPositions, prices, marks],
  )
  const indices = INDEX_SYMBOLS.map((symbol) => prices[symbol]).filter(
    (quote) => quote !== undefined,
  )

  return (
    <header className="glass-nav sticky top-0 z-20 border-b border-line lg:pl-[284px]">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-1.5 px-3 sm:gap-3 sm:px-6 lg:h-[76px]">
        {/* Compact mobile lockup; the wordmark yields only on very narrow phones. */}
        <div className="hidden min-[360px]:block lg:hidden">
          <Logo size={32} wordmarkClassName="hidden text-[18.5px] min-[375px]:inline" />
        </div>

        {/* Search — the mockup's most prominent top-bar element. */}
        <label className="relative hidden min-w-0 flex-1 items-center lg:flex lg:max-w-[120px]">
          <Search size={18} className="pointer-events-none absolute left-4 text-ink-muted" />
          <input
            type="search"
            placeholder="Search markets, assets, ideas"
            className="h-11 w-full rounded-[14px] border border-line bg-white/[0.04] pr-4 pl-11 text-[14px] text-ink placeholder:text-ink-muted focus:border-brand-500/50 focus:outline-none"
          />
        </label>

        <HeaderOrders />

        <div className="ml-auto min-w-0 lg:hidden">
          <BrokerageSelector counts={counts} />
        </div>

        <MobilePortfolioSummary
          marketValue={totals.marketValue}
          cash={portfolioMeta?.cash ?? 0}
          dayPl={totals.dayPl}
          dayPlPct={totals.dayPlPct}
          dayPlAvailable={totals.dayPlAvailable}
          loading={positionsLoading || metaLoading}
        />

        {/* Index strip — one tile per symbol the data source actually serves. */}
        <div className="ml-auto hidden items-center gap-7 xl:flex">
          {indices.map((quote) => (
            <div key={quote.symbol} className="text-right">
              <div className="flex items-center justify-end gap-1.5">
                <span className="text-[11px] font-semibold tracking-[0.04em] text-ink-muted uppercase">
                  {quote.symbol}
                </span>
                <ProvenanceTag provenance={quote.provenance} />
                <StaleTag stale={quote.stale} />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="num text-[14px] font-bold text-ink">
                  {quote.price.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span
                  className={cn(
                    'num text-[12px] font-bold',
                    quote.dayChangePct >= 0 ? 'text-up' : 'text-down',
                  )}
                >
                  {formatSignedPercent(quote.dayChangePct)}
                </span>
              </div>
            </div>
          ))}
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
            className="group ml-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full border border-brand-300/15 bg-[#173254] text-[12px] font-bold text-white/82 shadow-[inset_0_1px_rgba(255,255,255,0.07)] transition-[background-color,transform] group-hover:bg-[#1b3b64] group-active:scale-95">
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
      className="relative hidden h-10 w-10 place-items-center rounded-full text-ink-soft transition-colors hover:bg-white/[0.07] hover:text-ink lg:grid"
    >
      {children}
      {badge ? (
        <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-brand-500 ring-2 ring-[#12171f]" />
      ) : null}
    </Link>
  )
}
