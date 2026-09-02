import { useState, type RefObject } from 'react'
import type { CanvasUnit } from '@/types/canvas'
import { AnchoredPopover } from './AnchoredPopover'
import { LengthField } from './LengthField'

interface OffsetPopupProps {
  anchorRef: RefObject<HTMLElement | null>
  unit: CanvasUnit
  onOffset: (distanceMm: number) => void
  onClose: () => void
}

/**
 * V3C Offset — a compact popup, not a CAD dialog: one distance field (in the
 * project's current unit) and a button. Negative values shrink inward.
 */
export function OffsetPopup({ anchorRef, unit, onOffset, onClose }: OffsetPopupProps) {
  const [distanceMm, setDistanceMm] = useState(50)

  function handleOffset() {
    if (distanceMm === 0) return
    onOffset(distanceMm)
    onClose()
  }

  return (
    <AnchoredPopover anchorRef={anchorRef} side="left" onClose={onClose}>
      <div className="flex w-52 flex-col gap-3">
        <p className="font-display text-sm font-semibold text-ink-900">Offset</p>
        <LengthField label="Distance" unit={unit} valueMm={distanceMm} onChangeMm={setDistanceMm} />
        <p className="text-xs text-ink-400">Negative shrinks inward.</p>
        <button onClick={handleOffset} className="h-11 rounded-md bg-ink-900 text-sm font-semibold text-sand-50 transition-transform active:scale-95">
          Create Offset
        </button>
      </div>
    </AnchoredPopover>
  )
}
