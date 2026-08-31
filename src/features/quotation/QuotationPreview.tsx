import { Badge } from '@/components/ui'
import { PricingSummary } from '@/components/pricing/PricingSummary'
import { AuraLogo } from '@/components/brand/AuraLogo'
import {
  groupQuotationItemsByRoom,
  includedQuotationItems,
  optionalItemsSubtotal,
  optionalQuotationItems,
  quotationItemAmount,
  quotationPricingBreakdown,
} from '@/lib/quotation'
import { round2 } from '@/lib/pricing'
import { formatCurrency, formatDate } from '@/lib/format'
import { QUOTATION_STATUS_META } from '@/data/statusMeta'
import type { Quotation } from '@/types'

const UNIT_LABEL: Record<string, string> = {
  sqft: 'sqft',
  rft: 'rft',
  nos: 'nos',
  'lump-sum': 'lump sum',
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-brass-600">{children}</p>
  )
}

export function QuotationPreview({ quotation }: { quotation: Quotation }) {
  const included = includedQuotationItems(quotation.items)
  const optional = optionalQuotationItems(quotation.items)
  const roomGroups = groupQuotationItemsByRoom(included)
  const optionalGroups = groupQuotationItemsByRoom(optional)
  const breakdown = quotationPricingBreakdown(quotation.items, quotation.pricing)
  const optionalTotal = optionalItemsSubtotal(quotation.items)
  const statusMeta = QUOTATION_STATUS_META[quotation.status]

  return (
    <div className="mx-auto w-full max-w-2xl bg-white px-6 py-8 sm:px-10 sm:py-10">
      {/* Letterhead */}
      <div className="flex flex-col gap-4 border-b-2 border-ink-900 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <AuraLogo />
        <div className="sm:text-right">
          <p className="font-display text-2xl font-semibold text-ink-900">QUOTATION</p>
          <p className="mt-0.5 text-sm font-semibold text-brass-600">
            {quotation.quotationNumber}
            {quotation.revision > 1 ? ` · Rev ${quotation.revision}` : ''}
          </p>
          <div className="mt-2 flex items-center gap-2 sm:justify-end">
            <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
          </div>
        </div>
      </div>

      {/* Meta + client */}
      <div className="grid grid-cols-1 gap-6 border-b border-ink-100 py-6 sm:grid-cols-2">
        <div>
          <SectionLabel>Client</SectionLabel>
          <p className="font-display text-lg font-semibold text-ink-900">{quotation.clientName}</p>
          <p className="mt-1 text-sm text-ink-600">{quotation.projectName}</p>
          <p className="text-sm text-ink-500">{quotation.projectLocation}</p>
        </div>
        <div className="sm:text-right">
          <SectionLabel>Details</SectionLabel>
          <p className="text-sm text-ink-600">
            Date: <span className="font-semibold text-ink-900">{formatDate(quotation.issueDate)}</span>
          </p>
          <p className="text-sm text-ink-600">
            Valid Until: <span className="font-semibold text-ink-900">{formatDate(quotation.validUntil)}</span>
          </p>
        </div>
      </div>

      {/* Scope by room */}
      <div className="py-6">
        <SectionLabel>Scope of Work</SectionLabel>
        {roomGroups.length === 0 ? (
          <p className="text-sm text-ink-400">No items included yet.</p>
        ) : (
          <div className="flex flex-col gap-5">
            {roomGroups.map((room) => (
              <div key={room.roomId}>
                <div className="flex items-baseline justify-between border-b border-ink-200 pb-1.5">
                  <h3 className="font-display text-base font-semibold text-ink-900">{room.roomName}</h3>
                  <span className="text-sm font-semibold text-ink-700">{formatCurrency(room.subtotal)}</span>
                </div>
                <div className="mt-1.5 flex flex-col">
                  {room.categories.map((cat) =>
                    cat.items.map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-3 py-1.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-ink-800">{item.name}</p>
                          {item.description && (
                            <p className="text-xs text-ink-400">{item.description}</p>
                          )}
                        </div>
                        <span className="w-20 shrink-0 text-right text-xs text-ink-500">
                          {item.quantity} {UNIT_LABEL[item.unit] ?? item.unit}
                        </span>
                        <span className="w-24 shrink-0 text-right text-sm font-semibold text-ink-900">
                          {formatCurrency(quotationItemAmount(item))}
                        </span>
                      </div>
                    )),
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Optional items */}
      {optionalGroups.length > 0 && (
        <div className="border-t border-dashed border-ink-200 py-6">
          <SectionLabel>Optional Items (not included in grand total)</SectionLabel>
          <div className="flex flex-col gap-5">
            {optionalGroups.map((room) => (
              <div key={room.roomId}>
                <div className="flex items-baseline justify-between border-b border-ink-100 pb-1.5">
                  <h3 className="text-sm font-semibold text-ink-700">{room.roomName}</h3>
                  <span className="text-sm font-semibold text-ink-500">{formatCurrency(room.subtotal)}</span>
                </div>
                <div className="mt-1.5 flex flex-col">
                  {room.categories.map((cat) =>
                    cat.items.map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-3 py-1.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-ink-600">{item.name}</p>
                        </div>
                        <span className="w-20 shrink-0 text-right text-xs text-ink-400">
                          {item.quantity} {UNIT_LABEL[item.unit] ?? item.unit}
                        </span>
                        <span className="w-24 shrink-0 text-right text-sm font-medium text-ink-600">
                          {formatCurrency(quotationItemAmount(item))}
                        </span>
                      </div>
                    )),
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-ink-100 pt-2 text-sm">
            <span className="font-semibold text-ink-600">Optional Items Total</span>
            <span className="font-semibold text-ink-700">{formatCurrency(optionalTotal)}</span>
          </div>
        </div>
      )}

      {/* Pricing summary */}
      <div className="border-t border-ink-100 py-6">
        <SectionLabel>Pricing Summary</SectionLabel>
        <PricingSummary breakdown={breakdown} totalLabel="Grand Total" />
      </div>

      {/* Payment schedule */}
      {quotation.paymentMilestones.length > 0 && (
        <div className="border-t border-ink-100 py-6">
          <SectionLabel>Payment Schedule</SectionLabel>
          <div className="flex flex-col divide-y divide-ink-100">
            {quotation.paymentMilestones.map((milestone) => (
              <div key={milestone.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-800">
                    {milestone.label} <span className="font-normal text-ink-400">({milestone.percent}%)</span>
                  </p>
                  {milestone.description && <p className="text-xs text-ink-400">{milestone.description}</p>}
                </div>
                <span className="shrink-0 text-sm font-semibold text-ink-900">
                  {formatCurrency(round2(breakdown.grandTotal * (milestone.percent / 100)))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Terms */}
      {quotation.termsAndConditions.length > 0 && (
        <div className="border-t border-ink-100 py-6">
          <SectionLabel>Terms &amp; Conditions</SectionLabel>
          <ol className="flex flex-col gap-1.5">
            {quotation.termsAndConditions.map((term, index) => (
              <li key={index} className="flex gap-2 text-sm text-ink-600">
                <span className="shrink-0 text-ink-400">{index + 1}.</span>
                <span>{term}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Notes */}
      {quotation.notes.trim().length > 0 && (
        <div className="border-t border-ink-100 py-6">
          <SectionLabel>Notes</SectionLabel>
          <p className="whitespace-pre-line text-sm text-ink-600">{quotation.notes}</p>
        </div>
      )}

      {/* Footer */}
      <div className="border-t-2 border-ink-900 pt-6 text-center">
        <p className="font-display text-base font-semibold text-ink-900">{quotation.company.name}</p>
        <p className="mt-1 text-xs text-ink-500">
          {quotation.company.address} · {quotation.company.phone} · {quotation.company.email}
        </p>
        <p className="text-xs text-ink-400">
          {quotation.company.website} · GSTIN {quotation.company.gstin}
        </p>
      </div>
    </div>
  )
}
