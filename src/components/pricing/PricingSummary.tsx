import type { PricingBreakdown } from '@/lib/pricing'
import { formatCurrency, formatPercent } from '@/lib/format'
import { cn } from '@/lib/cn'

interface PricingSummaryProps {
  breakdown: PricingBreakdown
  totalLabel: string
  className?: string
  /** Compact drops the taxable-amount subtotal row — used inside the Room Builder to keep it lightweight. */
  compact?: boolean
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className={cn('font-medium', muted ? 'text-ink-400' : 'text-ink-600')}>{label}</span>
      <span className={cn('font-semibold tabular-nums', muted ? 'text-ink-400' : 'text-ink-800')}>
        {value}
      </span>
    </div>
  )
}

export function PricingSummary({ breakdown, totalLabel, className, compact }: PricingSummaryProps) {
  const hasDiscount = breakdown.discountAmount > 0

  return (
    <div className={cn('flex flex-col', className)}>
      <Row label="Subtotal" value={formatCurrency(breakdown.subtotal)} />
      <Row
        label={`Markup (${formatPercent(breakdown.markupPercent)})`}
        value={`+ ${formatCurrency(breakdown.markupAmount)}`}
        muted
      />
      {hasDiscount && (
        <Row
          label={
            breakdown.discountType === 'percentage'
              ? `Discount (${formatPercent(breakdown.discountValue)})`
              : 'Discount'
          }
          value={`− ${formatCurrency(breakdown.discountAmount)}`}
          muted
        />
      )}
      {!compact && <Row label="Taxable Amount" value={formatCurrency(breakdown.taxableAmount)} muted />}
      <Row
        label={`GST (${formatPercent(breakdown.taxRatePercent)})`}
        value={`+ ${formatCurrency(breakdown.taxAmount)}`}
        muted
      />
      <div className="mt-1.5 flex items-center justify-between border-t border-ink-100 pt-2.5">
        <span className="text-sm font-semibold text-ink-900">{totalLabel}</span>
        <span className="font-display text-lg font-semibold text-brass-700">
          {formatCurrency(breakdown.grandTotal)}
        </span>
      </div>
    </div>
  )
}
