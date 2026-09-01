import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  FileText,
  Pencil,
  Plus,
  Printer,
  Settings2,
  Trash2,
  X,
} from 'lucide-react'
import { Badge, Button, Card, EmptyState, IconButton, Input, NumberStepper, Textarea } from '@/components/ui'
import { PricingSummary } from '@/components/pricing/PricingSummary'
import { PricingConfigSheet } from '@/components/pricing/PricingConfigSheet'
import { cn } from '@/lib/cn'
import { useAppStore } from '@/store/useAppStore'
import { useShallow } from 'zustand/react/shallow'
import { calculateBaseAmount } from '@/lib/pricing'
import {
  QUOTATION_UNIT_LABEL,
  groupQuotationItemsByRoom,
  includedQuotationItems,
  quotationPdfFileName,
  quotationPricingBreakdown,
} from '@/lib/quotation'
import { formatCurrency } from '@/lib/format'
import { QUOTATION_STATUS_META, QUOTATION_STATUS_OPTIONS } from '@/data/statusMeta'
import { QuotationItemEditSheet } from './QuotationItemEditSheet'
import { QuotationPreview } from './QuotationPreview'
import type { CompanyProfile, PaymentMilestone, QuotationItem } from '@/types'

export function QuotationBuilderPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()

  const project = useAppStore((s) => s.projects.find((p) => p.id === projectId))
  const rooms = useAppStore(useShallow((s) => s.rooms.filter((r) => r.projectId === projectId)))
  const quotations = useAppStore(useShallow((s) => s.quotations.filter((q) => q.projectId === projectId)))
  const createQuotationFromBoq = useAppStore((s) => s.createQuotationFromBoq)
  const updateQuotation = useAppStore((s) => s.updateQuotation)
  const updateQuotationItem = useAppStore((s) => s.updateQuotationItem)
  const setQuotationRoomIncluded = useAppStore((s) => s.setQuotationRoomIncluded)
  const moveQuotationItem = useAppStore((s) => s.moveQuotationItem)

  const [pricingOpen, setPricingOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<QuotationItem>()
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)

  const quotation = quotations[0]

  if (!project) {
    return (
      <div className="p-8">
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="Project not found"
          action={<Button onClick={() => navigate('/projects')}>Back to Projects</Button>}
        />
      </div>
    )
  }

  const hasBoqItems = rooms.some((r) => r.items.length > 0)

  if (!quotation) {
    return (
      <div className="flex min-h-dvh flex-col">
        <div className="flex items-center gap-2 border-b border-ink-100 bg-sand-100/60 px-5 py-4 sm:px-8">
          <IconButton label="Back to project" variant="ghost" onClick={() => navigate(`/projects/${project.id}`)}>
            <ArrowLeft className="h-5 w-5" />
          </IconButton>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-wide text-ink-400">{project.name}</p>
            <p className="text-xs text-ink-400">Quotation</p>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center p-8">
          <EmptyState
            icon={<FileText className="h-8 w-8" />}
            title="No quotation yet"
            description={
              hasBoqItems
                ? 'Generate a quotation from this project’s BOQ — every included room item comes across automatically.'
                : 'Add rooms and items in the Room Builder before creating a quotation.'
            }
            action={
              hasBoqItems ? (
                <Button icon={<FileText className="h-5 w-5" />} onClick={() => createQuotationFromBoq(project.id)}>
                  Create Quotation
                </Button>
              ) : (
                <Button variant="outline" onClick={() => navigate(`/projects/${project.id}`)}>
                  Back to Project
                </Button>
              )
            }
          />
        </div>
      </div>
    )
  }

  // Two views of the same items: `roomGroups` lists every item (included,
  // optional, or excluded) so the designer can still see and toggle them;
  // `contributingSubtotalByRoom` is the amount that actually counts toward
  // the grand total, for the room-header figure — keeps it consistent with
  // what the live preview shows instead of quietly including optional/
  // excluded amounts in a number labelled "included".
  const roomGroups = groupQuotationItemsByRoom(quotation.items)
  const contributingSubtotalByRoom = new Map(
    groupQuotationItemsByRoom(includedQuotationItems(quotation.items)).map((r) => [r.roomId, r.subtotal]),
  )
  const breakdown = quotationPricingBreakdown(quotation.items, quotation.pricing)
  const statusMeta = QUOTATION_STATUS_META[quotation.status]

  function patchCompany(field: keyof CompanyProfile, value: string) {
    updateQuotation(quotation.id, { company: { ...quotation.company, [field]: value } })
  }

  function updateMilestone(id: string, updates: Partial<Omit<PaymentMilestone, 'id'>>) {
    updateQuotation(quotation.id, {
      paymentMilestones: quotation.paymentMilestones.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    })
  }

  function removeMilestone(id: string) {
    updateQuotation(quotation.id, {
      paymentMilestones: quotation.paymentMilestones.filter((m) => m.id !== id),
    })
  }

  function addMilestone() {
    updateQuotation(quotation.id, {
      paymentMilestones: [
        ...quotation.paymentMilestones,
        { id: `pm-${Date.now().toString(36)}`, label: 'New Milestone', percent: 0, description: '' },
      ],
    })
  }

  function updateTerm(index: number, value: string) {
    const next = [...quotation.termsAndConditions]
    next[index] = value
    updateQuotation(quotation.id, { termsAndConditions: next })
  }

  function removeTerm(index: number) {
    updateQuotation(
      quotation.id,
      { termsAndConditions: quotation.termsAndConditions.filter((_, i) => i !== index) },
    )
  }

  function addTerm() {
    updateQuotation(quotation.id, { termsAndConditions: [...quotation.termsAndConditions, ''] })
  }

  const milestoneTotalPercent = quotation.paymentMilestones.reduce((sum, m) => sum + m.percent, 0)

  async function handleDownloadPdf() {
    if (isGeneratingPdf || !quotation) return
    setIsGeneratingPdf(true)
    try {
      // Loaded on demand — @react-pdf/renderer (plus fontkit) is sizeable and
      // most visits to the Quotation Builder never touch PDF export.
      const [{ pdf }, { QuotationPdfDocument }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./pdf/QuotationPdfDocument'),
      ])
      const blob = await pdf(<QuotationPdfDocument quotation={quotation} />).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = quotationPdfFileName(quotation)
      link.click()
      URL.revokeObjectURL(url)
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  function handlePrint() {
    window.print()
  }

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 border-b border-ink-100 bg-sand-100/60 px-5 py-4 sm:px-8">
        <IconButton label="Back to project" variant="ghost" onClick={() => navigate(`/projects/${project.id}`)}>
          <ArrowLeft className="h-5 w-5" />
        </IconButton>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-ink-400">{project.name}</p>
          <p className="text-xs text-ink-400">Quotation Builder</p>
        </div>
        <Badge tone={statusMeta.tone} className="hidden sm:inline-flex">
          {statusMeta.label}
        </Badge>
      </div>

      <div className="flex flex-1 flex-col lg:flex-row lg:overflow-hidden">
        {/* LEFT: controls */}
        <div className="flex-1 overflow-y-auto px-5 py-6 pb-28 sm:px-8 lg:max-w-xl lg:border-r lg:border-ink-100 lg:pb-6">
          <div className="mx-auto flex max-w-2xl flex-col gap-5 lg:mx-0 lg:max-w-none">
            {/* Details */}
            <Card>
              <h2 className="mb-4 font-display text-lg font-semibold text-ink-900">Quotation Details</h2>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Quotation Number"
                  value={quotation.quotationNumber}
                  onChange={(e) => updateQuotation(quotation.id, { quotationNumber: e.target.value })}
                />
                <NumberStepper
                  label="Revision"
                  value={quotation.revision}
                  onChange={(v) => updateQuotation(quotation.id, { revision: Math.max(1, v) })}
                  step={1}
                  min={1}
                />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <Input
                  label="Issue Date"
                  type="date"
                  value={quotation.issueDate}
                  onChange={(e) => updateQuotation(quotation.id, { issueDate: e.target.value })}
                />
                <Input
                  label="Valid Until"
                  type="date"
                  value={quotation.validUntil}
                  onChange={(e) => updateQuotation(quotation.id, { validUntil: e.target.value })}
                />
              </div>

              <div className="mt-4">
                <span className="mb-1.5 block text-sm font-semibold text-ink-700">Status</span>
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                  {QUOTATION_STATUS_OPTIONS.map((status) => (
                    <button
                      key={status}
                      onClick={() => updateQuotation(quotation.id, { status })}
                      className={cn(
                        'h-9 shrink-0 rounded-full border-2 px-3.5 text-xs font-semibold transition-colors',
                        quotation.status === status
                          ? 'border-ink-900 bg-ink-900 text-sand-50'
                          : 'border-ink-100 bg-white text-ink-600 hover:border-ink-300',
                      )}
                    >
                      {QUOTATION_STATUS_META[status].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 border-t border-ink-100 pt-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-ink-400">Client</p>
                  <p className="text-sm font-semibold text-ink-800">{quotation.clientName}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-ink-400">Project</p>
                  <p className="text-sm font-semibold text-ink-800">{quotation.projectName}</p>
                </div>
              </div>
              <Input
                label="Project Location"
                className="mt-3"
                value={quotation.projectLocation}
                onChange={(e) => updateQuotation(quotation.id, { projectLocation: e.target.value })}
              />
            </Card>

            {/* Company */}
            <Card>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[--radius-md] bg-ink-900 font-display text-sm font-semibold text-sand-50">
                  {quotation.company.logoMark}
                </div>
                <div>
                  <h2 className="font-display text-lg font-semibold text-ink-900">Company Details</h2>
                  <p className="text-xs text-ink-400">Logo placeholder — printed on the quotation</p>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Studio Name" value={quotation.company.name} onChange={(e) => patchCompany('name', e.target.value)} />
                  <Input label="Tagline" value={quotation.company.tagline} onChange={(e) => patchCompany('tagline', e.target.value)} />
                </div>
                <Textarea
                  label="Address"
                  value={quotation.company.address}
                  onChange={(e) => patchCompany('address', e.target.value)}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Phone" value={quotation.company.phone} onChange={(e) => patchCompany('phone', e.target.value)} />
                  <Input label="Email" value={quotation.company.email} onChange={(e) => patchCompany('email', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Website" value={quotation.company.website} onChange={(e) => patchCompany('website', e.target.value)} />
                  <Input label="GSTIN" value={quotation.company.gstin} onChange={(e) => patchCompany('gstin', e.target.value)} />
                </div>
              </div>
            </Card>

            {/* Items / Scope */}
            <Card padding="none">
              <div className="p-5 pb-4">
                <h2 className="font-display text-lg font-semibold text-ink-900">Items &amp; Scope</h2>
                <p className="text-xs text-ink-400">Imported from the project BOQ — include, exclude, or mark items optional.</p>
              </div>

              <div className="flex flex-col divide-y divide-ink-100 border-t border-ink-100">
                {roomGroups.map((room) => {
                  const roomItems = quotation.items.filter((i) => i.roomId === room.roomId)
                  const allIncluded = roomItems.every((i) => i.isIncluded)
                  const includedCount = roomItems.filter((i) => i.isIncluded).length

                  return (
                    <div key={room.roomId}>
                      <div className="flex items-center justify-between gap-3 bg-sand-50 px-5 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink-900">{room.roomName}</p>
                          <p className="text-xs text-ink-400">
                            {includedCount}/{roomItems.length} included ·{' '}
                            {formatCurrency(contributingSubtotalByRoom.get(room.roomId) ?? 0)} counted
                          </p>
                        </div>
                        <button
                          onClick={() => setQuotationRoomIncluded(quotation.id, room.roomId, !allIncluded)}
                          className={cn(
                            'h-9 shrink-0 rounded-full border-2 px-3.5 text-xs font-semibold transition-colors',
                            allIncluded
                              ? 'border-sage-500 bg-sage-500/10 text-sage-600'
                              : 'border-ink-200 bg-white text-ink-500',
                          )}
                        >
                          {allIncluded ? 'Room Included' : 'Room Excluded'}
                        </button>
                      </div>

                      {room.categories.map((cat) => (
                        <div key={cat.category}>
                          <p className="bg-sand-50/60 px-5 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
                            {cat.category}
                          </p>
                          <div className="flex flex-col divide-y divide-ink-100">
                            {cat.items.map((item) => {
                              const globalIndex = quotation.items.findIndex((i) => i.id === item.id)
                              return (
                                <div key={item.id} className="flex flex-col gap-2 px-5 py-3.5">
                                  <div className="flex items-start gap-3">
                                    <button
                                      onClick={() =>
                                        updateQuotationItem(quotation.id, item.id, { isIncluded: !item.isIncluded })
                                      }
                                      className={cn(
                                        'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
                                        item.isIncluded
                                          ? 'border-sage-500 bg-sage-500 text-white'
                                          : 'border-ink-200 bg-white',
                                      )}
                                      aria-label={item.isIncluded ? 'Exclude item' : 'Include item'}
                                    >
                                      {item.isIncluded && <Check className="h-4 w-4" />}
                                    </button>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p
                                          className={cn(
                                            'text-sm font-semibold',
                                            item.isIncluded ? 'text-ink-900' : 'text-ink-400 line-through',
                                          )}
                                        >
                                          {item.name}
                                        </p>
                                        {item.isOptional && item.isIncluded && (
                                          <Badge tone="terracotta">Optional</Badge>
                                        )}
                                      </div>
                                      {item.description && (
                                        <p className="truncate text-xs text-ink-400">{item.description}</p>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between gap-2 pl-9">
                                    <p className="text-xs text-ink-500">
                                      {item.quantity} {QUOTATION_UNIT_LABEL[item.unit] ?? item.unit} ×{' '}
                                      {formatCurrency(item.rate)}
                                      {item.rate !== item.sourceRate && (
                                        <span className="ml-1.5 text-terracotta-600">(overridden)</span>
                                      )}
                                    </p>
                                    <p className="text-sm font-semibold text-ink-900">
                                      {formatCurrency(calculateBaseAmount(item.quantity, item.rate, item.unit))}
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-1.5 pl-9">
                                    <button
                                      onClick={() =>
                                        updateQuotationItem(quotation.id, item.id, { isOptional: !item.isOptional })
                                      }
                                      disabled={!item.isIncluded}
                                      className={cn(
                                        'h-8 rounded-full border-2 px-3 text-xs font-semibold transition-colors disabled:opacity-40',
                                        item.isOptional
                                          ? 'border-terracotta-500 bg-terracotta-500/10 text-terracotta-600'
                                          : 'border-ink-100 bg-white text-ink-500 hover:border-ink-300',
                                      )}
                                    >
                                      {item.isOptional ? 'Optional' : 'Mark Optional'}
                                    </button>
                                    <IconButton
                                      label="Edit item"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setEditingItem(item)}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </IconButton>
                                    <IconButton
                                      label="Move item up"
                                      variant="ghost"
                                      size="sm"
                                      disabled={globalIndex === 0}
                                      onClick={() => moveQuotationItem(quotation.id, item.id, 'up')}
                                    >
                                      <ChevronUp className="h-4 w-4" />
                                    </IconButton>
                                    <IconButton
                                      label="Move item down"
                                      variant="ghost"
                                      size="sm"
                                      disabled={globalIndex === quotation.items.length - 1}
                                      onClick={() => moveQuotationItem(quotation.id, item.id, 'down')}
                                    >
                                      <ChevronDown className="h-4 w-4" />
                                    </IconButton>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </Card>

            {/* Pricing */}
            <Card>
              <div className="mb-1 flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-ink-900">Pricing</h2>
                <IconButton label="Edit pricing" variant="ghost" size="sm" onClick={() => setPricingOpen(true)}>
                  <Settings2 className="h-4 w-4" />
                </IconButton>
              </div>
              <PricingSummary breakdown={breakdown} totalLabel="Grand Total" />
            </Card>

            {/* Payment Terms */}
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-ink-900">Payment Schedule</h2>
                <span
                  className={cn(
                    'text-xs font-semibold',
                    milestoneTotalPercent === 100 ? 'text-sage-600' : 'text-terracotta-600',
                  )}
                >
                  {milestoneTotalPercent}% allocated
                </span>
              </div>
              <div className="flex flex-col gap-3">
                {quotation.paymentMilestones.map((milestone) => (
                  <div key={milestone.id} className="rounded-[--radius-md] border border-ink-100 p-3.5">
                    <div className="flex items-start gap-2.5">
                      <div className="flex-1">
                        <Input
                          value={milestone.label}
                          onChange={(e) => updateMilestone(milestone.id, { label: e.target.value })}
                          className="h-11 text-sm font-semibold"
                        />
                      </div>
                      <div className="w-24 shrink-0">
                        <NumberStepper
                          label=""
                          value={milestone.percent}
                          onChange={(v) => updateMilestone(milestone.id, { percent: v })}
                          step={5}
                          suffix="%"
                          className="[&>span]:hidden"
                        />
                      </div>
                      <IconButton
                        label="Remove milestone"
                        variant="danger"
                        size="sm"
                        onClick={() => removeMilestone(milestone.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </div>
                    <input
                      value={milestone.description ?? ''}
                      onChange={(e) => updateMilestone(milestone.id, { description: e.target.value })}
                      placeholder="Description (optional)"
                      className="mt-2 h-9 w-full rounded-[--radius-md] border border-ink-100 bg-sand-50 px-3 text-xs text-ink-600 outline-none focus:border-brass-500"
                    />
                    <p className="mt-1.5 text-right text-xs font-medium text-ink-400">
                      {formatCurrency((breakdown.grandTotal * milestone.percent) / 100)}
                    </p>
                  </div>
                ))}
                <Button variant="outline" size="md" icon={<Plus className="h-4 w-4" />} onClick={addMilestone}>
                  Add Milestone
                </Button>
              </div>
            </Card>

            {/* Terms */}
            <Card>
              <h2 className="mb-4 font-display text-lg font-semibold text-ink-900">Terms &amp; Conditions</h2>
              <div className="flex flex-col gap-2.5">
                {quotation.termsAndConditions.map((term, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className="mt-3 shrink-0 text-xs font-semibold text-ink-400">{index + 1}.</span>
                    <textarea
                      value={term}
                      onChange={(e) => updateTerm(index, e.target.value)}
                      rows={2}
                      className="min-h-11 flex-1 resize-y rounded-[--radius-md] border-2 border-ink-100 bg-sand-50 px-3 py-2.5 text-sm text-ink-700 outline-none focus:border-brass-500"
                    />
                    <IconButton label="Remove term" variant="ghost" size="sm" onClick={() => removeTerm(index)}>
                      <X className="h-4 w-4" />
                    </IconButton>
                  </div>
                ))}
                <Button variant="outline" size="md" icon={<Plus className="h-4 w-4" />} onClick={addTerm}>
                  Add Term
                </Button>
              </div>
            </Card>

            {/* Notes */}
            <Card>
              <h2 className="mb-4 font-display text-lg font-semibold text-ink-900">Notes</h2>
              <Textarea
                placeholder="Internal or client-facing notes for this quotation..."
                value={quotation.notes}
                onChange={(e) => updateQuotation(quotation.id, { notes: e.target.value })}
              />
            </Card>
          </div>
        </div>

        {/* RIGHT: live preview (desktop) — this is the same document the PDF renders from */}
        <div className="hidden flex-col bg-sand-100 lg:flex lg:w-[44%] lg:border-l lg:border-ink-100">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-ink-100 bg-white px-5 py-3 print:hidden">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Live Preview</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="md" icon={<Printer className="h-4 w-4" />} onClick={handlePrint}>
                Print
              </Button>
              <Button
                size="md"
                icon={<Download className="h-4 w-4" />}
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
              >
                {isGeneratingPdf ? 'Preparing…' : 'Download PDF'}
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <QuotationPreview quotation={quotation} />
          </div>
        </div>
      </div>

      {/* Mobile: sticky preview action */}
      <div className="sticky bottom-0 flex shrink-0 items-center justify-between gap-4 border-t border-ink-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-8 lg:hidden print:hidden">
        <div className="min-w-0">
          <p className="text-xs font-medium text-ink-400">Grand Total</p>
          <p className="truncate font-display text-lg font-semibold text-brass-700">
            {formatCurrency(breakdown.grandTotal)}
          </p>
        </div>
        <Button icon={<Eye className="h-5 w-5" />} onClick={() => setPreviewOpen(true)}>
          Preview
        </Button>
      </div>

      {previewOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-sand-100 lg:hidden">
          <div className="flex shrink-0 items-center justify-between gap-1 border-b border-ink-100 bg-white px-5 py-4 print:hidden">
            <p className="truncate font-display text-lg font-semibold text-ink-900">Quotation Preview</p>
            <div className="flex shrink-0 items-center gap-1">
              <IconButton label="Print" variant="ghost" onClick={handlePrint}>
                <Printer className="h-5 w-5" />
              </IconButton>
              <IconButton
                label="Download PDF"
                variant="ghost"
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
              >
                <Download className="h-5 w-5" />
              </IconButton>
              <IconButton label="Close preview" variant="ghost" onClick={() => setPreviewOpen(false)}>
                <X className="h-5 w-5" />
              </IconButton>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <QuotationPreview quotation={quotation} />
          </div>
        </div>
      )}

      <PricingConfigSheet
        open={pricingOpen}
        onClose={() => setPricingOpen(false)}
        pricing={quotation.pricing}
        onSave={(pricing) => updateQuotation(quotation.id, { pricing })}
        subtitle="This quotation's own pricing — independent of the project."
      />

      <QuotationItemEditSheet
        key={editingItem?.id ?? 'none'}
        open={Boolean(editingItem)}
        onClose={() => setEditingItem(undefined)}
        item={editingItem}
        onSave={(updates) => {
          if (editingItem) updateQuotationItem(quotation.id, editingItem.id, updates)
          setEditingItem(undefined)
        }}
      />

      {createPortal(<QuotationPreview quotation={quotation} />, document.getElementById('print-root')!)}
    </div>
  )
}
