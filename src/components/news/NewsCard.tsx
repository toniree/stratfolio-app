import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { relativeTime } from '@/lib/format'
import type { NewsArticle } from '@/api/newsTypes'
import { TickerChip } from '@/components/news/TickerChip'
import { AITradeIdeaArrow } from '@/components/news/AITradeIdeaArrow'

const SENTIMENT: Record<NewsArticle['sentiment'], { label: string; className: string }> = {
  bullish: { label: 'Bullish', className: 'bg-up-soft text-up' },
  bearish: { label: 'Bearish', className: 'bg-down-soft text-down' },
  neutral: { label: 'Neutral', className: 'bg-surface-sunken text-ink-soft' },
}

export function NewsCard({ article }: { article: NewsArticle }) {
  const sentiment = SENTIMENT[article.sentiment]

  return (
    <article className="glass-flat group relative isolate overflow-hidden rounded-[22px] border-white/[0.09] p-4 shadow-[inset_0_1px_rgba(255,255,255,0.07),0_16px_42px_-32px_rgba(47,123,255,0.5)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-white/[0.15] hover:shadow-[inset_0_1px_rgba(255,255,255,0.09),0_18px_46px_-24px_rgba(0,0,0,0.85),0_12px_28px_-24px_rgba(47,123,255,0.44)]">
      <span
        className={cn(
          'absolute top-5 bottom-5 left-0 w-[2px] rounded-r-full',
          article.sentiment === 'bullish'
            ? 'bg-up/70'
            : article.sentiment === 'bearish'
              ? 'bg-down/70'
              : 'bg-brand-400/60',
        )}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3 pl-0.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
            <span className="font-bold text-ink-soft">{article.source}</span>
            <span className="text-ink-muted">{relativeTime(article.publishedAt)}</span>
            <span
              className={cn(
                'rounded px-1.5 py-0.5 text-[10px] font-bold tracking-[0.05em] uppercase',
                sentiment.className,
              )}
            >
              {sentiment.label}
            </span>
          </div>

          <h3 className="mt-1.5 text-[15.5px] leading-snug font-bold tracking-[-0.01em] text-ink">
            <Link to={`/app/news/${article.id}`} className="hover:underline">
              <span className="absolute inset-0" aria-hidden />
              {article.headline}
            </Link>
          </h3>
        </div>

        {article.tradeIdeaId ? (
          <div className="relative z-10 shrink-0">
            <AITradeIdeaArrow tradeIdeaId={article.tradeIdeaId} />
          </div>
        ) : null}
      </div>

      <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-ink-soft">{article.summary}</p>

      <div className="liquid-inset relative z-10 mt-3 flex flex-wrap items-center gap-2 rounded-[16px] px-2.5 py-2">
        {article.tickers.map((ticker) => (
          <TickerChip key={ticker.symbol} symbol={ticker.symbol} showSparkline />
        ))}
        <span className="ml-auto text-[11.5px] text-ink-muted">{article.readMinutes} min read</span>
      </div>
    </article>
  )
}
