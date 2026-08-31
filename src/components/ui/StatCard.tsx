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
    <Card className={cn('flex items-center gap-4', className)}>
      <div
        className={cn(
          'flex h-13 w-13 shrink-0 items-center justify-center rounded-[--radius-md]',
          toneClasses[tone],
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink-500">{label}</p>
        <p className="font-display text-2xl font-semibold leading-tight text-ink-900">{value}</p>
        {trend && <p className="mt-0.5 text-xs font-medium text-sage-600">{trend}</p>}
      </div>
    </Card>
  )
}
