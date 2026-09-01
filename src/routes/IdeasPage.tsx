import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Search, X } from 'lucide-react'
import { useIdeas } from '@/hooks/queries'
import { PageHeader } from '@/components/shared/PageHeader'
import { IdeaCard } from '@/components/thesis/IdeaCard'
import { Skeleton } from '@/components/ui/Skeleton'
import { useThesisDecisionStore } from '@/store/thesisDecisionStore'

/** Discovery feed for trade theses that still need a user decision. */
export function IdeasPage() {
  const [query, setQuery] = useState('')
  const { data: ideas, isLoading } = useIdeas()
  const thesisDecisions = useThesisDecisionStore((s) => s.decisions)

  const visible = useMemo(() => {
    // Undecided theses only — a rejected one reappearing in search would look
    // like the rejection did not take.
    const open = (ideas ?? []).filter((idea) => !thesisDecisions[idea.id])
    const term = query.trim().toUpperCase()
    if (!term) return open
    return open.filter(
      (idea) =>
        idea.symbol.toUpperCase().includes(term) ||
        (idea.company?.toUpperCase().includes(term) ?? false),
    )
  }, [ideas, query, thesisDecisions])

  return (
    <div className="space-y-4">
      <PageHeader
        backTo="/app/portfolio"
        backLabel="Portfolio"
        title="Trade Theses"
        mobileTitle="TRADE THESES"
        mobileSubtitle="Research-backed setups with entry and target bands and an explicit risk frame."
        subtitle="Research-backed setups with a complete thesis, entry and target bands, and an explicit risk/reward frame."
      />

      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-muted"
          aria-hidden
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search theses by ticker"
          placeholder="Search ticker or any keyword…"
          className="liquid-control h-10 w-full rounded-full pr-10 pl-9 text-[12.5px] text-ink outline-none placeholder:text-ink-muted/70"
        />
        {query ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQuery('')}
            className="absolute top-1/2 right-2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-ink-muted transition-colors hover:bg-white/[0.07] hover:text-ink"
          >
            <X size={14} strokeWidth={2.4} />
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[380px] rounded-[18px]" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="card px-6 py-14 text-center">
          <p className="text-[15px] font-bold text-ink">Nothing here right now</p>
          <p className="mx-auto mt-1 max-w-[320px] text-[13px] leading-relaxed text-ink-soft">
            {query
              ? `No open thesis matches “${query.trim()}”.`
              : 'The model surfaces new theses only when conviction clears its threshold.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3.5 xl:grid-cols-2">
          {visible.map((idea, index) => (
            <motion.div
              key={idea.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.26, delay: Math.min(index * 0.04, 0.24) }}
            >
              <IdeaCard idea={idea} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
