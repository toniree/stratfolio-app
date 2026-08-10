import { forwardRef } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-[background-color,color,border-color,transform,box-shadow] duration-150 active:scale-[0.985] disabled:pointer-events-none disabled:opacity-55 select-none',
  {
    variants: {
      // Tinted glass with an inset highlight, matching the hand-built action
      // buttons on the plan sheet and close ticket. Those had drifted well
      // ahead of this component, so modal footers looked flat beside them.
      variant: {
        primary:
          'border border-brand-300/30 bg-[linear-gradient(135deg,#2f7bff,#5ba6ff)] text-white shadow-[inset_0_1px_rgba(255,255,255,0.18),0_10px_26px_-14px_rgba(47,123,255,0.9)] hover:brightness-110',
        secondary:
          'border border-white/[0.16] bg-white/[0.09] text-white/85 shadow-[inset_0_1px_rgba(255,255,255,0.1)] hover:bg-white/[0.14] hover:text-white',
        ghost: 'text-ink-soft hover:bg-white/[0.06] hover:text-ink',
        ai: 'ai-gradient text-white shadow-[0_6px_18px_-8px_rgba(47,123,255,0.75)] hover:brightness-[1.06]',
        success:
          'border border-emerald-300/25 bg-emerald-400/85 text-[#071a12] shadow-[inset_0_1px_rgba(255,255,255,0.2)] hover:bg-emerald-300',
        danger:
          'border border-red-300/25 bg-red-400/85 text-[#2a0709] shadow-[inset_0_1px_rgba(255,255,255,0.2)] hover:bg-red-300',
        outlineDanger:
          'border border-red-300/25 bg-red-400/[0.12] text-red-200 hover:bg-red-400/[0.2] hover:text-red-100',
      },
      size: {
        sm: 'h-8 px-3 text-[13px]',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-[15px]',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild, ...props },
  ref,
) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
})

export { buttonVariants }
