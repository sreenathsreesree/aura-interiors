import { DoorClosed } from 'lucide-react'
import { Button } from '@/components/ui'
import { formatLength, type CanvasUnit } from '@/lib/units'

interface UseRoomDimensionsCardProps {
  roomName: string
  lengthMm: number
  widthMm: number
  unit: CanvasUnit
  onUse: () => void
}

// Shown only when a calculator is opened from inside a Room that already
// has dimensions — one tap prefills length/width instead of retyping what
// Room Builder already has (per the milestone's explicit "do not force the
// designer to type the same information again"). Values are always shown
// in whichever unit the calculator is currently set to, via the same
// lib/units.ts formatter every other length display in the app uses.
export function UseRoomDimensionsCard({ roomName, lengthMm, widthMm, unit, onUse }: UseRoomDimensionsCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-[--radius-lg] border-2 border-dashed border-brass-400/60 bg-brass-500/5 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[--radius-md] bg-white text-brass-600">
          <DoorClosed className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink-900">{roomName}</p>
          <p className="text-xs text-ink-500">
            {formatLength(lengthMm, unit)} × {formatLength(widthMm, unit)}
          </p>
        </div>
      </div>
      <Button variant="outline" size="md" onClick={onUse} className="shrink-0">
        Use Room Dimensions
      </Button>
    </div>
  )
}
