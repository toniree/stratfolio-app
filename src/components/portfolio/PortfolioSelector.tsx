import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check, ChevronDown, Plus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useAccounts } from '@/hooks/queries'
import { useUiStore } from '@/store/uiStore'

/**
 * Which portfolio you are looking at. Entirely separate from the brokerage
 * filter — one picks the book, the other filters the holdings inside it.
 *
 * Both the trigger and the menu are chrome, so both run on the tinted
 * gradient glass with light-on-dark type.
 */
export function PortfolioSelector({ compact = false }: { compact?: boolean }) {
  const accountId = useUiStore((s) => s.accountId)
  const setAccountId = useUiStore((s) => s.setAccountId)
  const { data: accounts } = useAccounts()

  const current = accounts?.find((a) => a.id === accountId)

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={cn(
          'group inline-flex min-w-0 items-center rounded-full font-bold text-ink transition-colors hover:bg-white/[0.07]',
          compact ? 'gap-1 px-1.5 py-1 text-[11px]' : 'gap-1.5 px-2.5 py-1.5 text-[14px]',
        )}
      >
        <span className="truncate">{current?.name ?? 'Portfolio'}</span>
        <ChevronDown size={compact ? 12 : 15} className="shrink-0 text-ink-muted" />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={8}
          className="menu-surface z-50 w-[268px]"
        >
          <DropdownMenu.Label className="px-2.5 py-1.5 text-[10.5px] font-bold tracking-[0.08em] text-ink-muted uppercase">
            Portfolios
          </DropdownMenu.Label>
          {(accounts ?? []).map((account) => (
            <DropdownMenu.Item
              key={account.id}
              onSelect={() => setAccountId(account.id)}
              className="menu-item"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold text-ink">
                  {account.name}
                </span>
                <span className="block truncate text-[11.5px] text-ink-muted">
                  {account.subtitle}
                </span>
              </span>
              {account.id === accountId ? (
                <Check size={16} className="shrink-0 text-brand-300" />
              ) : null}
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="my-1.5 h-px bg-line" />
          <DropdownMenu.Item
            disabled
            className="menu-item"
          >
            <Plus size={15} />
            Add brokerage account
            <span className="ml-auto text-[10px] font-bold tracking-[0.04em] uppercase">Soon</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
