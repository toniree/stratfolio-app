import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useCreatePlannerIdea } from '@/hooks/queries'
import type { PlannerDirection } from '@/api/newsTypes'
import { SYMBOL_MAP } from '@/api/mock/seededData'

interface FormState {
  symbol: string
  direction: PlannerDirection
  title: string
  entryLow: string
  entryHigh: string
  targetLow: string
  targetHigh: string
  stop: string
  horizon: string
  notes: string
}

const EMPTY: FormState = {
  symbol: '',
  direction: 'LONG',
  title: '',
  entryLow: '',
  entryHigh: '',
  targetLow: '',
  targetHigh: '',
  stop: '',
  horizon: '6–12 months',
  notes: '',
}

type Errors = Partial<Record<keyof FormState, string>>

export function CreateIdeaModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Errors>({})
  const createIdea = useCreatePlannerIdea()
  const navigate = useNavigate()

  useEffect(() => {
    if (open) {
      setForm(EMPTY)
      setErrors({})
      createIdea.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  // Prefill price fields once a known symbol is typed — small quality-of-life win.
  const applySymbol = (raw: string) => {
    const symbol = raw.toUpperCase().replace(/[^A-Z.]/g, '')
    set('symbol', symbol)
    const spec = SYMBOL_MAP.get(symbol)
    if (spec && !form.entryLow && !form.targetLow) {
      const price = spec.open
      setForm((f) => ({
        ...f,
        symbol,
        entryLow: (price * 0.96).toFixed(2),
        entryHigh: (price * 1.02).toFixed(2),
        targetLow: (price * 1.2).toFixed(2),
        targetHigh: (price * 1.32).toFixed(2),
        stop: (price * 0.88).toFixed(2),
      }))
    }
  }

  const validate = (): Errors => {
    const next: Errors = {}
    if (!/^[A-Z.]{1,6}$/.test(form.symbol)) next.symbol = 'Enter a ticker symbol.'
    if (form.title.trim().length < 4) next.title = 'Give the idea a one-line title.'

    const nums: (keyof FormState)[] = ['entryLow', 'entryHigh', 'targetLow', 'targetHigh', 'stop']
    for (const key of nums) {
      const value = Number(form[key])
      if (!Number.isFinite(value) || value <= 0) next[key] = 'Required'
    }
    if (!next.entryLow && !next.entryHigh && Number(form.entryLow) > Number(form.entryHigh)) {
      next.entryHigh = 'Must be ≥ entry low.'
    }
    if (!next.targetLow && !next.targetHigh && Number(form.targetLow) > Number(form.targetHigh)) {
      next.targetHigh = 'Must be ≥ target low.'
    }
    return next
  }

  const handleSubmit = async () => {
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) return

    const created = await createIdea.mutateAsync({
      symbol: form.symbol,
      direction: form.direction,
      title: form.title,
      notes: form.notes,
      entryLow: Number(form.entryLow),
      entryHigh: Number(form.entryHigh),
      targetLow: Number(form.targetLow),
      targetHigh: Number(form.targetHigh),
      stop: Number(form.stop),
      horizon: form.horizon,
    })
    onOpenChange(false)
    navigate(`/app/plan/${created.id}`)
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      className="sm:w-[min(520px,calc(100vw-2rem))]"
      title="New trade plan"
      description="Define the setup and execution criteria before capital moves."
      footer={
        <div className="flex gap-2.5">
          <Button variant="secondary" className="flex-1 border-white/[0.09] bg-white/[0.035] text-ink-soft" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="success"
            className="flex-[1.6]"
            onClick={handleSubmit}
            disabled={createIdea.isPending}
          >
            {createIdea.isPending ? 'Saving…' : 'Save plan'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Symbol" error={errors.symbol}>
            <input
              value={form.symbol}
              onChange={(e) => applySymbol(e.target.value)}
              placeholder="NVDA"
              className={inputClass(Boolean(errors.symbol))}
              autoCapitalize="characters"
            />
          </Field>

          <Field label="Direction">
            <div className="liquid-inset grid grid-cols-2 gap-1.5 rounded-xl p-1">
              {(['LONG', 'SHORT'] as PlannerDirection[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => set('direction', option)}
                  aria-pressed={form.direction === option}
                  className={cn(
                    'rounded-lg py-1.5 text-[12.5px] font-bold transition-colors',
                    form.direction === option
                      ? option === 'LONG'
                        ? 'bg-white/[0.07] text-up shadow-sm'
                        : 'bg-white/[0.07] text-down shadow-sm'
                      : 'text-ink-muted',
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <Field label="Plan prompt" error={errors.title}>
          <input
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Add on MI400 sampling confirmation, not before"
            className={inputClass(Boolean(errors.title))}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Entry low" error={errors.entryLow}>
            <input
              inputMode="decimal"
              value={form.entryLow}
              onChange={(e) => set('entryLow', e.target.value.replace(/[^\d.]/g, ''))}
              className={inputClass(Boolean(errors.entryLow))}
            />
          </Field>
          <Field label="Entry high" error={errors.entryHigh}>
            <input
              inputMode="decimal"
              value={form.entryHigh}
              onChange={(e) => set('entryHigh', e.target.value.replace(/[^\d.]/g, ''))}
              className={inputClass(Boolean(errors.entryHigh))}
            />
          </Field>
          <Field label="Target low" error={errors.targetLow}>
            <input
              inputMode="decimal"
              value={form.targetLow}
              onChange={(e) => set('targetLow', e.target.value.replace(/[^\d.]/g, ''))}
              className={inputClass(Boolean(errors.targetLow))}
            />
          </Field>
          <Field label="Target high" error={errors.targetHigh}>
            <input
              inputMode="decimal"
              value={form.targetHigh}
              onChange={(e) => set('targetHigh', e.target.value.replace(/[^\d.]/g, ''))}
              className={inputClass(Boolean(errors.targetHigh))}
            />
          </Field>
          <Field label="Stop" error={errors.stop}>
            <input
              inputMode="decimal"
              value={form.stop}
              onChange={(e) => set('stop', e.target.value.replace(/[^\d.]/g, ''))}
              className={inputClass(Boolean(errors.stop))}
            />
          </Field>
          <Field label="Horizon">
            <input
              value={form.horizon}
              onChange={(e) => set('horizon', e.target.value)}
              className={inputClass(false)}
            />
          </Field>
        </div>

        <Field label="Execution criteria and reason">
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={4}
            placeholder="What triggers execution? What would make you abandon or change the plan?"
            className={cn(inputClass(false), 'h-auto resize-y py-2.5 leading-relaxed')}
          />
        </Field>
      </div>
    </Modal>
  )
}

function inputClass(hasError: boolean): string {
  return cn(
    'liquid-control h-10 w-full rounded-xl px-3 text-[13px] font-medium text-ink outline-none placeholder:text-ink-muted/65',
    hasError && 'border-down',
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[9.5px] font-bold tracking-[0.07em] text-ink-muted uppercase">
        {label}
      </span>
      {children}
      {error ? <span className="mt-1 block text-[11.5px] font-semibold text-down">{error}</span> : null}
    </label>
  )
}
