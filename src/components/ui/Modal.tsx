import { useEffect, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useUiStore } from '@/store/uiStore'

/** Radix keeps its own document-level listeners, so this only stops React. */
function stopEvent(event: React.SyntheticEvent) {
  event.stopPropagation()
}

interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: string
  /** `center` drops the description and centres the title across the panel. */
  align?: 'left' | 'center'
  children: ReactNode
  footer?: ReactNode
  /** Widens the panel for form-heavy tickets; the treatment is unchanged. */
  size?: 'default' | 'wide'
  className?: string
  showCloseButton?: boolean
}

/**
 * The single modal treatment for the app: a centred panel over a heavily
 * darkened ground, with quiet header/footer chrome so the content carries the
 * page. Registers itself with the UI store while open so ambient behaviour
 * (the demo news toast) can pause rather than fire over a modal.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  align = 'left',
  children,
  footer,
  size = 'default',
  className,
  showCloseButton = true,
}: ModalProps) {
  const pushOverlay = useUiStore((s) => s.pushOverlay)
  const popOverlay = useUiStore((s) => s.popOverlay)

  useEffect(() => {
    if (!open) return
    pushOverlay()
    return () => popOverlay()
  }, [open, pushOverlay, popOverlay])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/*
          Radix portals this into <body>, but React events still propagate up
          the *component* tree — so inside a click-to-navigate card, tapping
          Cancel would also open the card behind the modal. Both layers stop
          click and keyboard events here rather than every caller remembering.
        */}
        <Dialog.Overlay
          onClick={stopEvent}
          className="fixed inset-0 z-50 bg-[#04070d]/78 backdrop-blur-[6px] data-[state=open]:animate-in data-[state=open]:fade-in"
        />
        <Dialog.Content
          onClick={stopEvent}
          onKeyDown={stopEvent}
          className={cn(
            'modal-surface fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100svh-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[24px] focus:outline-none',
            size === 'wide'
              ? 'w-[min(560px,calc(100vw-2rem))]'
              : 'w-[min(520px,calc(100vw-2rem))]',
            className,
          )}
        >
          {/* Header and footer stay transparent against the panel so the
              content, not the chrome, carries the dialog. */}
          <div
            className={cn(
              'relative flex shrink-0 items-start gap-4 border-b border-white/[0.075] px-4 pt-5 pb-3.5 sm:px-5',
              align === 'center' ? 'justify-center' : 'justify-between',
            )}
          >
            <div className={cn('min-w-0', align === 'center' && 'text-center')}>
              <Dialog.Title className="text-[18px] leading-tight font-extrabold tracking-[-0.02em] text-ink">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1.5 max-w-[420px] text-[12.5px] leading-relaxed text-ink-soft">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            {showCloseButton ? (
              <Dialog.Close
                aria-label="Close"
                className={cn(
                  'liquid-control grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-muted transition-[background-color,color,transform] hover:text-ink active:scale-95',
                  // Lifted out of flow so a centred title centres on the panel,
                  // not on the space left over beside the button.
                  align === 'center' ? 'absolute top-4 right-4 sm:right-5' : '-mr-1 -mt-1',
                )}
              >
                <X size={18} />
              </Dialog.Close>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3.5 sm:px-5 sm:py-4">
            {children}
          </div>

          {footer ? (
            <div className="border-t border-white/[0.075] px-3.5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:pb-3">
              {footer}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
