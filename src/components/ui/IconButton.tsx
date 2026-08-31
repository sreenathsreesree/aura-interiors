import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'default' | 'filled' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  label: string
}

const variantClasses: Record<Variant, string> = {
  default: 'bg-white border-2 border-ink-100 text-ink-700 hover:border-ink-300',
  filled: 'bg-ink-900 text-sand-50 hover:bg-ink-800',
  ghost: 'bg-transparent text-ink-600 hover:bg-sand-200',
  danger: 'bg-danger-500/10 text-danger-500 hover:bg-danger-500/20',
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-9 w-9 rounded-[--radius-md]',
  md: 'h-11 w-11 rounded-[--radius-md]',
  lg: 'h-13 w-13 rounded-[--radius-lg]',
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ variant = 'default', size = 'md', label, className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        aria-label={label}
        title={label}
        className={cn(
          'inline-flex shrink-0 items-center justify-center transition-colors duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40',
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {children}
      </button>
    )
  },
)
IconButton.displayName = 'IconButton'
