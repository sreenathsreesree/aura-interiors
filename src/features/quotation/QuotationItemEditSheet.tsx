import { useState } from 'react'
import { Sheet, Input, Textarea, Button, NumberStepper, Badge } from '@/components/ui'
import { cn } from '@/lib/cn'
import { calculateBaseAmount } from '@/lib/pricing'
import { formatCurrency } from '@/lib/format'
import type { MeasurementUnit, QuotationItem } from '@/types'

const UNIT_LABEL: Record<MeasurementUnit, string> = {
  sqft: 'sqft',
  rft: 'rft',
  nos: 'nos',
  'lump-sum': 'lump sum',
}

interface QuotationItemEditSheetProps {
  open: boolean
  onClose: () => void
  item?: QuotationItem
  onSave: (updates: Partial<Omit<QuotationItem, 'id'>>) => void
}

export function QuotationItemEditSheet({ open, onClose, item, onSave }: QuotationItemEditSheetProps) {
  const [name, setName] = useState(item?.name ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [unit, setUnit] = useState<MeasurementUnit>(item?.unit ?? 'sqft')
  const [quantity, setQuantity] = useState(item?.quantity ?? 1)
  const [rate, setRate] = useState(item?.rate ?? 0)

  if (!item) return null

  const amount = calculateBaseAmount(quantity, rate, unit)
  const isValid = name.trim().length > 0 && rate > 0 && (unit === 'lump-sum' || quantity > 0)
  const isRateOverridden = rate !== item.sourceRate

  function handleUnitChange(nextUnit: MeasurementUnit) {
    setUnit(nextUnit)
    if (nextUnit === 'lump-sum') setQuantity(1)
  }

  function handleSave() {
    if (!isValid) return
    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      unit,
      quantity,
      rate,
    })
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Edit Quotation Item"
      subtitle={`${item.roomName} · ${item.category}`}
      footer={
        <div>
          <div className="mb-3 flex items-center justify-between rounded-[--radius-md] bg-sand-100 px-4 py-3">
            <span className="text-sm font-semibold text-ink-600">Amount</span>
            <span className="font-display text-lg font-semibold text-ink-900">{formatCurrency(amount)}</span>
          </div>
          <Button fullWidth size="xl" disabled={!isValid} onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 py-2">
        <Input
          label="Client-Facing Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />

        <Textarea
          label="Description (optional)"
          placeholder="Spec or note shown to the client..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div>
          <span className="mb-1.5 block text-sm font-semibold text-ink-700">Unit</span>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(UNIT_LABEL) as MeasurementUnit[]).map((u) => (
              <button
                key={u}
                onClick={() => handleUnitChange(u)}
                className={cn(
                  'h-10 rounded-full border-2 px-4 text-sm font-semibold transition-colors',
                  unit === u
                    ? 'border-ink-900 bg-ink-900 text-sand-50'
                    : 'border-ink-100 bg-white text-ink-600 hover:border-ink-300',
                )}
              >
                {UNIT_LABEL[u]}
              </button>
            ))}
          </div>
        </div>

        {unit === 'lump-sum' ? (
          <div className="rounded-[--radius-md] bg-sand-100 px-4 py-3 text-sm text-ink-500">
            Lump sum items are billed as a single flat amount, regardless of quantity.
          </div>
        ) : (
          <NumberStepper
            label="Quantity"
            value={quantity}
            onChange={setQuantity}
            step={unit === 'nos' ? 1 : 0.5}
            suffix={UNIT_LABEL[unit]}
          />
        )}

        <div className="flex items-center justify-between rounded-[--radius-md] border border-ink-100 bg-sand-50 px-4 py-3">
          <span className="text-sm text-ink-500">Project Rate</span>
          <span className="text-sm font-semibold text-ink-600">
            {formatCurrency(item.sourceRate)}/{UNIT_LABEL[unit]}
          </span>
        </div>

        <Input
          label="Quotation Rate"
          hint="Overrides the project rate for this quotation only — the project item is unchanged."
          inputMode="decimal"
          prefix="₹"
          value={rate === 0 ? '' : String(rate)}
          onChange={(e) => setRate(Number(e.target.value.replace(/[^0-9.]/g, '')) || 0)}
        />
        {isRateOverridden && (
          <Badge tone="terracotta" className="-mt-2 w-fit">
            Custom quotation rate — differs from project
          </Badge>
        )}
      </div>
    </Sheet>
  )
}
