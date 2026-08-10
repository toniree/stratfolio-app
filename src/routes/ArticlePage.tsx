import { Link, useParams } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/cn'
import { relativeTime } from '@/lib/format'
import { useNewsArticle, usePlannerIdeas } from '@/hooks/queries'
import { PageHeader } from '@/components/shared/PageHeader'
import { TickerChip } from '@/components/news/TickerChip'
import { AITradeIdeaArrow } from '@/components/news/AITradeIdeaArrow'
import { AIConvictionBadge } from '@/components/intelligence/AIConvictionBadge'
import { StaticPill } from '@/components/shared/Pill'
import { Skeleton } from '@/components/ui/Skeleton'
import { NotFound } from '@/components/shared/DetailPrimitives'
import { Button } from '@/components/ui/Button'
import { ArticleAskBar } from '@/components/news/ArticleAskBar'

const SENTIMENT: Record<string, { label: string; className: string }> = {
  bullish: { label: 'Bullish', className: 'bg-up-soft text-up' },
  bearish: { label: 'Bearish', className: 'bg-down-soft text-down' },
  neutral: { label: 'Neutral', className: 'bg-surface-sunken text-ink-soft' },
}

/** Deep-linkable article view — the demo news toast navigates straight here. */
export function ArticlePage() {
  const { id } = useParams<{ id: string }>()
  const { data: article, isLoading } = useNewsArticle(id)
  const { data: plannerIdeas } = usePlannerIdeas()

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    )
  }

  if (!article) {
    return (
      <NotFound
        title="Article not found"
        detail="This story is no longer in the feed."
        backTo="/app/news"
        backLabel="Back to News"
      />
    )
  }

  const idea = plannerIdeas?.find((i) => i.id === article.tradeIdeaId)
  const sentiment = SENTIMENT[article.sentiment]

  return (
    <article className="mx-auto max-w-[760px] space-y-4 pb-4">
      <PageHeader
        backTo="/app/news"
        backLabel="News"
        title={article.headline}
        mobileTitle="NEWS"
        mobileSubtitle={article.source}
      />

      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
        <span className="font-bold text-ink-soft">{article.source}</span>
        <span className="text-ink-muted">·</span>
        <span className="text-ink-muted">{article.author}</span>
        <span className="text-ink-muted">·</span>
        <span className="text-ink-muted">{relativeTime(article.publishedAt)}</span>
        <span
          className={cn(
            'rounded px-1.5 py-0.5 text-[10px] font-bold tracking-[0.05em] uppercase',
            sentiment.className,
          )}
        >
          {sentiment.label}
        </span>
        <span className="text-ink-muted">{article.readMinutes} min read</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {article.tickers.map((ticker) => (
          <TickerChip key={ticker.symbol} symbol={ticker.symbol} showSparkline />
        ))}
      </div>

      {/* ---- The optional AI plan derived from this story ---- */}
      {idea ? (
        <section className="card relative overflow-hidden rounded-[24px] border-brand-400/20">
          <span className="thesis-edge-seam absolute inset-x-0 top-0 h-[3px]" aria-hidden>
            <span className="thesis-edge-spark thesis-edge-spark-left" />
            <span className="thesis-edge-spark thesis-edge-spark-right" />
          </span>
          <div className="ai-tint absolute inset-0" aria-hidden />
          <div className="relative p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.08em] text-brand-300 uppercase">
                  <Sparkles size={13} />
                  StratFolio AI generated a plan from this story
                </div>
                <h2 className="mt-1.5 text-[15.5px] leading-snug font-bold text-ink">
                  {idea.symbol} · {idea.title}
                </h2>
              </div>
              {article.tradeIdeaId ? (
                <AITradeIdeaArrow tradeIdeaId={article.tradeIdeaId} compact className="mt-0.5" />
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {idea.ai ? (
                <AIConvictionBadge
                  score={idea.ai.conviction}
                  delta={idea.ai.convictionDelta}
                  size="sm"
                />
              ) : null}
              <StaticPill tone={idea.direction === 'LONG' ? 'positive' : 'negative'}>
                {idea.direction}
              </StaticPill>
              <StaticPill tone="ai">{idea.horizon}</StaticPill>
            </div>

            {/* Hollow blue: navigating to a plan is not a commit, so it reads
                lighter than the solid green order buttons. */}
            <Button
              asChild
              variant="secondary"
              size="lg"
              className="plan-action-button mx-auto mt-3.5 flex h-10 justify-center rounded-[14px] border-brand-300/45 bg-transparent px-5 text-white hover:border-brand-200/70 hover:bg-brand-400/[0.12]"
            >
              <Link to={`/app/plan?idea=${encodeURIComponent(idea.id)}`}>
                Open Trade Plan
              </Link>
            </Button>
          </div>
        </section>
      ) : null}

      <div className="card p-4 sm:p-6">
        <p className="text-[15px] leading-relaxed font-semibold text-ink">{article.summary}</p>
        <div className="mt-4 space-y-4">
          {article.body.map((paragraph, i) => (
            <p key={i} className="text-[14.5px] leading-[1.75] text-ink-soft">
              {paragraph}
            </p>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
          {article.topics.map((topic) => (
            <StaticPill key={topic} tone="muted">
              {topic}
            </StaticPill>
          ))}
        </div>
        <p className="mt-4 text-[11.5px] text-ink-muted">
          Simulated market story generated for this demo. Not investment advice.
        </p>
      </div>

      {/* Discuss the story, or turn it into a plan, without leaving it. */}
      <ArticleAskBar article={article} />
    </article>
  )
}
