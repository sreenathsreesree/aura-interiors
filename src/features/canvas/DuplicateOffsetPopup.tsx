import { useState, type RefObject } from 'react'
import { NumberStepper } from '@/components/ui'
import type { CanvasUnit } from '@/types/canvas'
import { AnchoredPopover } from './AnchoredPopover'
import { LengthField } from './LengthField'

interface DuplicateOffsetPopupProps {
  anchorRef: RefObject<HTMLElement | null>
  unit: CanvasUnit
  onDuplicate: (dxMm: number, dyMm: number, count: number) => void
  onClose: () => void
}

/**
 * V3B exact-distance duplication — a compact contextual popup (not a
 * dialog), per the spec: "Select cabinet. Duplicate: Horizontal offset 600mm,
 * Vertical offset 0mm. Repeat: 5." Builds `count` evenly spaced copies in
 * real-world Canvas coordinates.
 */
export function DuplicateOffsetPopup({ anchorRef, unit, onDuplicate, onClose }: DuplicateOffsetPopupProps) {
  const [dx, setDx] = useState(600)
  const [dy, setDy] = useState(0)
  const [count, setCount] = useState(1)

  function handleDuplicate() {
    onDuplicate(dx, dy, Math.max(1, Math.round(count)))
    onClose()
  }

  return (
    <AnchoredPopover anchorRef={anchorRef} side="left" onClose={onClose}>
      <div className="flex w-60 flex-col gap-3">
        <p className="font-display text-sm font-semibold text-ink-900">Duplicate with Offset</p>
        <div className="grid grid-cols-2 gap-2.5">
          <LengthField label="Horizontal" unit={unit} valueMm={dx} onChangeMm={setDx} />
          <LengthField label="Vertical" unit={unit} valueMm={dy} onChangeMm={setDy} />
        </div>
        <NumberStepper label="Repeat" value={count} onChange={(v) => setCount(Math.max(1, Math.round(v)))} step={1} min={1} max={50} />
        <button onClick={handleDuplicate} className="h-11 rounded-md bg-ink-900 text-sm font-semibold text-sand-50 transition-transform active:scale-95">
          Duplicate
        </button>
      </div>
    </AnchoredPopover>
  )
}
