import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface ResultRowProps {
  label: string
  value: ReactNode
  hint?: string
  /** The one number a designer actually needs — larger, brass-colored, sits apart from the working figures above it. */
  emphasis?: boolean
  className?: string
}

// One line of a calculator's result section — label left, value right. The
// worked examples in the spec ("Wall Area / 12.60 m²") are exactly this
// shape stacked, so the result section is just a list of these.
export function ResultRow({ label, value, hint, emphasis, className }: ResultRowProps) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 py-2.5', className)}>
      <div className="min-w-0">
        <p className={cn('text-sm', emphasis ? 'font-semibold text-ink-800' : 'text-ink-500')}>{label}</p>
        {hint && <p className="mt-0.5 text-xs text-ink-400">{hint}</p>}
      </div>
      <p
        className={cn(
          'shrink-0 text-right font-display tabular-nums',
          emphasis ? 'text-2xl font-semibold text-brass-700' : 'text-base font-semibold text-ink-900',
        )}
      >
        {value}
      </p>
    </div>
  )
}
