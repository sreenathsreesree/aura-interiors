import { Calculator } from 'lucide-react'
import { Sheet } from '@/components/ui'
import { getCalculatorDefinition } from '@/features/tools/registry'
import { getCompatibleCalculatorIds, type CanvasMeasurement } from '@/lib/canvasCalculatorAdapter'
import type { CalculatorId } from '@/features/tools/types'

interface UseInCalculatorSheetProps {
  open: boolean
  measurement: CanvasMeasurement | null
  onClose: () => void
  onChoose: (calculatorId: CalculatorId) => void
}

// AURA CANVAS -> CALCULATOR INTEGRATION — the compact picker shown after
// "Use in Calculator" is chosen on a selected object. `Sheet` is already
// responsive (bottom sheet on iPhone, centered dialog on tablet/desktop),
// so this one component serves both PropertyPanel (desktop) and
// MobilePropertySheet (iPhone/iPad) without any separate mobile variant.
export function UseInCalculatorSheet({ open, measurement, onClose, onChoose }: UseInCalculatorSheetProps) {
  const compatibleIds = measurement ? getCompatibleCalculatorIds(measurement) : []

  return (
    <Sheet open={open} onClose={onClose} title="Use in Calculator" subtitle="Send this measurement to a calculator, prefilled.">
      <div className="flex flex-col gap-2.5">
        {compatibleIds.map((id) => {
          const def = getCalculatorDefinition(id)
          if (!def) return null
          return (
            <button
              key={id}
              onClick={() => onChoose(id)}
              className="flex items-center gap-3.5 rounded-[--radius-md] border-2 border-ink-100 px-4 py-3.5 text-left transition-colors hover:border-brass-400"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[--radius-md] bg-brass-500/12 text-brass-600">
                <Calculator className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-900">{def.label}</p>
                <p className="truncate text-xs text-ink-500">{def.description}</p>
              </div>
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}
