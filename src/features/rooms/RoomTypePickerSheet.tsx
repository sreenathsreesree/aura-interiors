import { useState } from 'react'
import { Sheet, Input, Button } from '@/components/ui'
import { ROOM_TYPE_OPTIONS } from '@/data/roomTypes'
import { getRoomIcon } from '@/data/roomIcons'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/cn'
import type { Room, RoomType } from '@/types'

interface RoomTypePickerSheetProps {
  open: boolean
  onClose: () => void
  projectId: string
  onRoomCreated: (room: Room) => void
}

export function RoomTypePickerSheet({ open, onClose, projectId, onRoomCreated }: RoomTypePickerSheetProps) {
  const addRoom = useAppStore((s) => s.addRoom)
  const [selectedType, setSelectedType] = useState<RoomType | null>(null)
  const [customName, setCustomName] = useState('')

  function handleClose() {
    setSelectedType(null)
    setCustomName('')
    onClose()
  }

  function handleAdd() {
    if (!selectedType) return
    const room = addRoom(projectId, selectedType, customName)
    onRoomCreated(room)
    handleClose()
  }

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      title="Add a Room"
      subtitle="Select the room type to start with a smart requirements checklist."
      footer={
        <Button fullWidth size="xl" disabled={!selectedType} onClick={handleAdd}>
          Add Room
        </Button>
      }
    >
      <div className="grid grid-cols-3 gap-3 py-2 sm:grid-cols-4">
        {ROOM_TYPE_OPTIONS.map((option) => {
          const Icon = getRoomIcon(option.icon)
          const isSelected = selectedType === option.type
          return (
            <button
              key={option.type}
              onClick={() => setSelectedType(option.type)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-[--radius-md] border-2 px-2 py-3.5 text-center transition-colors',
                isSelected
                  ? 'border-brass-500 bg-brass-500/8'
                  : 'border-ink-100 bg-sand-50 hover:border-ink-300',
              )}
            >
              <Icon className={cn('h-6 w-6', isSelected ? 'text-brass-600' : 'text-ink-500')} />
              <span
                className={cn(
                  'text-xs font-semibold leading-tight',
                  isSelected ? 'text-brass-700' : 'text-ink-600',
                )}
              >
                {option.label}
              </span>
            </button>
          )
        })}
      </div>

      {selectedType && (
        <Input
          label="Room Name (optional)"
          placeholder="e.g. Guest Bedroom"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          containerClassName="mt-4"
        />
      )}
    </Sheet>
  )
}
