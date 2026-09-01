import { useState } from 'react'
import { Sheet, Button, NumberStepper } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { DiscountType, PricingConfig } from '@/types'

const DISCOUNT_OPTIONS: { type: DiscountType; label: string }[] = [
  { type: 'none', label: 'None' },
  { type: 'percentage', label: 'Percentage' },
  { type: 'fixed', label: 'Fixed Amount' },
]

interface PricingConfigSheetProps {
  open: boolean
  onClose: () => void
  pricing: PricingConfig
  onSave: (pricing: PricingConfig) => void
  title?: string
  subtitle?: string
}

// Shared markup/discount/GST editor — used for a project's own pricing
// config and, independently, for a quotation's own copy of it, so neither
// consumer duplicates the calculation-flow UI.
export function PricingConfigSheet({
  open,
  onClose,
  pricing,
  onSave,
  title = 'Pricing Settings',
  subtitle = 'Subtotal → markup → discount → GST → grand total.',
}: PricingConfigSheetProps) {
  const [markupPercent, setMarkupPercent] = useState(pricing.markupPercent)
  const [discountType, setDiscountType] = useState<DiscountType>(pricing.discountType)
  const [discountValue, setDiscountValue] = useState(pricing.discountValue)
  const [taxRatePercent, setTaxRatePercent] = useState(pricing.taxRatePercent)

  function handleClose() {
    // Discard any unsaved edits by resetting to the current values.
    setMarkupPercent(pricing.markupPercent)
    setDiscountType(pricing.discountType)
    setDiscountValue(pricing.discountValue)
    setTaxRatePercent(pricing.taxRatePercent)
    onClose()
  }

  function handleDiscountTypeChange(type: DiscountType) {
    // discountValue is shared between modes — carrying a fixed ₹ amount
    // over into "percentage" (or vice versa) reads as a wildly different
    // number, so start fresh whenever the type actually changes.
    setDiscountType(type)
    setDiscountValue(0)
  }

  function handleSave() {
    onSave({
      markupPercent,
      discountType,
      discountValue: discountType === 'none' ? 0 : discountValue,
      taxRatePercent,
    })
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      title={title}
      subtitle={subtitle}
      footer={
        <Button fullWidth size="xl" onClick={handleSave}>
          Save Pricing
        </Button>
      }
    >
      <div className="flex flex-col gap-5 py-2">
        <NumberStepper label="Markup" value={markupPercent} onChange={setMarkupPercent} step={1} suffix="%" />

        <div>
          <span className="mb-1.5 block text-sm font-semibold text-ink-700">Discount</span>
          <div className="flex flex-wrap gap-2">
            {DISCOUNT_OPTIONS.map((option) => (
              <button
                key={option.type}
                onClick={() => handleDiscountTypeChange(option.type)}
                className={cn(
                  'h-10 rounded-full border-2 px-4 text-sm font-semibold transition-colors',
                  discountType === option.type
                    ? 'border-ink-900 bg-ink-900 text-sand-50'
                    : 'border-ink-100 bg-white text-ink-600 hover:border-ink-300',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {discountType !== 'none' && (
          <NumberStepper
            label={discountType === 'percentage' ? 'Discount Value' : 'Discount Amount'}
            value={discountValue}
            onChange={setDiscountValue}
            step={discountType === 'percentage' ? 1 : 500}
            max={discountType === 'percentage' ? 100 : undefined}
            suffix={discountType === 'percentage' ? '%' : '₹'}
          />
        )}

        <NumberStepper label="GST / Tax Rate" value={taxRatePercent} onChange={setTaxRatePercent} step={1} suffix="%" />
      </div>
    </Sheet>
  )
}
