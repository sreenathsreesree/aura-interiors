import type { ReactNode } from 'react'
import { ArrowLeft, RotateCcw } from 'lucide-react'
import { Card, IconButton } from '@/components/ui'

interface CalculatorShellProps {
  title: string
  subtitle?: string
  onBack: () => void
  onReset: () => void
  /** The "Use Room Dimensions" prompt, when opened with room context. */
  roomContext?: ReactNode
  inputs: ReactNode
  results: ReactNode
  /** Add to BOQ / Save Calculation actions. */
  footer?: ReactNode
}

// Shared layout for every calculator: iPhone stacks inputs above a results
// card; iPad landscape and up splits into two columns with a sticky live
// result pane, mirroring how ProjectDetailPage/BoqPage already switch to a
// two-column layout at the `lg` breakpoint elsewhere in this app.
export function CalculatorShell({ title, subtitle, onBack, onReset, roomContext, inputs, results, footer }: CalculatorShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-sand-100">
      <div className="flex items-center gap-2 border-b border-ink-100 bg-white px-5 py-4 sm:px-8">
        <IconButton label="Back" variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </IconButton>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-lg font-semibold text-ink-900">{title}</h1>
          {subtitle && <p className="truncate text-xs text-ink-500">{subtitle}</p>}
        </div>
        <IconButton label="Reset" variant="ghost" onClick={onReset}>
          <RotateCcw className="h-5 w-5" />
        </IconButton>
      </div>

      <div className="flex-1 px-5 py-6 pb-28 sm:px-8 lg:pb-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
          <div className="flex flex-col gap-5">
            {roomContext}
            <Card className="flex flex-col gap-5">{inputs}</Card>
          </div>

          <div className="lg:sticky lg:top-6">
            <Card className="flex flex-col divide-y divide-ink-100">{results}</Card>
            {footer && <div className="mt-4 hidden flex-col gap-2.5 sm:flex-row lg:flex">{footer}</div>}
          </div>
        </div>
      </div>

      {/* iPhone/iPad-portrait: footer actions pin to the bottom instead of trailing the (already-scrolled-past) result card. */}
      {footer && (
        <div className="sticky bottom-0 border-t border-ink-100 bg-white px-5 py-4 sm:px-8 lg:hidden">
          <div className="mx-auto flex max-w-5xl flex-col gap-2.5 sm:flex-row">{footer}</div>
        </div>
      )}
    </div>
  )
}
