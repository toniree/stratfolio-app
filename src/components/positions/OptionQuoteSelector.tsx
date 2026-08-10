import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  usePositionTilePreferences,
  type OptionQuoteType,
} from '@/store/positionTilePreferences'

const QUOTES: { id: OptionQuoteType; label: string }[] = [
  { id: 'mark', label: 'Mark' },
  { id: 'bid', label: 'Bid' },
  { id: 'ask', label: 'Ask' },
  { id: 'last', label: 'Last' },
]

/** `xs` is the in-table variant, sized to sit on a stat's sub-line. */
export function OptionQuoteSelector({ size = 'sm' }: { size?: 'sm' | 'xs' }) {
  const quoteType = usePositionTilePreferences((state) => state.quoteType)
  const setQuoteType = usePositionTilePreferences((state) => state.setQuoteType)
  const label = QUOTES.find((quote) => quote.id === quoteType)?.label ?? 'Mark'
  const xs = size === 'xs'

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={`Option quote: ${label}`}
          onClick={(event) => event.stopPropagation()}
          className={cn(
            'inline-flex shrink-0 items-center rounded-full leading-none font-bold tracking-[0.06em] text-ink-muted uppercase transition-colors hover:bg-white/[0.06] hover:text-ink-soft',
            xs ? 'h-4 gap-px text-[6.5px]' : 'h-5 gap-0.5 pl-1 text-[7px]',
          )}
        >
          {label}
          {xs ? null : ':'}
          <span
            className={cn(
              'grid place-items-center rounded-full border border-white/10 bg-white/[0.045] text-ink-soft shadow-[inset_0_1px_rgba(255,255,255,0.06)]',
              xs ? 'h-3 w-3' : 'h-4 w-4',
            )}
          >
            <ChevronDown size={xs ? 8 : 10} strokeWidth={2.5} />
          </span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={5}
          onClick={(event) => event.stopPropagation()}
          className="menu-surface z-[70] min-w-[116px]"
        >
          {QUOTES.map((quote) => (
            <DropdownMenu.Item
              key={quote.id}
              onSelect={() => setQuoteType(quote.id)}
              data-active={quote.id === quoteType}
              className="menu-item justify-between"
            >
              {quote.label}
              {quote.id === quoteType ? <Check size={12} strokeWidth={2.7} /> : null}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

/** Deterministic demo quote book centred on the option mark. */
export function optionQuoteValue(
  type: OptionQuoteType,
  mark: number,
  previousClose: number,
): number {
  const halfSpread = Math.max(0.01, Math.min(0.18, mark * 0.0075))
  if (type === 'bid') return Math.max(0.01, mark - halfSpread)
  if (type === 'ask') return mark + halfSpread
  if (type === 'last') return Math.max(0.01, mark - (mark - previousClose) * 0.08)
  return mark
}
