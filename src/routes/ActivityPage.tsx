import { AlertTriangle, ArrowLeftRight, FileText, Sparkles } from 'lucide-react'
import type { ActivityEvent } from '@/api/types'
import { useActivity } from '@/hooks/queries'
import { relativeTime } from '@/lib/format'
import { PageHeader } from '@/components/shared/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { SymbolIcon } from '@/components/shared/SymbolIcon'

const KIND: Record<
  ActivityEvent['kind'],
  { icon: typeof Sparkles; label: string; className: string }
> = {
  order: { icon: ArrowLeftRight, label: 'Order', className: 'bg-brand-50 text-brand-700' },
  'ai-signal': { icon: Sparkles, label: 'AI signal', className: 'bg-ai-soft text-brand-300' },
  'thesis-update': { icon: FileText, label: 'Thesis', className: 'bg-surface-sunken text-ink-soft' },
  alert: { icon: AlertTriangle, label: 'Alert', className: 'bg-[#FFF4E5] text-[#B26A00]' },
}

export function ActivityPage() {
  const { data: events, isLoading } = useActivity()

  return (
    <div className="space-y-4">
      <PageHeader
        title="Activity"
        mobileTitle="ACTIVITY"
        mobileSubtitle="Orders you submitted and every change the model made to its view."
        subtitle="Orders you submitted and every change the model made to its view."
      />

      {isLoading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[84px] rounded-2xl" />
          ))}
        </div>
      ) : (
        <ol className="space-y-2.5">
          {(events ?? []).map((event) => {
            const kind = KIND[event.kind]
            const Icon = kind.icon
            return (
              <li key={event.id} className="card flex gap-3 p-3.5">
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${kind.className}`}
                >
                  <Icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    {event.symbol ? <SymbolIcon symbol={event.symbol} size="sm" /> : null}
                    <h3 className="text-[13.5px] font-bold text-ink">{event.title}</h3>
                    <span className="ml-auto shrink-0 text-[11.5px] text-ink-muted">
                      {relativeTime(event.at)}
                    </span>
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">{event.detail}</p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
