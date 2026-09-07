import { type ReactNode, type RefObject } from 'react'
import { HardHat, PencilRuler, Presentation } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { CanvasDrawingMode } from '@/types/canvas'
import { AnchoredPopover } from './AnchoredPopover'

export const MODE_INFO: Record<CanvasDrawingMode, { label: string; icon: ReactNode; hint: string }> = {
  designer: { label: 'Designer', icon: <PencilRuler className="h-4 w-4" />, hint: 'Full editing tools' },
  execution: { label: 'Execution', icon: <HardHat className="h-4 w-4" />, hint: 'Clean drawing for the site team' },
  presentation: { label: 'Presentation', icon: <Presentation className="h-4 w-4" />, hint: 'Clean drawing for the client' },
}

const MODE_ORDER: CanvasDrawingMode[] = ['designer', 'execution', 'presentation']

/**
 * AURA CANVAS V3D — Designer / Execution / Presentation switcher. Purely a
 * visibility preset (see CanvasEngine's `effective*` render gates) — never
 * deletes data, only changes what the current mode shows.
 */
export function ModeSelectorPopover({
  anchorRef,
  activeMode,
  onSelect,
  onClose,
  side = 'right',
}: {
  anchorRef: RefObject<HTMLElement | null>
  activeMode: CanvasDrawingMode
  onSelect: (mode: CanvasDrawingMode) => void
  onClose: () => void
  side?: 'left' | 'right'
}) {
  return (
    <AnchoredPopover anchorRef={anchorRef} onClose={onClose} side={side}>
      <div className="flex w-60 flex-col gap-1">
        <p className="mb-1 font-display text-sm font-semibold text-ink-900">Workspace Mode</p>
        {MODE_ORDER.map((m) => (
          <button
            key={m}
            onClick={() => {
              onSelect(m)
              onClose()
            }}
            className={cn(
              'flex flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left transition-colors',
              m === activeMode ? 'bg-ink-900 text-sand-50' : 'text-ink-600 hover:bg-sand-50',
            )}
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              {MODE_INFO[m].icon}
              {MODE_INFO[m].label}
            </span>
            <span className={cn('text-xs', m === activeMode ? 'text-sand-200' : 'text-ink-400')}>{MODE_INFO[m].hint}</span>
          </button>
        ))}
      </div>
    </AnchoredPopover>
  )
}
