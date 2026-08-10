import { useEffect, useState } from 'react'
import { Check, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/cn'
import { StudyIcon } from '@/components/shared/StudyIcon'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import {
  THESIS_STAT_LIMIT,
  THESIS_STAT_OPTIONS,
  type ThesisStatField,
} from '@/lib/thesisStats'
import { usePositionTilePreferences } from '@/store/positionTilePreferences'

/** Brand-coloured scholar gear, with the highlight tracing its outline. */
export function StudyBadge({ size = 22 }: { size?: number }) {
  return <StudyIcon size={size} className="text-brand-300" />
}

/**
 * Picker for the thesis tile's study rail.
 *
 * Every entry carries its own explanation because the studies are the point —
 * a trader choosing between gamma and vega should not have to leave the app to
 * remember which one an earnings print will hurt.
 */
export function ThesisStatSettings({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const stats = usePositionTilePreferences((state) => state.thesisStats)
  const setStats = usePositionTilePreferences((state) => state.setThesisStats)
  const [draft, setDraft] = useState<ThesisStatField[]>(stats)

  useEffect(() => {
    if (open) setDraft(stats)
  }, [open, stats])

  const toggle = (id: ThesisStatField) => {
    setDraft((current) => {
      if (current.includes(id)) return current.filter((entry) => entry !== id)
      if (current.length === THESIS_STAT_LIMIT) return current
      return [...current, id]
    })
  }

  const save = () => {
    if (draft.length === 0) return
    setStats(draft)
    onOpenChange(false)
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="wide"
      align="center"
      title={
        <span className="block text-[13px] font-extrabold tracking-[0.16em] text-ink uppercase">
          Studies
        </span>
      }
      footer={
        <Button variant="success" className="w-full" size="lg" disabled={draft.length === 0} onClick={save}>
          Save studies
        </Button>
      }
    >
      <div className="space-y-1.5">
        {THESIS_STAT_OPTIONS.map((option) => {
          const selected = draft.includes(option.id)
          const unavailable = !selected && draft.length === THESIS_STAT_LIMIT
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              disabled={unavailable}
              onClick={() => toggle(option.id)}
              className={cn(
                'flex w-full gap-2.5 rounded-[14px] border p-2.5 text-left transition-[background-color,border-color,transform] active:scale-[0.995]',
                selected
                  ? 'border-emerald-300/50 bg-emerald-400/[0.11] shadow-[inset_0_1px_rgba(255,255,255,0.07)]'
                  : 'liquid-inset hover:border-brand-400/25 hover:bg-white/[0.05]',
                unavailable && 'opacity-35',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border transition-colors',
                  selected
                    ? 'border-emerald-300 bg-emerald-400 text-[#071a12]'
                    : 'border-line-strong text-transparent',
                )}
              >
                <Check size={10} strokeWidth={3.2} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-1.5">
                  <span className="text-[12.5px] font-bold text-ink">{option.name}</span>
                  <span className="num text-[9px] font-bold tracking-[0.06em] text-ink-muted uppercase">
                    {option.label}
                  </span>
                </span>
                {/* Bright grey italics: reads as guidance, not as data. */}
                <span className="mt-1 block text-[11px] leading-relaxed text-[#c9d4e2] italic">
                  {option.detail}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="liquid-inset mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] text-ink-muted">
        <SlidersHorizontal size={13} className="shrink-0 text-brand-300" />
        {draft.length}/{THESIS_STAT_LIMIT} studies selected
      </div>
    </Modal>
  )
}
