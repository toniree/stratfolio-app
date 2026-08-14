import { useEffect, useState } from 'react'
import { BotMessageSquare, Check } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useUiStore } from '@/store/uiStore'

type ConfirmationState = 'enabled' | 'disabled' | null

/** Small real on/off control for the mobile Positions carousel header. */
export function CompactAITradingToggle() {
  const enabled = useUiStore((state) => state.aiTradingEnabled)
  const setEnabled = useUiStore((state) => state.setAiTradingEnabled)
  const [confirmation, setConfirmation] = useState<ConfirmationState>(null)

  const toggle = () => {
    const next = !enabled
    setEnabled(next)
    setConfirmation(next ? 'enabled' : 'disabled')
  }

  return (
    <div className="absolute top-[1.5mm] left-[calc(50%+17mm)] z-10 inline-flex -translate-x-1/2">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={`AI Trading ${enabled ? 'on' : 'off'}`}
        onClick={toggle}
        className="inline-flex h-7 shrink-0 items-center gap-1.5 bg-transparent px-0.5 text-[8.5px] font-extrabold tracking-[-0.02em] text-ink transition-opacity hover:opacity-90"
      >
        <span className={enabled ? 'text-white' : 'text-[#8793a2]'}>AI trading</span>
        <span
          className={cn(
            'relative h-3.5 w-7 overflow-hidden rounded-full transition-colors',
            enabled
              ? 'bg-emerald-300/30 shadow-[0_0_5px_rgba(47,255,163,0.2)]'
              : 'bg-line-strong',
          )}
          aria-hidden
        >
          <span
            className={cn(
              'absolute top-0.5 h-2.5 w-2.5 rounded-full transition-[left,background-color,box-shadow] duration-200',
              enabled
                ? 'left-0.5 bg-[#42dda0] shadow-[0_0_5px_rgba(47,255,163,0.5)]'
                : 'left-4 bg-white shadow-sm',
            )}
          />
        </span>
      </button>
      <AITradingConfirmation state={confirmation} onClose={() => setConfirmation(null)} />
    </div>
  )
}

