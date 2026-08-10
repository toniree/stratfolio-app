import { LogoMark } from '@/components/brand/Logo'
import { cn } from '@/lib/cn'

/** StratFolio's knight with the monocle used by conversational surfaces. */
export function AssistantAvatar({
  size = 30,
  className,
  notify = false,
}: {
  size?: number
  className?: string
  /** Glowing dot on the knight's ear: a reply arrived while minimised. */
  notify?: boolean
}) {
  return (
    <span
      className={cn(
        'relative grid shrink-0 place-items-center rounded-xl bg-brand-100',
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <LogoMark size={Math.max(18, size - 5)} />
      <svg viewBox="0 0 28 28" className="pointer-events-none absolute inset-0 h-full w-full">
        {/* On the smaller mobile mark, the monocle sits higher at eye level so
            its handle clears the knight's muzzle. */}
        <g className="sm:hidden">
          <circle
            cx="10.5"
            cy="8.25"
            r="3.2"
            fill="rgba(18,23,31,0.2)"
            stroke="#5ba6ff"
            strokeWidth="1.4"
          />
          <path d="M12.8 10.6 15.4 16" stroke="#5ba6ff" strokeWidth="1.2" strokeLinecap="round" />
        </g>
        <g className="hidden sm:block">
          <circle
            cx="8.5"
            cy="10.5"
            r="3.4"
            fill="rgba(18,23,31,0.2)"
            stroke="#5ba6ff"
            strokeWidth="1.4"
          />
          <path d="M11 13.2 14.2 19.7" stroke="#5ba6ff" strokeWidth="1.2" strokeLinecap="round" />
        </g>
      </svg>
      {notify ? (
        <span
          className="notify-ear absolute top-[6%] right-[18%] h-[22%] w-[22%] rounded-full bg-[#ff4d5e]"
          aria-hidden
        />
      ) : null}
    </span>
  )
}
