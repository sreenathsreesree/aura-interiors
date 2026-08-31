import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Tone = 'brass' | 'sage' | 'terracotta' | 'ink' | 'clay' | 'success' | 'warning' | 'danger' | 'neutral'

const toneClasses: Record<Tone, string> = {
  brass: 'bg-brass-500/12 text-brass-700',
  sage: 'bg-sage-500/15 text-sage-600',
  terracotta: 'bg-terracotta-500/12 text-terracotta-600',
  ink: 'bg-ink-900/8 text-ink-700',
  clay: 'bg-clay-500/12 text-clay-500',
  success: 'bg-success-500/12 text-success-500',
  warning: 'bg-warning-500/14 text-warning-500',
  danger: 'bg-danger-500/12 text-danger-500',
  neutral: 'bg-ink-100 text-ink-600',
}

interface BadgeProps {
  tone?: Tone
  children: ReactNode
  className?: string
  icon?: ReactNode
}

export function Badge({ tone = 'neutral', children, className, icon }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide',
        toneClasses[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}
