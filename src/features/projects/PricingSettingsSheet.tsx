import { useState } from 'react'
import { Sheet, Button, NumberStepper } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useAppStore } from '@/store/useAppStore'
import type { DiscountType, PricingConfig } from '@/types'

const DISCOUNT_OPTIONS: { type: DiscountType; label: string }[] = [
  { type: 'none', label: 'None' },
  { type: 'percentage', label: 'Percentage' },
  { type: 'fixed', label: 'Fixed Amount' },
]

interface PricingSettingsSheetProps {
  open: boolean
  onClose: () => void
  projectId: string
  pricing: PricingConfig
}

export function PricingSettingsSheet({ open, onClose, projectId, pricing }: PricingSettingsSheetProps) {
  const updateProjectPricing = useAppStore((s) => s.updateProjectPricing)

  const [markupPercent, setMarkupPercent] = useState(pricing.markupPercent)
  const [discountType, setDiscountType] = useState<DiscountType>(pricing.discountType)
  const [discountValue, setDiscountValue] = useState(pricing.discountValue)
  const [taxRatePercent, setTaxRatePercent] = useState(pricing.taxRatePercent)

  function handleClose() {
    // Discard any unsaved edits by resetting to the project's current values.
    setMarkupPercent(pricing.markupPercent)
    setDiscountType(pricing.discountType)
    setDiscountValue(pricing.discountValue)
    setTaxRatePercent(pricing.taxRatePercent)
    onClose()
  }

  function handleSave() {
    updateProjectPricing(projectId, {
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
      title="Pricing Settings"
      subtitle="Applies across every room in this project."
      footer={
        <Button fullWidth size="xl" onClick={handleSave}>
          Save Pricing
        </Button>
      }
    >
      <div className="flex flex-col gap-5 py-2">
        <NumberStepper
          label="Markup"
          value={markupPercent}
          onChange={setMarkupPercent}
          step={1}
          suffix="%"
        />

        <div>
          <span className="mb-1.5 block text-sm font-semibold text-ink-700">Discount</span>
          <div className="flex flex-wrap gap-2">
            {DISCOUNT_OPTIONS.map((option) => (
              <button
                key={option.type}
                onClick={() => setDiscountType(option.type)}
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
            suffix={discountType === 'percentage' ? '%' : '₹'}
          />
        )}

        <NumberStepper
          label="GST / Tax Rate"
          value={taxRatePercent}
          onChange={setTaxRatePercent}
          step={1}
          suffix="%"
        />
      </div>
    </Sheet>
  )
}