/** Shared full-size control used in desktop navigation, Profile, and mobile More. */
export function AITradingControl({
  variant = 'rail',
  onChrome = false,
}: {
  variant?: 'rail' | 'row'
  onChrome?: boolean
}) {
  const enabled = useUiStore((state) => state.aiTradingEnabled)
  const setEnabled = useUiStore((state) => state.setAiTradingEnabled)
  const [confirmation, setConfirmation] = useState<ConfirmationState>(null)

  const toggle = () => {
    const next = !enabled
    setEnabled(next)
    setConfirmation(next ? 'enabled' : 'disabled')
  }

  return (
    <div className="relative w-full">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={`AI Trading ${enabled ? 'on' : 'off'}`}
        onClick={toggle}
        className={cn(
          'group w-full text-left transition-[background-color,border-color,transform] active:scale-[0.99]',
          variant === 'rail' ? 'rounded-[14px] p-2.5' : 'rounded-2xl p-3',
          onChrome
            ? 'border border-white/20 bg-white/12 hover:bg-white/18'
            : 'border border-line bg-surface hover:border-brand-400/30 hover:bg-white/[0.045]',
          variant === 'row' && 'rounded-xl',
        )}
      >
        <div className={cn('flex gap-2.5', variant === 'rail' ? 'items-center' : 'items-start')}>
          <span
            className={cn(
              'grid shrink-0 place-items-center rounded-lg transition-[background-color,box-shadow]',
              variant === 'rail' ? 'h-7 w-7' : 'h-8 w-8',
              enabled
                ? 'bg-emerald-300/18 text-emerald-200 shadow-[0_0_14px_-8px_rgba(47,255,163,0.8)]'
                : onChrome
                  ? 'bg-white/18 text-white/75'
                  : 'bg-white/[0.055] text-ink-muted',
            )}
            aria-hidden
          >
            <BotMessageSquare size={variant === 'rail' ? 14 : 16} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  'leading-none font-bold whitespace-nowrap',
                  variant === 'rail' ? 'text-[12.5px]' : 'text-[13.5px]',
                  onChrome ? 'text-white' : 'text-ink',
                )}
              >
                AI Trading
              </span>
              <span
                className={cn(
                  'rounded-full py-px font-bold tracking-[0.05em] whitespace-nowrap uppercase',
                  variant === 'rail' ? 'px-1 text-[7.5px]' : 'px-1.5 text-[8.5px]',
                  enabled
                    ? 'bg-emerald-300/16 text-emerald-200'
                    : onChrome
                      ? 'bg-white/12 text-white/65'
                      : 'bg-white/[0.055] text-ink-muted',
                )}
              >
                {enabled ? 'All plans' : 'Your plans'}
              </span>
            </div>
            {variant === 'row' ? (
              <p
                className={cn(
                  'mt-1 text-[10.5px] leading-snug',
                  onChrome ? 'text-white/70' : 'text-ink-muted',
                )}
              >
                {enabled
                  ? 'AI and user plans execute automatically at their triggers.'
                  : 'Only plans you created by hand or explicitly approved will execute automatically.'}
              </p>
            ) : null}
          </div>

          <span
            className={cn(
              'relative shrink-0 overflow-hidden rounded-full border transition-[background-color,border-color,box-shadow]',
              variant === 'rail' ? 'h-4 w-7' : 'mt-0.5 h-5 w-9',
              enabled
                ? 'border-emerald-300/55 bg-emerald-300/30 shadow-[0_0_12px_-5px_rgba(47,255,163,0.9)]'
                : 'border-line-strong bg-white/[0.08]',
            )}
            aria-hidden
          >
            <span
              className={cn(
                'absolute top-0.5 rounded-full bg-white shadow-sm transition-[left] duration-200',
                variant === 'rail' ? 'h-3 w-3' : 'h-4 w-4',
                enabled
                  ? variant === 'rail' ? 'left-[13px]' : 'left-[17px]'
                  : 'left-0.5',
              )}
            />
          </span>
        </div>
      </button>

      <AITradingConfirmation state={confirmation} onClose={() => setConfirmation(null)} />
    </div>
  )
}

function AITradingConfirmation({
  state,
  onClose,
}: {
  state: ConfirmationState
  onClose: () => void
}) {
  const enabled = state === 'enabled'

  useEffect(() => {
    if (state === null) return
    const timeout = window.setTimeout(onClose, 3000)
    return () => window.clearTimeout(timeout)
  }, [state, onClose])

  if (state === null) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="ai-trading-bubble absolute top-[calc(100%+8px)] right-0 z-40 w-[220px] rounded-[15px] border border-white/10 bg-[#111925]/92 px-3 py-2.5 shadow-[0_14px_34px_-18px_rgba(0,0,0,0.95)] backdrop-blur-xl"
    >
      <span
        className="absolute -top-1.5 right-5 h-3 w-3 rotate-45 border-t border-l border-white/10 bg-[#111925]"
        aria-hidden
      />
      <div className="relative flex items-start gap-2.5">
        <span
          className={cn(
            'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg border',
            enabled
              ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200'
              : 'border-white/10 bg-white/[0.04] text-ink-muted',
          )}
          aria-hidden
        >
          {enabled ? <Check size={12} strokeWidth={3} /> : <BotMessageSquare size={12} />}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold text-ink">
            AI Trading {enabled ? 'on' : 'off'}
          </p>
          <p className="mt-0.5 text-[9.5px] leading-snug text-ink-muted">
            {enabled
              ? 'All active plans can execute automatically.'
              : 'Only plans you created by hand or approved will execute automatically.'}
          </p>
        </div>
      </div>
    </div>
  )
}
