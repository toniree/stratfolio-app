import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Sparkles } from 'lucide-react'
import { cn } from '@/lib/cn'
import { relativeTime } from '@/lib/format'

interface ThesisPreviewProps {
  bullets: string[]
  updatedAt?: string
  expanded: boolean
  onToggle: () => void
  className?: string
  label?: string
}

export function ThesisPreview({
  bullets,
  updatedAt,
  expanded,
  onToggle,
  className,
  label = 'Why?',
}: ThesisPreviewProps) {
  return (
    <div className={cn('liquid-inset overflow-hidden rounded-[20px] border-brand-400/20', className)}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Sparkles size={15} className="shrink-0 text-brand-300" />
          <span className="text-[13.5px] font-bold text-ink">{label}</span>
          <span className="truncate text-[12.5px] text-ink-soft">
            {expanded ? 'AI thesis' : `${bullets.length} points behind this call`}
          </span>
        </span>
        <ChevronDown
          size={17}
          className={cn(
            'shrink-0 text-ink-muted transition-transform duration-200',
            expanded && 'rotate-180',
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-3.5">
              <ul className="space-y-2 border-t border-white/[0.075] pt-3">
                {bullets.map((bullet, i) => (
                  <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-ink-soft">
                    <span
                      className="ai-gradient mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                      aria-hidden
                    />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
              {updatedAt ? (
                <p className="mt-3 text-[11.5px] text-ink-muted">
                  Thesis refreshed {relativeTime(updatedAt)} · StratFolio AI
                </p>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
