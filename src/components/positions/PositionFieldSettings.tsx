import { useEffect, useState } from 'react'
import { Check, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { OPTION_STAT_OPTIONS } from '@/components/positions/OptionStatsPanel'
import {
  OPTION_STAT_LIMIT,
  POSITION_TILE_FIELD_COUNT,
  usePositionTilePreferences,
  type OptionStatField,
  type PositionTileField,
} from '@/store/positionTilePreferences'

const FIELD_OPTIONS: { id: PositionTileField; label: string; detail: string }[] = [
  {
    id: 'value',
    label: 'Value',
    detail:
      'What the position is worth right now at the mark. Read it against Cost to see the open trade, and against the rest of the book to see how much risk this one name is carrying.',
  },
  {
    id: 'return',
    label: 'Return',
    detail:
      'Percentage gain or loss since entry. The fair way to compare lines of different sizes — a 40% winner on a small position can matter less than a 6% move on your largest.',
  },
  {
    id: 'dayPl',
    label: 'Day P/L',
    detail:
      "Today's move in dollars. This is the line that tells you a position is reacting to something right now, rather than grinding along with the original thesis.",
  },
  {
    id: 'avgCost',
    label: 'Cost',
    detail:
      'Total capital committed, with the average entry beneath it. On long options this is also your maximum loss: the entire debit is at risk if the contract expires worthless.',
  },
  {
    id: 'mark',
    label: 'Mark',
    detail:
      'The contract price per share. Options are quoted per share but trade in 100-share lots, so multiply by 100 for what a single contract is actually worth.',
  },
]

export function PositionFieldSettings({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const fields = usePositionTilePreferences((state) => state.fields)
  const setFields = usePositionTilePreferences((state) => state.setFields)
  const optionStats = usePositionTilePreferences((state) => state.optionStats)
  const setOptionStats = usePositionTilePreferences((state) => state.setOptionStats)
  const [draft, setDraft] = useState<PositionTileField[]>(fields)
  const [statDraft, setStatDraft] = useState<OptionStatField[]>(optionStats)

  useEffect(() => {
    if (!open) return
    setDraft(fields)
    setStatDraft(optionStats)
  }, [fields, optionStats, open])

  const toggle = (field: PositionTileField) => {
    setDraft((current) => {
      if (current.includes(field)) return current.filter((item) => item !== field)
      if (current.length === POSITION_TILE_FIELD_COUNT) return current
      return [...current, field]
    })
  }

  const toggleStat = (stat: OptionStatField) => {
    setStatDraft((current) => {
      if (current.includes(stat)) return current.filter((item) => item !== stat)
      if (current.length === OPTION_STAT_LIMIT) return current
      return [...current, stat]
    })
  }

  const save = () => {
    if (draft.length !== POSITION_TILE_FIELD_COUNT) return
    setFields(draft)
    setOptionStats(statDraft)
    onOpenChange(false)
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      align="center"
      title={
        <span className="block text-[13px] font-extrabold tracking-[0.16em] text-ink uppercase">
          Fields
        </span>
      }
      footer={
        <Button variant="success" className="w-full" size="lg" disabled={draft.length !== POSITION_TILE_FIELD_COUNT} onClick={save}>
          Save fieldset
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        {FIELD_OPTIONS.map((option) => {
          const selected = draft.includes(option.id)
          const unavailable = !selected && draft.length === POSITION_TILE_FIELD_COUNT
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              disabled={unavailable}
              onClick={() => toggle(option.id)}
              className={cn(
                'relative min-h-[76px] rounded-2xl border p-3 text-left transition-[background-color,border-color,transform,opacity] active:scale-[0.98]',
                selected
                  ? 'border-emerald-300/55 bg-emerald-400/[0.12] shadow-[inset_0_1px_rgba(255,255,255,0.08)]'
                  : 'liquid-inset hover:border-brand-400/25 hover:bg-white/[0.05]',
                unavailable && 'opacity-35',
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-bold text-ink">{option.label}</span>
                <span
                  className={cn(
                    'grid h-5 w-5 place-items-center rounded-full border transition-colors',
                    selected
                      ? 'border-emerald-300 bg-emerald-400 text-[#071a12]'
                      : 'border-line-strong text-transparent',
                  )}
                >
                  <Check size={12} strokeWidth={3} />
                </span>
              </span>
              <span className="mt-1 block text-[10.5px] leading-relaxed text-[#c9d4e2] italic">
                {option.detail}
              </span>
            </button>
          )
        })}
      </div>
      <div className="liquid-inset mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] text-ink-muted">
        <SlidersHorizontal size={13} className="shrink-0 text-brand-300" />
        {draft.length}/{POSITION_TILE_FIELD_COUNT} fields selected
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <p className="text-[13px] font-bold text-ink">Contract analytics</p>
        <p className="mt-1 text-[11px] leading-snug text-ink-muted">
          Up to {OPTION_STAT_LIMIT} lines shown in the panel beside the option columns.
        </p>
        <div className="mt-2.5 space-y-1.5">
          {OPTION_STAT_OPTIONS.map((option) => {
            const selected = statDraft.includes(option.id)
            const unavailable = !selected && statDraft.length === OPTION_STAT_LIMIT
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                disabled={unavailable}
                onClick={() => toggleStat(option.id)}
                className={cn(
                  'flex w-full gap-2.5 rounded-[14px] border p-2.5 text-left transition-[background-color,border-color,transform] active:scale-[0.995]',
                  selected
                    ? 'border-brand-400/55 bg-brand-500/10 shadow-[inset_0_1px_rgba(255,255,255,0.07)]'
                    : 'liquid-inset hover:border-brand-400/25 hover:bg-white/[0.05]',
                  unavailable && 'opacity-35',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border transition-colors',
                    selected
                      ? 'border-brand-400 bg-brand-500 text-white'
                      : 'border-line-strong text-transparent',
                  )}
                >
                  <Check size={10} strokeWidth={3.2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-bold text-ink">{option.label}</span>
                  {/* Bright grey italics: guidance, not data. */}
                  <span className="mt-1 block text-[11px] leading-relaxed text-[#c9d4e2] italic">
                    {option.detail}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}
