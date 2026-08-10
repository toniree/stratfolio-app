import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check, ChevronDown, Newspaper, Search } from 'lucide-react'
import { useNewsArticles } from '@/hooks/queries'
import { PageHeader } from '@/components/shared/PageHeader'
import { cn } from '@/lib/cn'
import { NewsCard } from '@/components/news/NewsCard'
import { Skeleton } from '@/components/ui/Skeleton'
import { NewsTickerToggle } from '@/components/news/NewsTickerToggle'

const TIMEFRAMES = [
  { id: 'all', label: 'All time' },
  { id: '1h', label: 'Past hour' },
  { id: '4h', label: 'Past 4 hours' },
  { id: 'today', label: 'Today' },
] as const

export function NewsPage() {
  const { data: articles, isLoading } = useNewsArticles()
  const [topic, setTopic] = useState<string>('all')
  const [tickerQuery, setTickerQuery] = useState('')
  const [timeframe, setTimeframe] = useState('all')

  const topics = useMemo(() => {
    const set = new Set<string>()
    for (const article of articles ?? []) {
      for (const t of article.topics) set.add(t)
    }
    return Array.from(set).sort()
  }, [articles])

  const visible = useMemo(() => {
    const query = tickerQuery.trim().toUpperCase()
    const now = Date.now()
    const cutoffHours = timeframe === '1h' ? 1 : timeframe === '4h' ? 4 : timeframe === 'today' ? 24 : null

    return (articles ?? []).filter((article) => {
      const matchesTopic = topic === 'all' || article.topics.includes(topic)
      const matchesTicker =
        !query || article.tickers.some((ticker) => ticker.symbol.toUpperCase().includes(query))
      const matchesTimeframe =
        cutoffHours === null || now - new Date(article.publishedAt).getTime() <= cutoffHours * 60 * 60_000
      return matchesTopic && matchesTicker && matchesTimeframe
    })
  }, [articles, tickerQuery, timeframe, topic])

  return (
    <div className="space-y-4">
      <PageHeader
        backTo="/app/portfolio"
        backLabel="Portfolio"
        title={
          <span className="inline-flex items-center gap-2">
            <span className="ai-score-neon-purple inline-flex h-7 w-7 items-center justify-center rounded-full text-brand-100">
              <Newspaper size={14} strokeWidth={2.1} />
            </span>
            News
          </span>
        }
        mobileTitle="NEWS"
        mobileSubtitle="Market stories that move your book."
        subtitle="Market stories that move your book. Stories with an AI plan show a glowing plan badge."
        aside={<NewsTickerToggle />}
      />

      <div className="glass-flat overflow-hidden rounded-[20px] border-white/[0.1] shadow-[inset_0_1px_rgba(255,255,255,0.08),0_14px_34px_-26px_rgba(66,153,255,0.7)]">
        <div className="flex items-center gap-2 p-2.5">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-[13px] border border-white/[0.09] bg-[#0d1623]/55 px-3 py-2.5 shadow-[inset_0_1px_rgba(255,255,255,0.05)] transition-all focus-within:border-brand-300/40 focus-within:bg-brand-400/[0.07] focus-within:shadow-[inset_0_1px_rgba(255,255,255,0.08),0_0_14px_rgba(91,166,255,0.09)]">
            <Search size={14} className="shrink-0 text-brand-200" />
            <span className="sr-only">Search news by ticker</span>
            <input
              value={tickerQuery}
              onChange={(event) => setTickerQuery(event.target.value)}
              placeholder="Search ticker and/or keyword"
              autoCapitalize="characters"
              className="min-w-0 flex-1 bg-transparent text-[12.5px] font-bold tracking-[0.03em] text-white outline-none placeholder:font-medium placeholder:tracking-normal placeholder:text-white/48"
            />
          </label>
          {/* Radix menu rather than a native select: the OS dropdown renders
              detached from the control and in its own styling. */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger
              aria-label="News timeframe"
              className="inline-flex h-[39px] shrink-0 items-center gap-1.5 rounded-[13px] border border-white/[0.1] bg-[#0d1623]/55 pr-2.5 pl-3 text-[11.5px] font-bold text-white/90 shadow-[inset_0_1px_rgba(255,255,255,0.06)] outline-none transition-all hover:border-brand-300/30 hover:bg-brand-400/[0.07] data-[state=open]:border-brand-300/40"
            >
              {TIMEFRAMES.find((item) => item.id === timeframe)?.label ?? 'All time'}
              <ChevronDown size={13} className="text-brand-200" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={6}
                className="glass-chrome z-50 min-w-[150px] rounded-[14px] border border-line p-1 shadow-[0_20px_48px_-24px_rgba(0,0,0,0.95)]"
              >
                {TIMEFRAMES.map((item) => (
                  <DropdownMenu.Item
                    key={item.id}
                    onSelect={() => setTimeframe(item.id)}
                    className={cn(
                      'flex cursor-pointer items-center justify-between rounded-[10px] px-2.5 py-1.5 text-[11.5px] font-bold outline-none select-none',
                      timeframe === item.id
                        ? 'bg-white/[0.1] text-ink'
                        : 'text-ink-soft data-[highlighted]:bg-white/[0.06] data-[highlighted]:text-ink',
                    )}
                  >
                    {item.label}
                    {timeframe === item.id ? <Check size={12} strokeWidth={3} /> : null}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto border-t border-white/[0.07] bg-[#0c1520]/36 px-2.5 py-2 no-scrollbar">
          {['all', ...topics].map((item) => {
            const active = topic === item
            return (
              <button
                key={item}
                type="button"
                aria-pressed={active}
                onClick={() => setTopic(item)}
                className={cn(
                  'shrink-0 rounded-xl border px-3 py-1.5 text-[11px] font-bold transition-[background-color,border-color,color,transform,box-shadow] duration-150 active:scale-[0.97]',
                  active
                    ? 'border-brand-200/25 bg-brand-400/[0.16] text-white shadow-[inset_0_1px_rgba(255,255,255,0.1),0_0_12px_rgba(91,166,255,0.08)]'
                    : 'border-white/[0.065] bg-white/[0.025] text-white/58 hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-white/82',
                )}
              >
                {item === 'all' ? 'All stories' : item}
              </button>
            )
          })}
          <span className="num ml-auto shrink-0 pl-2 text-[9.5px] font-semibold text-white/42">
            {visible.length} stories
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[190px] rounded-[18px]" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="card px-6 py-14 text-center">
          <p className="text-[15px] font-bold text-ink">No stories match these filters</p>
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {visible.map((article, index) => (
            <motion.div
              key={article.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, delay: Math.min(index * 0.03, 0.2) }}
            >
              <NewsCard article={article} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
