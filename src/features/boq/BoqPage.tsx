import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight, ClipboardList, Search } from 'lucide-react'
import { Button, Card, EmptyState, IconButton } from '@/components/ui'
import { PricingSummary } from '@/components/pricing/PricingSummary'
import { cn } from '@/lib/cn'
import { useAppStore } from '@/store/useAppStore'
import { useShallow } from 'zustand/react/shallow'
import { buildProjectBoq } from '@/lib/pricing'
import type { BoqLineItem } from '@/lib/pricing'
import { formatCurrency } from '@/lib/format'
import { BoqItemDetailSheet } from './BoqItemDetailSheet'
import { AddItemSheet } from '@/features/rooms/AddItemSheet'
import type { RoomItem } from '@/types'

const UNIT_LABEL: Record<string, string> = {
  sqft: 'sqft',
  rft: 'rft',
  nos: 'nos',
  'lump-sum': 'lump sum',
}

const TABLE_COLUMNS = 'grid-cols-[minmax(0,1fr)_56px_64px_96px_112px]'

export function BoqPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()

  const project = useAppStore((s) => s.projects.find((p) => p.id === projectId))
  const rooms = useAppStore(useShallow((s) => s.rooms.filter((r) => r.projectId === projectId)))
  const updateItem = useAppStore((s) => s.updateItem)

  const [query, setQuery] = useState('')
  const [roomFilter, setRoomFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [detailLine, setDetailLine] = useState<BoqLineItem>()
  const [editingItem, setEditingItem] = useState<{ roomId: string; item: RoomItem }>()

  const boq = useMemo(() => {
    if (!project) return null
    return buildProjectBoq(rooms, project.pricing)
  }, [rooms, project])

  if (!project) {
    return (
      <div className="p-8">
        <EmptyState
          icon={<ClipboardList className="h-8 w-8" />}
          title="Project not found"
          action={<Button onClick={() => navigate('/projects')}>Back to Projects</Button>}
        />
      </div>
    )
  }

  const roomOptions = boq!.rooms.map((r) => ({ id: r.roomId, name: r.roomName }))
  const categoryOptions = Array.from(new Set(boq!.lines.map((l) => l.category))).sort()

  const filteredLines = boq!.lines.filter((line) => {
    const matchesRoom = roomFilter === 'all' || line.roomId === roomFilter
    const matchesCategory = categoryFilter === 'all' || line.category === categoryFilter
    const q = query.trim().toLowerCase()
    const matchesQuery =
      q.length === 0 ||
      line.name.toLowerCase().includes(q) ||
      line.category.toLowerCase().includes(q) ||
      line.roomName.toLowerCase().includes(q) ||
      (line.description ?? '').toLowerCase().includes(q)
    return matchesRoom && matchesCategory && matchesQuery
  })
  const visibleItemIds = new Set(filteredLines.map((l) => l.itemId))

  const displayRooms = boq!.rooms
    .map((room) => {
      const categories = room.categories
        .map((cat) => {
          const lines = cat.lines.filter((l) => visibleItemIds.has(l.itemId))
          return { ...cat, lines, subtotal: lines.reduce((sum, l) => sum + l.baseAmount, 0) }
        })
        .filter((cat) => cat.lines.length > 0)
      const subtotal = categories.reduce((sum, c) => sum + c.subtotal, 0)
      const itemCount = categories.reduce((sum, c) => sum + c.lines.length, 0)
      return { ...room, categories, subtotal, itemCount }
    })
    .filter((room) => room.categories.length > 0)

  function openDetail(line: BoqLineItem) {
    setDetailLine(line)
  }

  function handleEditFromDetail() {
    if (!detailLine) return
    const room = rooms.find((r) => r.id === detailLine.roomId)
    const item = room?.items.find((i) => i.id === detailLine.itemId)
    if (room && item) {
      setEditingItem({ roomId: room.id, item })
      setDetailLine(undefined)
    }
  }

  function handleGoToRoomFromDetail() {
    if (!detailLine) return
    navigate(`/projects/${project!.id}/rooms/${detailLine.roomId}`)
  }

  function handleSaveEdit(payload: Omit<RoomItem, 'id'>) {
    if (!editingItem) return
    updateItem(editingItem.roomId, editingItem.item.id, payload)
    setEditingItem(undefined)
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex items-center gap-2 border-b border-ink-100 bg-sand-100/60 px-5 py-4 sm:px-8">
        <IconButton label="Back to project" variant="ghost" onClick={() => navigate(`/projects/${project.id}`)}>
          <ArrowLeft className="h-5 w-5" />
        </IconButton>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-ink-400">{project.name}</p>
          <p className="text-xs text-ink-400">Bill of Quantities</p>
        </div>
      </div>

      <div className="border-b border-ink-100 bg-sand-100/60 px-5 py-4 sm:px-8">
        <h1 className="font-display text-2xl font-semibold text-ink-900">Bill of Quantities</h1>
        <p className="text-sm text-ink-500">
          {boq!.summary.totalItems} items across {boq!.rooms.length}{' '}
          {boq!.rooms.length === 1 ? 'room' : 'rooms'}
        </p>
      </div>

      {boq!.lines.length === 0 ? (
        <div className="p-8">
          <EmptyState
            icon={<ClipboardList className="h-8 w-8" />}
            title="Nothing to show yet"
            description="Add items to a room in the Room Builder and they'll appear here automatically."
            action={<Button onClick={() => navigate(`/projects/${project.id}`)}>Back to Project</Button>}
          />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 border-b border-ink-100 px-5 py-4 sm:px-8">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search BOQ items..."
                className="h-13 w-full rounded-[--radius-md] border-2 border-ink-100 bg-white pl-12 pr-4 text-base text-ink-900 placeholder:text-ink-400 outline-none transition-colors focus:border-brass-500"
              />
            </div>

            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setRoomFilter('all')}
                className={cn(
                  'h-9 shrink-0 rounded-full border-2 px-3.5 text-xs font-semibold transition-colors',
                  roomFilter === 'all'
                    ? 'border-ink-900 bg-ink-900 text-sand-50'
                    : 'border-ink-100 bg-white text-ink-600 hover:border-ink-300',
                )}
              >
                All Rooms
              </button>
              {roomOptions.map((room) => (
                <button
                  key={room.id}
                  onClick={() => setRoomFilter(room.id)}
                  className={cn(
                    'h-9 shrink-0 rounded-full border-2 px-3.5 text-xs font-semibold transition-colors',
                    roomFilter === room.id
                      ? 'border-ink-900 bg-ink-900 text-sand-50'
                      : 'border-ink-100 bg-white text-ink-600 hover:border-ink-300',
                  )}
                >
                  {room.name}
                </button>
              ))}
            </div>

            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setCategoryFilter('all')}
                className={cn(
                  'h-9 shrink-0 rounded-full border-2 px-3.5 text-xs font-semibold transition-colors',
                  categoryFilter === 'all'
                    ? 'border-brass-500 bg-brass-500/10 text-brass-700'
                    : 'border-ink-100 bg-white text-ink-600 hover:border-ink-300',
                )}
              >
                All Categories
              </button>
              {categoryOptions.map((category) => (
                <button
                  key={category}
                  onClick={() => setCategoryFilter(category)}
                  className={cn(
                    'h-9 shrink-0 rounded-full border-2 px-3.5 text-xs font-semibold transition-colors',
                    categoryFilter === category
                      ? 'border-brass-500 bg-brass-500/10 text-brass-700'
                      : 'border-ink-100 bg-white text-ink-600 hover:border-ink-300',
                  )}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-6 pb-28 sm:px-8">
            <div className="mx-auto flex max-w-4xl flex-col gap-5">
              <div
                className={cn(
                  'hidden gap-3 px-5 text-xs font-semibold uppercase tracking-wide text-ink-400 md:grid',
                  TABLE_COLUMNS,
                )}
              >
                <span>Item</span>
                <span className="text-right">Qty</span>
                <span>Unit</span>
                <span className="text-right">Rate</span>
                <span className="text-right">Amount</span>
              </div>

              {displayRooms.length === 0 ? (
                <EmptyState
                  icon={<Search className="h-7 w-7" />}
                  title="No items match your filters"
                  description="Try a different search term, room, or category."
                />
              ) : (
                displayRooms.map((room) => (
                  <Card key={room.roomId} padding="none">
                    <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
                      <div>
                        <h2 className="font-display text-lg font-semibold text-ink-900">{room.roomName}</h2>
                        <p className="text-xs text-ink-400">
                          {room.itemCount} {room.itemCount === 1 ? 'item' : 'items'}
                        </p>
                      </div>
                      <span className="font-display text-base font-semibold text-ink-900">
                        {formatCurrency(room.subtotal)}
                      </span>
                    </div>

                    {room.categories.map((cat) => (
                      <div key={cat.category}>
                        <div className="flex items-center justify-between bg-sand-50 px-5 py-2">
                          <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                            {cat.category}
                          </span>
                          <span className="text-xs font-semibold text-ink-500">
                            {formatCurrency(cat.subtotal)}
                          </span>
                        </div>
                        <div className="divide-y divide-ink-100">
                          {cat.lines.map((line) => (
                            <button
                              key={line.itemId}
                              onClick={() => openDetail(line)}
                              className="block w-full text-left transition-colors hover:bg-sand-50 active:bg-sand-100"
                            >
                              <div className={cn('hidden items-center gap-3 px-5 py-3.5 md:grid', TABLE_COLUMNS)}>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-ink-900">{line.name}</p>
                                  {line.description && (
                                    <p className="truncate text-xs text-ink-400">{line.description}</p>
                                  )}
                                </div>
                                <span className="text-right text-sm text-ink-600">{line.quantity}</span>
                                <span className="text-sm text-ink-500">{UNIT_LABEL[line.unit] ?? line.unit}</span>
                                <span className="text-right text-sm text-ink-600">{formatCurrency(line.rate)}</span>
                                <span className="text-right text-sm font-semibold text-ink-900">
                                  {formatCurrency(line.baseAmount)}
                                </span>
                              </div>

                              <div className="flex items-center gap-3 px-5 py-3.5 md:hidden">
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold text-ink-900">{line.name}</p>
                                  <p className="truncate text-xs text-ink-500">
                                    {line.quantity} {UNIT_LABEL[line.unit] ?? line.unit} ×{' '}
                                    {formatCurrency(line.rate)}
                                  </p>
                                </div>
                                <span className="shrink-0 font-display text-sm font-semibold text-ink-900">
                                  {formatCurrency(line.baseAmount)}
                                </span>
                                <ChevronRight className="h-4 w-4 shrink-0 text-ink-300" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </Card>
                ))
              )}

              <Card>
                <h2 className="mb-1 font-display text-lg font-semibold text-ink-900">BOQ Summary</h2>
                <p className="mb-4 text-sm text-ink-500">
                  {boq!.summary.totalItems} total items
                </p>

                <div className="mb-4 flex flex-col gap-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Room-wise Subtotal</p>
                  {boq!.summary.roomSubtotals.map((entry) => (
                    <div key={entry.label} className="flex items-center justify-between text-sm">
                      <span className="text-ink-600">{entry.label}</span>
                      <span className="font-semibold text-ink-800">{formatCurrency(entry.subtotal)}</span>
                    </div>
                  ))}
                </div>

                <div className="mb-5 flex flex-col gap-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                    Category-wise Subtotal
                  </p>
                  {boq!.summary.categorySubtotals.map((entry) => (
                    <div key={entry.label} className="flex items-center justify-between text-sm">
                      <span className="text-ink-600">{entry.label}</span>
                      <span className="font-semibold text-ink-800">{formatCurrency(entry.subtotal)}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-ink-100 pt-3">
                  <PricingSummary breakdown={boq!.summary.breakdown} totalLabel="Grand Total" />
                </div>
              </Card>
            </div>
          </div>

          <div className="sticky bottom-0 border-t border-ink-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-8">
            <div className="mx-auto flex max-w-4xl items-center justify-between">
              <span className="text-sm font-medium text-ink-500">Project Grand Total</span>
              <span className="font-display text-xl font-semibold text-brass-700">
                {formatCurrency(boq!.summary.breakdown.grandTotal)}
              </span>
            </div>
          </div>
        </>
      )}

      <BoqItemDetailSheet
        open={Boolean(detailLine)}
        onClose={() => setDetailLine(undefined)}
        line={detailLine}
        roomItem={
          detailLine
            ? rooms.find((r) => r.id === detailLine.roomId)?.items.find((i) => i.id === detailLine.itemId)
            : undefined
        }
        onEdit={handleEditFromDetail}
        onGoToRoom={handleGoToRoomFromDetail}
      />

      <AddItemSheet
        key={editingItem?.item.id ?? 'none'}
        open={Boolean(editingItem)}
        onClose={() => setEditingItem(undefined)}
        onSave={handleSaveEdit}
        initialItem={editingItem?.item}
      />
    </div>
  )
}
