import { Bell, BellOff } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useNotificationPreferencesStore } from '@/store/notificationPreferencesStore'

/** Quiet mute control for the ambient demo news toast. */
export function NewsTickerToggle({ className }: { className?: string }) {
  const enabled = useNotificationPreferencesStore((state) => state.newsEnabled)
  const setEnabled = useNotificationPreferencesStore((state) => state.setNewsEnabled)

  return (
    <button
      type="button"
      onClick={() => setEnabled(!enabled)}
      aria-pressed={enabled}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold shadow-[inset_0_1px_rgba(255,255,255,0.06)] transition-[background-color,color,border-color,transform] active:scale-[0.97]',
        enabled
          ? 'border-brand-200/20 bg-brand-400/[0.1] text-white/78 hover:bg-brand-400/[0.16] hover:text-white'
          : 'border-white/[0.07] bg-white/[0.025] text-white/42 hover:text-white/65',
        className,
      )}
    >
      {enabled ? <Bell size={13} /> : <BellOff size={13} />}
      {enabled ? 'Live news alerts on' : 'Live news alerts off'}
    </button>
  )
}
