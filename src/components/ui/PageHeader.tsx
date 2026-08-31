import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 border-b border-ink-100 bg-sand-100/60 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-7',
        className,
      )}
    >
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink-900 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500 sm:text-base">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
    </div>
  )
}
