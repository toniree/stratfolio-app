import { Link } from 'react-router-dom'
import { Newspaper } from 'lucide-react'
import { relativeTime } from '@/lib/format'
import { useNewsArticles } from '@/hooks/queries'

export function RelatedNews({ symbol, limit = 3 }: { symbol: string; limit?: number }) {
  const { data: articles } = useNewsArticles()
  const related = (articles ?? [])
    .filter((a) => a.tickers.some((t) => t.symbol === symbol))
    .slice(0, limit)

  if (related.length === 0) return null

  return (
    <section className="card overflow-hidden rounded-[22px] p-4">
      <h3 className="mb-3 flex items-center gap-2 text-[10.5px] font-bold tracking-[0.08em] text-ink-muted uppercase">
        <span className="grid h-6 w-6 place-items-center rounded-lg bg-brand-500/10 text-brand-300">
          <Newspaper size={12} />
        </span>
        Related news
      </h3>
      <ul className="liquid-inset divide-y divide-white/[0.07] overflow-hidden rounded-[18px] px-2">
        {related.map((article) => (
          <li key={article.id}>
            <Link
              to={`/app/news/${article.id}`}
              className="-mx-2 block px-3 py-3 transition-colors hover:bg-white/[0.04]"
            >
              <p className="text-[13.5px] leading-snug font-semibold text-ink">
                {article.headline}
              </p>
              <p className="mt-1 text-[11.5px] text-ink-muted">
                {article.source} · {relativeTime(article.publishedAt)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
