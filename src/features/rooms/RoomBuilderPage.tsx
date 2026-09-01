import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronRight,
  Plus,
  Trash2,
  Pencil,
  PenTool,
  Ruler,
  ListChecks,
  PackagePlus,
  Check,
  DoorClosed,
  Receipt,
} from 'lucide-react'
import { Badge, Button, Card, EmptyState, IconButton, NumberStepper } from '@/components/ui'
import { PricingSummary } from '@/components/pricing/PricingSummary'
import { cn } from '@/lib/cn'
import { useAppStore, roomArea } from '@/store/useAppStore'
import { useShallow } from 'zustand/react/shallow'
import { calculateBaseAmount, roomPricingBreakdown } from '@/lib/pricing'
import { formatCurrency } from '@/lib/format'
import { getRoomIcon } from '@/data/roomIcons'
import { getRoomTypeOption } from '@/data/roomTypes'
import { RoomTypePickerSheet } from './RoomTypePickerSheet'
import { AddItemSheet } from './AddItemSheet'
import type { RoomItem } from '@/types'

export function RoomBuilderPage() {
  const { projectId, roomId } = useParams<{ projectId: string; roomId: string }>()
  const navigate = useNavigate()

  const project = useAppStore((s) => s.projects.find((p) => p.id === projectId))
  const rooms = useAppStore(useShallow((s) => s.rooms.filter((r) => r.projectId === projectId)))
  const room = rooms.find((r) => r.id === roomId)

  const updateRoomDimensions = useAppStore((s) => s.updateRoomDimensions)
  const toggleRequirement = useAppStore((s) => s.toggleRequirement)
  const addRequirement = useAppStore((s) => s.addRequirement)
  const addItem = useAppStore((s) => s.addItem)
  const updateItem = useAppStore((s) => s.updateItem)
  const removeItem = useAppStore((s) => s.removeItem)
  const removeRoom = useAppStore((s) => s.removeRoom)
  const markRoomComplete = useAppStore((s) => s.markRoomComplete)

  const [addRoomOpen, setAddRoomOpen] = useState(false)
  const [itemSheet, setItemSheet] = useState<{ open: boolean; editing?: RoomItem }>({ open: false })
  const [newRequirement, setNewRequirement] = useState('')

  if (!project) {
    return (
      <div className="p-8">
        <EmptyState
          icon={<DoorClosed className="h-8 w-8" />}
          title="Project not found"
          action={<Button onClick={() => navigate('/projects')}>Back to Projects</Button>}
        />
      </div>
    )
  }

  if (!room) {
    return (
      <div className="p-8">
        <EmptyState
          icon={<DoorClosed className="h-8 w-8" />}
          title="Room not found"
          description="This room may have been removed from the project."
          action={<Button onClick={() => navigate(`/projects/${project.id}`)}>Back to Project</Button>}
        />
      </div>
    )
  }

  const area = roomArea(room)
  const breakdown = roomPricingBreakdown(room, rooms, project.pricing)
  const checkedCount = room.requirements.filter((r) => r.isChecked).length

  function goToRoom(nextRoomId: string) {
    navigate(`/projects/${project!.id}/rooms/${nextRoomId}`)
  }

  function handleDeleteRoom() {
    if (!room) return
    if (rooms.length <= 1) {
      if (!window.confirm('Delete this room? It is the only room in the project.')) return
      removeRoom(room.id)
      navigate(`/projects/${project!.id}`)
      return
    }
    if (!window.confirm(`Delete "${room.name}"? This cannot be undone.`)) return
    const remaining = rooms.filter((r) => r.id !== room.id)
    removeRoom(room.id)
    goToRoom(remaining[0].id)
  }

  function handleSaveAndContinue() {
    if (!room) return
    markRoomComplete(room.id, true)
    const nextIncomplete = rooms.find((r) => r.id !== room.id && !r.isComplete)
    if (nextIncomplete) {
      goToRoom(nextIncomplete.id)
    } else {
      navigate(`/projects/${project!.id}`)
    }
  }

  function handleAddRequirement() {
    if (!room || !newRequirement.trim()) return
    addRequirement(room.id, newRequirement)
    setNewRequirement('')
  }

  function handleSaveItem(payload: Omit<RoomItem, 'id'>) {
    if (!room) return
    if (itemSheet.editing) {
      updateItem(room.id, itemSheet.editing.id, payload)
    } else {
      addItem(room.id, payload)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      {/* Room switcher — left rail on tablet, top strip on mobile */}
      <aside className="flex shrink-0 flex-col border-b border-ink-100 bg-white md:w-72 md:border-b-0 md:border-r lg:w-80">
        <div className="flex items-center gap-2 px-4 py-4">
          <IconButton label="Back to project" variant="ghost" onClick={() => navigate(`/projects/${project.id}`)}>
            <ArrowLeft className="h-5 w-5" />
          </IconButton>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-wide text-ink-400">
              {project.name}
            </p>
            <p className="text-xs text-ink-400">Room Builder</p>
          </div>
        </div>

        <div className="flex gap-2.5 overflow-x-auto px-4 pb-4 no-scrollbar md:flex-col md:overflow-visible md:px-3">
          {rooms.map((r) => {
            const Icon = getRoomIcon(getRoomTypeOption(r.type).icon)
            const isActive = r.id === room.id
            return (
              <button
                key={r.id}
                onClick={() => goToRoom(r.id)}
                className={cn(
                  'flex shrink-0 items-center gap-3 rounded-[--radius-md] border-2 px-3.5 py-3 text-left transition-colors md:w-full',
                  isActive
                    ? 'border-ink-900 bg-ink-900 text-sand-50'
                    : 'border-ink-100 bg-sand-50 text-ink-700 hover:border-ink-300',
                )}
              >
                <Icon className={cn('h-5 w-5 shrink-0', isActive ? 'text-brass-400' : 'text-ink-400')} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{r.name}</p>
                  <p className={cn('truncate text-xs', isActive ? 'text-sand-200' : 'text-ink-400')}>
                    {r.isComplete ? 'Complete' : `${r.items.length} items`}
                  </p>
                </div>
                {r.isComplete && (
                  <Check className={cn('ml-auto h-4 w-4 shrink-0', isActive ? 'text-sand-100' : 'text-sage-500')} />
                )}
              </button>
            )
          })}

          <button
            onClick={() => setAddRoomOpen(true)}
            className="flex shrink-0 items-center justify-center gap-2 rounded-[--radius-md] border-2 border-dashed border-ink-200 px-3.5 py-3 text-sm font-semibold text-ink-500 hover:border-ink-400 hover:bg-sand-50 md:w-full"
          >
            <Plus className="h-4 w-4" />
            Add Room
          </button>
        </div>
      </aside>

      {/* Main builder pane */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-ink-100 bg-sand-100/60 px-5 py-4 sm:px-8">
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-semibold text-ink-900">{room.name}</h1>
            <p className="text-sm text-ink-500">
              {area > 0 ? `${area.toFixed(0)} sqft` : 'Set dimensions to calculate area'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <Badge tone={room.isComplete ? 'success' : 'neutral'}>
              {room.isComplete ? 'Complete' : 'In Progress'}
            </Badge>
            <IconButton
              label="AURA Canvas"
              variant="default"
              onClick={() => navigate(`/projects/${project.id}/rooms/${room.id}/canvas`)}
            >
              <PenTool className="h-5 w-5" />
            </IconButton>
            <IconButton label="Delete room" variant="danger" onClick={handleDeleteRoom}>
              <Trash2 className="h-5 w-5" />
            </IconButton>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6 pb-40 sm:px-8">
          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            <button
              onClick={() => navigate(`/projects/${project.id}/rooms/${room.id}/canvas`)}
              className="flex w-full items-center justify-between rounded-[--radius-lg] border-2 border-ink-900 bg-ink-900 px-5 py-4 text-left transition-colors hover:bg-ink-800"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[--radius-md] bg-brass-500/20 text-brass-400">
                  <PenTool className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-sand-50">AURA Canvas</span>
                  <span className="block text-xs text-sand-300">2D drawing workspace for this room</span>
                </span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-sand-400" />
            </button>

            {/* Dimensions */}
            <Card>
              <div className="mb-4 flex items-center gap-2.5">
                <Ruler className="h-5 w-5 text-brass-500" />
                <h2 className="font-display text-lg font-semibold text-ink-900">Dimensions</h2>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <NumberStepper
                  label="Length"
                  value={room.dimensions.lengthFt}
                  onChange={(v) => updateRoomDimensions(room.id, { lengthFt: v })}
                  suffix="ft"
                />
                <NumberStepper
                  label="Width"
                  value={room.dimensions.widthFt}
                  onChange={(v) => updateRoomDimensions(room.id, { widthFt: v })}
                  suffix="ft"
                />
                <NumberStepper
                  label="Height"
                  value={room.dimensions.heightFt}
                  onChange={(v) => updateRoomDimensions(room.id, { heightFt: v })}
                  suffix="ft"
                />
              </div>
              <div className="mt-4 flex items-center justify-between rounded-[--radius-md] bg-brass-500/8 px-4 py-3.5">
                <span className="text-sm font-semibold text-brass-700">Floor Area</span>
                <span className="font-display text-xl font-semibold text-brass-700">
                  {area.toFixed(1)} sqft
                </span>
              </div>
            </Card>

            {/* Requirements */}
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <ListChecks className="h-5 w-5 text-brass-500" />
                  <h2 className="font-display text-lg font-semibold text-ink-900">Requirements</h2>
                </div>
                <span className="text-sm font-medium text-ink-400">
                  {checkedCount}/{room.requirements.length}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {room.requirements.map((req) => (
                  <button
                    key={req.id}
                    onClick={() => toggleRequirement(room.id, req.id)}
                    className="flex items-center gap-3.5 rounded-[--radius-md] px-2 py-3 text-left transition-colors hover:bg-sand-50 active:bg-sand-100"
                  >
                    <span
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
                        req.isChecked
                          ? 'border-sage-500 bg-sage-500 text-white'
                          : 'border-ink-200 bg-white',
                      )}
                    >
                      {req.isChecked && <Check className="h-4 w-4" />}
                    </span>
                    <span
                      className={cn(
                        'text-sm font-medium',
                        req.isChecked ? 'text-ink-400 line-through' : 'text-ink-800',
                      )}
                    >
                      {req.label}
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-3 flex gap-2.5">
                <input
                  value={newRequirement}
                  onChange={(e) => setNewRequirement(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddRequirement()}
                  placeholder="Add a custom requirement..."
                  className="h-12 flex-1 rounded-[--radius-md] border-2 border-ink-100 bg-sand-50 px-4 text-sm outline-none focus:border-brass-500"
                />
                <Button variant="outline" size="md" onClick={handleAddRequirement}>
                  Add
                </Button>
              </div>
            </Card>

            {/* Items */}
            <Card padding="none">
              <div className="flex items-center justify-between p-5 pb-4">
                <div className="flex items-center gap-2.5">
                  <PackagePlus className="h-5 w-5 text-brass-500" />
                  <h2 className="font-display text-lg font-semibold text-ink-900">Items</h2>
                </div>
                <Button
                  size="md"
                  variant="secondary"
                  icon={<Plus className="h-5 w-5" />}
                  onClick={() => setItemSheet({ open: true })}
                >
                  Add Item
                </Button>
              </div>

              {room.items.length === 0 ? (
                <div className="px-5 pb-6">
                  <EmptyState
                    icon={<PackagePlus className="h-7 w-7" />}
                    title="No items yet"
                    description="Add items from the rate catalog or create a custom line item."
                  />
                </div>
              ) : (
                <div className="divide-y divide-ink-100 border-t border-ink-100">
                  {room.items.map((item) => {
                    const isOverridden = Boolean(item.catalogueItemId) && item.rate !== item.masterRate
                    return (
                      <div key={item.id} className="flex items-center gap-3 px-5 py-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-ink-900">{item.name}</p>
                            {isOverridden && (
                              <Badge tone="terracotta" className="shrink-0">
                                Custom rate
                              </Badge>
                            )}
                          </div>
                          <p className="truncate text-xs text-ink-500">
                            {item.unit === 'lump-sum'
                              ? `Flat rate · ${formatCurrency(item.rate)}`
                              : `${item.quantity} ${item.unit} × ${formatCurrency(item.rate)}`}
                          </p>
                        </div>
                        <span className="shrink-0 font-display text-sm font-semibold text-ink-900">
                          {formatCurrency(calculateBaseAmount(item.quantity, item.rate, item.unit))}
                        </span>
                        <div className="flex shrink-0 items-center gap-1">
                          <IconButton
                            label="Edit item"
                            size="sm"
                            variant="ghost"
                            onClick={() => setItemSheet({ open: true, editing: item })}
                          >
                            <Pencil className="h-4 w-4" />
                          </IconButton>
                          <IconButton
                            label="Delete item"
                            size="sm"
                            variant="danger"
                            onClick={() => removeItem(room.id, item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </IconButton>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>

            {/* Pricing */}
            {room.items.length > 0 && (
              <Card>
                <div className="mb-2 flex items-center gap-2.5">
                  <Receipt className="h-5 w-5 text-brass-500" />
                  <h2 className="font-display text-lg font-semibold text-ink-900">Pricing</h2>
                </div>
                <PricingSummary breakdown={breakdown} totalLabel="Room Total" compact />
              </Card>
            )}
          </div>
        </div>

        {/* Sticky footer: room total + save & continue */}
        <div className="sticky bottom-0 border-t border-ink-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-8">
          <div className="mx-auto flex max-w-3xl items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-ink-400">Room Total</p>
              <p className="font-display text-xl font-semibold text-ink-900">
                {formatCurrency(breakdown.grandTotal)}
              </p>
            </div>
            <Button size="xl" icon={<Check className="h-5 w-5" />} onClick={handleSaveAndContinue}>
              Save &amp; Continue
            </Button>
          </div>
        </div>
      </div>

      <RoomTypePickerSheet
        open={addRoomOpen}
        onClose={() => setAddRoomOpen(false)}
        projectId={project.id}
        onRoomCreated={(newRoom) => goToRoom(newRoom.id)}
      />

      <AddItemSheet
        key={itemSheet.editing?.id ?? 'new'}
        open={itemSheet.open}
        onClose={() => setItemSheet({ open: false })}
        onSave={handleSaveItem}
        initialItem={itemSheet.editing}
      />
    </div>
  )
}
