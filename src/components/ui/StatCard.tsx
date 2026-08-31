import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Card } from './Card'

interface StatCardProps {
  label: string
  value: string
  icon: ReactNode
  trend?: string
  tone?: 'brass' | 'sage' | 'terracotta' | 'ink'
  className?: string
}

const toneClasses = {
  brass: 'bg-brass-500/12 text-brass-600',
  sage: 'bg-sage-500/15 text-sage-600',
  terracotta: 'bg-terracotta-500/12 text-terracotta-600',
  ink: 'bg-ink-900/8 text-ink-700',
}

export function StatCard({ label, value, icon, trend, tone = 'ink', className }: StatCardProps) {
  return (
    <Card padding="sm" className={cn('flex items-center gap-3', className)}>
      <div
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-[--radius-md] [&>svg]:h-5 [&>svg]:w-5',
          toneClasses[tone],
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-ink-500 sm:text-sm">{label}</p>
        <p className="whitespace-nowrap font-display text-xl font-semibold leading-tight text-ink-900">
          {value}
        </p>
        {trend && <p className="mt-0.5 text-xs font-medium text-sage-600">{trend}</p>}
      </div>
    </Card>
  )
}
