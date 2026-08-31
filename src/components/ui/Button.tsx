import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger'
type Size = 'md' | 'lg' | 'xl'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  iconPosition?: 'left' | 'right'
  fullWidth?: boolean
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-ink-900 text-sand-50 hover:bg-ink-800 active:bg-ink-950 shadow-soft',
  secondary:
    'bg-brass-500 text-sand-50 hover:bg-brass-600 active:bg-brass-700 shadow-soft',
  outline:
    'bg-transparent text-ink-900 border-2 border-ink-200 hover:border-ink-400 hover:bg-sand-100',
  ghost: 'bg-transparent text-ink-700 hover:bg-sand-200 active:bg-sand-300',
  danger: 'bg-danger-500 text-sand-50 hover:bg-red-700 active:bg-red-800',
}

const sizeClasses: Record<Size, string> = {
  md: 'h-11 px-4 text-sm gap-2 rounded-[--radius-md]',
  lg: 'h-13 px-5 text-base gap-2.5 rounded-[--radius-md]',
  xl: 'h-15 px-6 text-base gap-3 rounded-[--radius-lg]',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'lg',
      icon,
      iconPosition = 'left',
      fullWidth,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex select-none items-center justify-center whitespace-nowrap font-semibold tracking-tight transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98]',
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && 'w-full',
          className,
        )}
        {...props}
      >
        {icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>}
        {children}
        {icon && iconPosition === 'right' && <span className="shrink-0">{icon}</span>}
      </button>
    )
  },
)
Button.displayName = 'Button'
