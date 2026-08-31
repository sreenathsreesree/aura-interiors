import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
}

export function Card({
  interactive,
  padding = 'md',
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-[--radius-lg] border border-ink-100 bg-white shadow-[--shadow-soft]',
        paddingClasses[padding],
        interactive &&
          'cursor-pointer transition-all duration-150 hover:shadow-[--shadow-card] active:scale-[0.99]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
