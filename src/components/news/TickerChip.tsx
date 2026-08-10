import { cn } from '@/lib/cn'
import { formatSignedPercent } from '@/lib/format'
import { usePrice } from '@/store/priceStore'
import { Sparkline } from '@/components/charts/Sparkline'
import { SymbolIcon } from '@/components/shared/SymbolIcon'

/** Tiny inline ticker with its live move — used on news cards and in the toast. */
export function TickerChip({
  symbol,
  showSparkline = false,
  className,
  size = 'md',
}: {
  symbol: string
  showSparkline?: boolean
  className?: string
  size?: 'xs' | 'md'
}) {
  const snap = usePrice(symbol)
  const pct = snap?.dayChangePct ?? 0
  const up = pct >= 0

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.035] shadow-[inset_0_1px_rgba(255,255,255,0.045)]',
        size === 'xs' ? 'px-1.5 py-0.5' : 'px-2 py-1',
        className,
      )}
    >
      <SymbolIcon symbol={symbol} size="xs" />
      <span
        className={cn(
          'num font-bold text-ink',
          size === 'xs' ? 'text-[10.5px]' : 'text-[12px]',
        )}
      >
        {symbol}
      </span>
      {showSparkline ? (
        <Sparkline
          data={snap?.history ?? []}
          tone={up ? 'up' : 'down'}
          width={size === 'xs' ? 22 : 32}
          height={size === 'xs' ? 10 : 14}
          filled={false}
        />
      ) : null}
      <span
        className={cn(
          'num font-bold',
          up ? 'text-up' : 'text-down',
          size === 'xs' ? 'text-[10.5px]' : 'text-[11.5px]',
        )}
      >
        {up ? '▲' : '▼'} {formatSignedPercent(pct, 2).replace(/^[+−]/, '')}
      </span>
    </span>
  )
}
