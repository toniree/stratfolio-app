import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Info, Minus, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatMoney, formatQty } from '@/lib/format'
import type { Idea } from '@/api/types'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useAddIdeaToPortfolio } from '@/hooks/queries'
import { useUiStore } from '@/store/uiStore'
import { usePrice } from '@/store/priceStore'

/** Adds an AI idea to the selected portfolio as a tradeable position. */
export function AddToPortfolioModal({
  idea,
  open,
  onOpenChange,
}: {
  idea: Idea
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const accountId = useUiStore((s) => s.accountId)
  const snap = usePrice(idea.symbol)
  const addIdea = useAddIdeaToPortfolio(accountId)
  const [done, setDone] = useState(false)

  const isOption = idea.assetType === 'option'
  const unit = isOption ? 'contracts' : 'shares'
  const entryPrice = isOption ? idea.entryHigh : (snap?.price ?? idea.referencePrice)

  const defaultQty = useMemo(() => {
    if (isOption) return 5
    if (entryPrice > 400) return 5
    if (entryPrice > 100) return 15
    return 60
  }, [isOption, entryPrice])

  const [qtyText, setQtyText] = useState(String(defaultQty))
  const quantity = Number(qtyText) > 0 ? Number(qtyText) : 0
  const estimated = quantity * entryPrice * (isOption ? 100 : 1)

  useEffect(() => {
    if (open) {
      setDone(false)
      setQtyText(String(defaultQty))
      addIdea.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultQty])

  const handleAdd = async () => {
    await addIdea.mutateAsync({ ideaId: idea.id, quantity })
    setDone(true)
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={done ? 'Added to portfolio' : `Add ${idea.symbol} to portfolio`}
      description={done ? undefined : `${idea.company}${idea.contractDetail ? ` · ${idea.contractDetail}` : ''}`}
      footer={
        done ? (
          <div className="flex gap-2.5">
            <Button variant="secondary" className="flex-1" onClick={() => onOpenChange(false)}>
              Keep browsing
            </Button>
            <Button asChild className="flex-1">
              <Link to="/app/portfolio">View portfolio</Link>
            </Button>
          </div>
        ) : (
          <Button
            variant="success"
            className="w-full"
            size="lg"
            disabled={quantity <= 0 || addIdea.isPending}
            onClick={handleAdd}
          >
            {addIdea.isPending ? 'Adding…' : `Add ${formatQty(quantity)} ${unit}`}
          </Button>
        )
      }
    >
      {done ? (
        <div className="py-2 text-center">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 20 }}
            className="liquid-inset mx-auto grid h-16 w-16 place-items-center rounded-full border-up/25 bg-up-soft shadow-[0_12px_34px_-18px_rgba(52,211,153,0.7)]"
          >
            <CheckCircle2 size={34} className="text-up" strokeWidth={2.2} />
          </motion.div>
          <h3 className="mt-4 text-[18px] font-extrabold tracking-[-0.02em] text-ink">
            {idea.symbol} added ✓
          </h3>
          <p className="mx-auto mt-1.5 max-w-[320px] text-[13px] leading-relaxed text-ink-soft">
            {formatQty(quantity)} {unit} at {formatMoney(entryPrice)} now appears in your Positions
            with its full AI thesis attached.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label
              htmlFor="add-qty"
              className="mb-1.5 block text-[11px] font-bold tracking-[0.07em] text-ink-muted uppercase"
            >
              Quantity ({unit})
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => setQtyText((c) => String(Math.max(1, (Number(c) || 0) - 1)))}
                className="liquid-control grid h-11 w-11 shrink-0 place-items-center rounded-xl text-ink-soft active:scale-95"
              >
                <Minus size={16} />
              </button>
              <input
                id="add-qty"
                inputMode="decimal"
                value={qtyText}
                onChange={(e) => setQtyText(e.target.value.replace(/[^\d.]/g, ''))}
                className="liquid-control num h-11 min-w-0 flex-1 rounded-xl px-3 text-center text-[18px] font-bold text-ink outline-none"
              />
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => setQtyText((c) => String((Number(c) || 0) + 1))}
                className="liquid-control grid h-11 w-11 shrink-0 place-items-center rounded-xl text-ink-soft active:scale-95"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          <dl className="liquid-inset space-y-2.5 rounded-[18px] p-3.5">
            <Row label="Entry price" value={formatMoney(entryPrice)} />
            <Row
              label="AI entry range"
              value={`${formatMoney(idea.entryLow)} – ${formatMoney(idea.entryHigh)}`}
            />
            <Row label="Estimated cost" value={formatMoney(estimated)} emphasis />
          </dl>

          <div className="liquid-inset flex items-start gap-2 rounded-[16px] border-brand-400/15 px-3 py-2.5 text-[12px] leading-relaxed text-brand-200">
            <Info size={14} className="mt-0.5 shrink-0" />
            <span>
              Simulated. The position is added to your selected portfolio with this idea&apos;s full AI
              thesis, conviction score and risk/reward frame attached.
            </span>
          </div>
        </div>
      )}
    </Modal>
  )
}

function Row({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[12.5px] text-ink-soft">{label}</dt>
      <dd
        className={`num truncate text-right text-[13px] font-semibold text-ink ${
          emphasis ? 'text-[15px] font-extrabold' : ''
        }`}
      >
        {value}
      </dd>
    </div>
  )
}
