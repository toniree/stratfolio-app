import { useState } from 'react'
import { BellRing, Bot, CheckCheck, ChevronDown, Clock3, Newspaper } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useNotificationPreferencesStore } from '@/store/notificationPreferencesStore'

export function MobileNotificationSettings() {
  const [open, setOpen] = useState(false)
  const preferences = useNotificationPreferencesStore()

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-white/[0.035]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.045]"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-500/12 text-brand-300">
          <BellRing size={15} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-bold text-ink">Notifications</span>
          <span className="block text-[9.5px] text-ink-muted">News, plans and AI trades</span>
        </span>
        <ChevronDown
          size={15}
          className={cn('shrink-0 text-ink-muted transition-transform', open && 'rotate-180')}
        />
      </button>

      {open ? (
        <div className="border-t border-line px-2 py-1.5">
          <NotificationRow
            icon={<Newspaper size={13} />}
            label="News"
            detail="Breaking market headlines"
            enabled={preferences.newsEnabled}
            onChange={preferences.setNewsEnabled}
          />
          <NotificationRow
            icon={<CheckCheck size={13} />}
            label="Plan executed"
            detail="A planned order was submitted"
            enabled={preferences.planExecutedEnabled}
            onChange={preferences.setPlanExecutedEnabled}
          />
          <NotificationRow
            icon={<Clock3 size={13} />}
            label="Plan about to execute"
            detail="A plan is nearing its trigger"
            enabled={preferences.planExecutionSoonEnabled}
            onChange={preferences.setPlanExecutionSoonEnabled}
          />
          <NotificationRow
            icon={<Bot size={13} />}
            label="AI made a trade"
            detail="Automated execution completed"
            enabled={preferences.aiTradeEnabled}
            onChange={preferences.setAiTradeEnabled}
          />
        </div>
      ) : null}
    </section>
  )
}

function NotificationRow({
  icon,
  label,
  detail,
  enabled,
  onChange,
}: {
  icon: React.ReactNode
  label: string
  detail: string
  enabled: boolean
  onChange: (enabled: boolean) => void
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl px-2 py-2">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-ink-muted">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold text-ink">{label}</span>
        <span className="block truncate text-[8.5px] text-ink-muted">{detail}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={`${label} notifications`}
        onClick={() => onChange(!enabled)}
        className={cn(
          'relative h-5 w-9 shrink-0 overflow-hidden rounded-full border transition-[background-color,border-color,box-shadow]',
          enabled
            ? 'border-brand-400/60 bg-brand-500 shadow-[0_0_12px_-6px_rgba(59,130,246,0.9)]'
            : 'border-line-strong bg-white/[0.07]',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-[left] duration-200',
            enabled ? 'left-[17px]' : 'left-0.5',
          )}
          aria-hidden
        />
      </button>
    </div>
  )
}
