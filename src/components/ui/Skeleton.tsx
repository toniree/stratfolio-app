import { cn } from '@/lib/cn'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg bg-surface-sunken',
        'after:absolute after:inset-0 after:-translate-x-full after:bg-gradient-to-r after:from-transparent after:via-white/70 after:to-transparent after:content-[""]',
        'after:animate-[sf-shimmer_1.6s_infinite]',
        className,
      )}
    />
  )
}
