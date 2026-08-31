import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Plus,
  DoorClosed,
  ChevronRight,
  Settings2,
  ClipboardList,
  FileText,
} from 'lucide-react'
import { Avatar, Badge, Button, Card, EmptyState, IconButton } from '@/components/ui'
import { PricingSummary } from '@/components/pricing/PricingSummary'
import { PricingConfigSheet } from '@/components/pricing/PricingConfigSheet'
import { useAppStore, roomArea } from '@/store/useAppStore'
import { useShallow } from 'zustand/react/shallow'
import { roomPricingBreakdown, projectPricingBreakdown } from '@/lib/pricing'
import { quotationPricingBreakdown } from '@/lib/quotation'
import { PROJECT_STATUS_META, PROJECT_TYPE_LABEL, QUOTATION_STATUS_META } from '@/data/statusMeta'
import { formatCurrency, formatDate } from '@/lib/format'
import { RoomTypePickerSheet } from '@/features/rooms/RoomTypePickerSheet'
import { useState } from 'react'

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const project = useAppStore((s) => s.projects.find((p) => p.id === projectId))
  const client = useAppStore((s) => s.clients.find((c) => c.id === project?.clientId))
  const rooms = useAppStore(useShallow((s) => s.rooms.filter((r) => r.projectId === projectId)))
  const quotations = useAppStore(useShallow((s) => s.quotations.filter((q) => q.projectId === projectId)))
  const updateProjectPricing = useAppStore((s) => s.updateProjectPricing)
  const createQuotationFromBoq = useAppStore((s) => s.createQuotationFromBoq)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pricingOpen, setPricingOpen] = useState(false)

  if (!project) {
    return (
      <div className="p-8">
        <EmptyState
          icon={<DoorClosed className="h-8 w-8" />}
          title="Project not found"
          description="This project may have been removed."
          action={<Button onClick={() => navigate('/projects')}>Back to Projects</Button>}
        />
      </div>
    )
  }

  const statusMeta = PROJECT_STATUS_META[project.status]
  const breakdown = projectPricingBreakdown(rooms, project.pricing)
  const quotation = quotations[0]
  const hasBoqItems = rooms.some((r) => r.items.length > 0)

  function handleCreateQuotation() {
    createQuotationFromBoq(project!.id)
    navigate(`/projects/${project!.id}/quotation`)
  }

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-ink-100 bg-sand-100/60 px-5 py-4 sm:px-8">
        <IconButton label="Back" variant="ghost" onClick={() => navigate('/projects')}>
          <ArrowLeft className="h-5 w-5" />
        </IconButton>
        <span className="text-sm font-semibold text-ink-500">Projects</span>
      </div>

      <div className="px-5 py-6 sm:px-8">
        <Card className="flex flex-col gap-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                {PROJECT_TYPE_LABEL[project.type]}
              </p>
              <h1 className="mt-0.5 font-display text-2xl font-semibold text-ink-900">
                {project.name}
              </h1>
              {client && (
                <button
                  onClick={() => navigate(`/clients/${client.id}`)}
                  className="mt-2 flex items-center gap-2.5 rounded-full py-1 pr-3 hover:bg-sand-100"
                >
                  <Avatar name={client.name} color={client.avatarColor} size="sm" />
                  <span className="text-sm font-semibold text-ink-700">{client.name}</span>
                </button>
              )}
            </div>
            <Badge tone={statusMeta.tone} className="shrink-0 self-start">
              {statusMeta.label}
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-3 border-t border-ink-100 pt-4 lg:grid-cols-3">
            <div className="flex items-center gap-2.5 text-sm text-ink-600">
              <MapPin className="h-4 w-4 shrink-0 text-brass-500" />
              <span className="truncate">{project.address}</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-ink-600">
              <Calendar className="h-4 w-4 shrink-0 text-brass-500" />
              <span>
                {project.targetDate ? `Target ${formatDate(project.targetDate)}` : 'No target date set'}
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-ink-600">
              <span className="text-ink-400">Updated</span>
              <span>{formatDate(project.updatedAt)}</span>
            </div>
          </div>
        </Card>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.4fr]">
          <Card className="flex items-center justify-between self-start">
            <div>
              <p className="text-xs font-medium text-ink-400">Estimated Budget</p>
              <p className="mt-0.5 font-display text-xl font-semibold text-ink-900">
                {formatCurrency(project.budgetEstimate)}
              </p>
            </div>
          </Card>
          <Card>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-ink-900">Project Pricing</h2>
              <IconButton label="Edit pricing settings" variant="ghost" size="sm" onClick={() => setPricingOpen(true)}>
                <Settings2 className="h-4 w-4" />
              </IconButton>
            </div>
            <PricingSummary breakdown={breakdown} totalLabel="Grand Total" />
          </Card>
        </div>

        <button
          onClick={() => navigate(`/projects/${project.id}/boq`)}
          className="mt-4 flex w-full items-center justify-between rounded-[--radius-lg] border-2 border-ink-100 bg-white px-5 py-4 text-left transition-colors hover:border-brass-400 hover:bg-brass-500/5"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[--radius-md] bg-brass-500/12 text-brass-600">
              <ClipboardList className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-ink-900">Bill of Quantities</span>
              <span className="block text-xs text-ink-500">Grouped, priced item breakdown for this project</span>
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-ink-300" />
        </button>

        {quotation ? (
          <button
            onClick={() => navigate(`/projects/${project.id}/quotation`)}
            className="mt-3 flex w-full items-center justify-between rounded-[--radius-lg] border-2 border-ink-100 bg-white px-5 py-4 text-left transition-colors hover:border-brass-400 hover:bg-brass-500/5"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[--radius-md] bg-brass-500/12 text-brass-600">
                <FileText className="h-5 w-5" />
              </span>
              <span>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-ink-900">{quotation.quotationNumber}</span>
                  <Badge tone={QUOTATION_STATUS_META[quotation.status].tone}>
                    {QUOTATION_STATUS_META[quotation.status].label}
                  </Badge>
                </span>
                <span className="block text-xs text-ink-500">
                  {formatCurrency(quotationPricingBreakdown(quotation.items, quotation.pricing).grandTotal)}
                </span>
              </span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-ink-300" />
          </button>
        ) : (
          <button
            onClick={handleCreateQuotation}
            disabled={!hasBoqItems}
            className="mt-3 flex w-full items-center justify-between rounded-[--radius-lg] border-2 border-dashed border-ink-200 bg-white px-5 py-4 text-left transition-colors hover:border-brass-400 hover:bg-brass-500/5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-ink-200 disabled:hover:bg-white"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[--radius-md] bg-brass-500/12 text-brass-600">
                <FileText className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-ink-900">Create Quotation</span>
                <span className="block text-xs text-ink-500">
                  {hasBoqItems ? 'Generate a quotation from the BOQ' : 'Add room items before quoting'}
                </span>
              </span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-ink-300" />
          </button>
        )}

        <div className="mt-8 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-ink-900">
            Rooms ({rooms.length})
          </h2>
          <Button
            size="md"
            variant="secondary"
            icon={<Plus className="h-5 w-5" />}
            onClick={() => setPickerOpen(true)}
          >
            Add Room
          </Button>
        </div>

        {rooms.length === 0 ? (
          <EmptyState
            className="mt-4"
            icon={<DoorClosed className="h-8 w-8" />}
            title="No rooms added yet"
            description="Add the first room to start building requirements, items and pricing."
            action={
              <Button icon={<Plus className="h-5 w-5" />} onClick={() => setPickerOpen(true)}>
                Add Room
              </Button>
            }
          />
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3.5 lg:grid-cols-2 xl:grid-cols-3">
            {rooms.map((room) => {
              const checkedCount = room.requirements.filter((r) => r.isChecked).length
              return (
                <Card
                  key={room.id}
                  interactive
                  onClick={() => navigate(`/projects/${project.id}/rooms/${room.id}`)}
                  className="flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display text-lg font-semibold text-ink-900">
                        {room.name}
                      </h3>
                      <p className="text-xs text-ink-500">
                        {room.dimensions.lengthFt > 0 && room.dimensions.widthFt > 0
                          ? `${room.dimensions.lengthFt}′ × ${room.dimensions.widthFt}′ · ${roomArea(room).toFixed(0)} sqft`
                          : 'Dimensions not set'}
                      </p>
                    </div>
                    <Badge tone={room.isComplete ? 'success' : 'neutral'}>
                      {room.isComplete ? 'Complete' : 'In Progress'}
                    </Badge>
                  </div>
                  <p className="text-xs text-ink-400">
                    {checkedCount}/{room.requirements.length} requirements · {room.items.length} items
                  </p>
                  <div className="flex items-center justify-between border-t border-ink-100 pt-3">
                    <span className="font-display text-base font-semibold text-ink-900">
                      {formatCurrency(roomPricingBreakdown(room, rooms, project.pricing).grandTotal)}
                    </span>
                    <ChevronRight className="h-5 w-5 text-ink-300" />
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <RoomTypePickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        projectId={project.id}
        onRoomCreated={(room) => navigate(`/projects/${project.id}/rooms/${room.id}`)}
      />

      <PricingConfigSheet
        open={pricingOpen}
        onClose={() => setPricingOpen(false)}
        pricing={project.pricing}
        onSave={(pricing) => updateProjectPricing(project.id, pricing)}
        subtitle="Applies across every room in this project."
      />
    </div>
  )
}
