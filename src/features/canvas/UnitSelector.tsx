import { type RefObject } from 'react'
import { cn } from '@/lib/cn'
import type { CanvasUnit } from '@/types/canvas'
import { UNIT_LABELS } from '@/lib/units'
import { AnchoredPopover } from './AnchoredPopover'

const UNIT_ORDER: CanvasUnit[] = ['mm', 'cm', 'm', 'in', 'ft', 'ftin']

/**
 * V3C project-level measurement unit setting — a small popover of direct
 * choices rather than a settings page, per "do not create a large settings
 * system." Switching units only changes how lengths are displayed/typed
 * (see lib/units.ts); it never touches stored geometry.
 */
export function UnitSelectorPopover({ anchorRef, activeUnit, onSelect, onClose, side = 'right' }: { anchorRef: RefObject<HTMLElement | null>; activeUnit: CanvasUnit; onSelect: (u: CanvasUnit) => void; onClose: () => void; side?: 'left' | 'right' }) {
  return (
    <AnchoredPopover anchorRef={anchorRef} onClose={onClose} side={side}>
      <div className="flex w-44 flex-col gap-1">
        <p className="mb-1 font-display text-sm font-semibold text-ink-900">Measurement Unit</p>
        {UNIT_ORDER.map((u) => (
          <button
            key={u}
            onClick={() => {
              onSelect(u)
              onClose()
            }}
            className={cn(
              'flex h-10 items-center justify-between rounded-md px-3 text-sm font-semibold',
              u === activeUnit ? 'bg-ink-900 text-sand-50' : 'text-ink-600 hover:bg-sand-50',
            )}
          >
            {UNIT_LABELS[u]}
          </button>
        ))}
      </div>
    </AnchoredPopover>
  )
}
