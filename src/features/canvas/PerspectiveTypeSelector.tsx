import { type RefObject } from 'react'
import { cn } from '@/lib/cn'
import type { PerspectiveType } from '@/types/canvas'
import { AnchoredPopover } from './AnchoredPopover'

export const PERSPECTIVE_TYPE_LABEL: Record<PerspectiveType, string> = {
  '1-point': '1 Point',
  '2-point': '2 Point',
  '3-point': '3 Point',
}

const PERSPECTIVE_TYPE_ORDER: PerspectiveType[] = ['1-point', '2-point', '3-point']

/** FINAL PERSPECTIVE INTEGRATION — the compact side menu the spec asks for ("Perspective • 1 Point • 2 Point • 3 Point"). Switching type never discards an existing vp2/vp3 (see CanvasEngine.setPerspectiveType) — it only changes which ones are drawn/used for snapping. */
export function PerspectiveTypeSelector({
  anchorRef,
  activeType,
  onSelect,
  onClose,
  side = 'right',
}: {
  anchorRef: RefObject<HTMLElement | null>
  activeType: PerspectiveType
  onSelect: (type: PerspectiveType) => void
  onClose: () => void
  side?: 'left' | 'right'
}) {
  return (
    <AnchoredPopover anchorRef={anchorRef} onClose={onClose} side={side}>
      <div className="flex w-44 flex-col gap-1">
        <p className="mb-1 font-display text-sm font-semibold text-ink-900">Perspective</p>
        {PERSPECTIVE_TYPE_ORDER.map((t) => (
          <button
            key={t}
            onClick={() => {
              onSelect(t)
              onClose()
            }}
            className={cn(
              'flex h-11 items-center justify-between rounded-md px-3 text-sm font-semibold',
              t === activeType ? 'bg-ink-900 text-sand-50' : 'text-ink-600 hover:bg-sand-50',
            )}
          >
            {PERSPECTIVE_TYPE_LABEL[t]}
          </button>
        ))}
      </div>
    </AnchoredPopover>
  )
}
