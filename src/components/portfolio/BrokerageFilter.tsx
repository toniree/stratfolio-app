import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check, ChevronDown, Layers3 } from 'lucide-react'
import { Pill } from '@/components/shared/Pill'
import { BROKERAGES } from '@/data/brokerages'
import { useUiStore } from '@/store/uiStore'
import type { BrokerageId } from '@/api/types'
import { BrokerageLogo } from '@/components/shared/BrokerageBadge'

/**
 * Filters the holdings inside whichever portfolio is selected. Intentionally a
 * separate control from `PortfolioSelector` — picking a book and filtering by
 * brokerage are two different questions.
 */
export function BrokerageFilter({ counts }: { counts: Record<string, number> }) {
  const value = useUiStore((s) => s.brokerageFilter)
  const setValue = useUiStore((s) => s.setBrokerageFilter)

  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  const present = BROKERAGES.filter((b) => (counts[b.id] ?? 0) > 0)

  return (
    <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:px-0">
      <Pill active={value === 'all'} onClick={() => setValue('all')}>
        All brokerages
        <span className="num opacity-70">{total}</span>
      </Pill>
      {present.map((brokerage) => (
        <Pill
          key={brokerage.id}
          active={value === brokerage.id}
          onClick={() => setValue(brokerage.id as BrokerageId)}
        >
          <BrokerageLogo id={brokerage.id} size="xs" />
          {brokerage.short}
          <span className="num opacity-70">{counts[brokerage.id] ?? 0}</span>
        </Pill>
      ))}
    </div>
  )
}

/** Compact brokerage picker used in the mobile top bar. */
export function BrokerageSelector({ counts }: { counts: Record<string, number> }) {
  const value = useUiStore((state) => state.brokerageFilter)
  const setValue = useUiStore((state) => state.setBrokerageFilter)
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0)
  const present = BROKERAGES.filter((brokerage) => (counts[brokerage.id] ?? 0) > 0)
  const current = value === 'all' ? undefined : BROKERAGES.find((brokerage) => brokerage.id === value)

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={`Brokerage filter: ${current?.name ?? 'All brokerages'}`}
        className="group inline-flex h-12 max-w-[110px] min-w-0 items-center gap-1.5 bg-transparent px-1.5 text-[10px] font-bold text-ink-soft transition-colors hover:text-ink"
      >
        {current ? (
          <span className="opacity-60 saturate-75 transition-opacity group-hover:opacity-75">
            <BrokerageLogo id={current.id} size="md" />
          </span>
        ) : (
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-500/15 text-brand-300">
            <Layers3 size={14} />
          </span>
        )}
        <ChevronDown size={13} className="shrink-0 text-ink-muted" strokeWidth={2.5} />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={8}
          className="menu-surface z-[70] w-[260px]"
        >
          <DropdownMenu.Label className="px-2.5 py-1.5 text-[9.5px] font-bold tracking-[0.08em] text-ink-muted uppercase">
            Brokerage accounts
          </DropdownMenu.Label>
          <BrokerageMenuItem
            active={value === 'all'}
            label="All brokerages"
            detail={`${total} open positions`}
            icon={
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-brand-500/12 text-brand-300">
                <Layers3 size={13} />
              </span>
            }
            onSelect={() => setValue('all')}
          />
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          {present.map((brokerage) => (
            <BrokerageMenuItem
              key={brokerage.id}
              active={value === brokerage.id}
              label={brokerage.short}
              detail={`${brokerage.accountMask} · ${counts[brokerage.id] ?? 0} positions`}
              icon={<BrokerageLogo id={brokerage.id} size="md" />}
              onSelect={() => setValue(brokerage.id as BrokerageId)}
            />
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

function BrokerageMenuItem({
  active,
  label,
  detail,
  icon,
  onSelect,
}: {
  active: boolean
  label: string
  detail: string
  icon: React.ReactNode
  onSelect: () => void
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      data-active={active}
      className="menu-item"
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-bold text-ink">{label}</span>
        <span className="block truncate text-[10.5px] text-ink-muted">{detail}</span>
      </span>
      {active ? <Check size={14} className="shrink-0 text-brand-300" strokeWidth={2.7} /> : null}
    </DropdownMenu.Item>
  )
}
