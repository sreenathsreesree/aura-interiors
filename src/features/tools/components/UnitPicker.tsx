import { cn } from '@/lib/cn'
import { UNIT_LABELS, type CanvasUnit } from '@/lib/units'

const UNIT_ORDER: CanvasUnit[] = ['mm', 'cm', 'm', 'in', 'ft', 'ftin']

interface UnitPickerProps {
  unit: CanvasUnit
  onChange: (unit: CanvasUnit) => void
  className?: string
}

// A calculator-wide unit setting — one chip row, matching the app's
// existing chip-picker pattern (PricingConfigSheet's discount type,
// EditProjectSheet's status/type) rather than Canvas's own toolbar-anchored
// popover, which assumes a Canvas-chrome anchor button this feature doesn't
// have. Reuses lib/units.ts's UNIT_LABELS — the labels themselves aren't
// reinvented here.
export function UnitPicker({ unit, onChange, className }: UnitPickerProps) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {UNIT_ORDER.map((u) => (
        <button
          key={u}
          type="button"
          onClick={() => onChange(u)}
          className={cn(
            'h-10 rounded-full border-2 px-4 text-sm font-semibold transition-colors',
            unit === u
              ? 'border-ink-900 bg-ink-900 text-sand-50'
              : 'border-ink-100 bg-white text-ink-600 hover:border-ink-300',
          )}
        >
          {UNIT_LABELS[u]}
        </button>
      ))}
    </div>
  )
}
