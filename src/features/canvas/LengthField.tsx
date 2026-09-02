import { useState } from 'react'
import { NumberStepper } from '@/components/ui'
import type { CanvasUnit } from '@/types/canvas'
import { defaultStepMm, formatLength, LengthParseError, mmToEditableNumber, parseLength } from '@/lib/units'

interface LengthFieldProps {
  label: string
  valueMm: number
  unit: CanvasUnit
  onChangeMm: (mm: number) => void
  className?: string
  /** Only used for the plain-number units (mm/cm/m/in/ft) — ft+in always steps by a fixed practical increment. */
  stepMm?: number
  min?: number
}

/**
 * Unit-aware length input — the single place every geometry field in Canvas
 * (X/Y/Width/Height/radius/offsets/...) goes through, per V3C's "centralized
 * conversion utility, don't scatter it through components" requirement.
 * Always calls back with millimetres; the displayed/edited number (or, for
 * ft+in, free text) is converted purely at the edges.
 */
export function LengthField({ label, valueMm, unit, onChangeMm, className, stepMm, min = -1_000_000 }: LengthFieldProps) {
  if (unit === 'ftin') {
    return <FeetInchesField label={label} valueMm={valueMm} onChangeMm={onChangeMm} className={className} />
  }
  return (
    <NumberStepper
      label={`${label} (${unit})`}
      value={mmToEditableNumber(valueMm, unit)}
      onChange={(v) => onChangeMm(parseLength(String(v), unit))}
      step={stepMm ? mmToEditableNumber(stepMm, unit) : mmToEditableNumber(defaultStepMm(unit), unit)}
      min={min}
    />
  )
}

/** Free-text ft+in entry — "7' 10\"" style — with inline validation instead of a stepper (there's no single number to step). */
function FeetInchesField({ label, valueMm, onChangeMm, className }: { label: string; valueMm: number; onChangeMm: (mm: number) => void; className?: string }) {
  const [text, setText] = useState(() => formatLength(valueMm, 'ftin'))
  const [error, setError] = useState<string | null>(null)
  const [syncedValueMm, setSyncedValueMm] = useState(valueMm)

  // Keep the field in sync when the value changes from elsewhere (undo, another field) — but not while the designer is actively typing.
  // Adjusted directly during render (React's recommended alternative to an
  // effect for "reset state when a prop changes") rather than via useEffect,
  // so there's no extra render pass between the value changing and the text
  // catching up.
  if (valueMm !== syncedValueMm) {
    setSyncedValueMm(valueMm)
    setText(formatLength(valueMm, 'ftin'))
    setError(null)
  }

  function commit() {
    try {
      const mm = parseLength(text, 'ftin')
      setError(null)
      onChangeMm(mm)
    } catch (e) {
      setError(e instanceof LengthParseError ? e.message : 'Invalid value')
    }
  }

  return (
    <div className={className}>
      <span className="mb-1.5 block text-sm font-semibold text-ink-700">{label} (ft/in)</span>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        placeholder={`7' 10"`}
        className="h-14 w-full rounded-[--radius-md] border-2 border-ink-100 bg-sand-50 px-3 text-center text-lg font-semibold text-ink-900 outline-none focus:border-brass-500"
      />
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  )
}
