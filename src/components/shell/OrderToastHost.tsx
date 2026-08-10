import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import { useOrderToastStore, type OrderToast } from '@/store/orderToastStore'

const LIFETIME_MS = 3000

/**
 * ThinkOrSwim-style order acknowledgements: a translucent slab at the top of
 * the viewport that states what happened and fades out on its own.
 *
 * Deliberately not interactive — it confirms rather than asks, so it never
 * takes pointer events or steals a tap from the content beneath it.
 */
export function OrderToastHost() {
  const toasts = useOrderToastStore((state) => state.toasts)

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+10px)] z-[60] flex flex-col items-center gap-1.5 px-3">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <ToastRow key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  )
}

function ToastRow({ toast }: { toast: OrderToast }) {
  const dismiss = useOrderToastStore((state) => state.dismiss)

  useEffect(() => {
    const id = setTimeout(() => dismiss(toast.id), LIFETIME_MS)
    return () => clearTimeout(id)
  }, [toast.id, dismiss])

  return (
    <motion.div
      // Drops in from above, then fades where it stands — no travel on exit, so
      // it never reads as moving away from the eye following it.
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
      role="status"
      aria-live="polite"
      className="glass-strong flex w-full max-w-[340px] items-center gap-2.5 rounded-[14px] px-3 py-2 shadow-[0_18px_44px_-22px_rgba(0,0,0,0.95)]"
    >
      <span
        className={cn(
          'shrink-0 rounded-md px-1.5 py-0.5 text-[8.5px] font-extrabold tracking-[0.09em] uppercase',
          toast.tone === 'up' && 'bg-up-soft text-up',
          toast.tone === 'down' && 'bg-down-soft text-down',
          toast.tone === 'neutral' && 'bg-white/[0.08] text-ink-soft',
        )}
      >
        {toast.kind}
      </span>
      <span className="min-w-0 flex-1">
        <span className="num block truncate text-[11.5px] font-bold text-ink">{toast.title}</span>
        {toast.detail ? (
          <span className="block truncate text-[9.5px] text-ink-muted">{toast.detail}</span>
        ) : null}
      </span>
    </motion.div>
  )
}
