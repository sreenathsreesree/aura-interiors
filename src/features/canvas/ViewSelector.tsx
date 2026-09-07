import { type RefObject } from 'react'
import { cn } from '@/lib/cn'
import type { CanvasElevationInfo } from '@/types/canvas'
import { AnchoredPopover } from './AnchoredPopover'

/**
 * AURA CANVAS V3D — wall picker for Elevation mode. Compact popover of
 * direct choices (per the spec's own "[ Wall 1 ] [ Wall 2 ] [ Wall 3 ]
 * [ Wall 4 ]" example), not a complex navigation system.
 */
export function WallSelectorPopover({
  anchorRef,
  walls,
  activeWallIndex,
  onSelect,
  onClose,
  side = 'right',
}: {
  anchorRef: RefObject<HTMLElement | null>
  walls: CanvasElevationInfo[]
  activeWallIndex: number | null
  onSelect: (wallIndex: number) => void
  onClose: () => void
  side?: 'left' | 'right'
}) {
  return (
    <AnchoredPopover anchorRef={anchorRef} onClose={onClose} side={side}>
      <div className="flex w-48 flex-col gap-1">
        <p className="mb-1 font-display text-sm font-semibold text-ink-900">Select Wall</p>
        {walls.map((w) => (
          <button
            key={w.wallIndex}
            onClick={() => {
              onSelect(w.wallIndex)
              onClose()
            }}
            className={cn(
              'flex h-11 items-center justify-between rounded-md px-3 text-sm font-semibold',
              w.wallIndex === activeWallIndex ? 'bg-ink-900 text-sand-50' : 'text-ink-600 hover:bg-sand-50',
            )}
          >
            {w.wallLabel}
          </button>
        ))}
      </div>
    </AnchoredPopover>
  )
}
