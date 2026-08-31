import { useMemo, useState } from 'react'
import { Search, Package, Info } from 'lucide-react'
import { Sheet, Input, Textarea, Button, NumberStepper, Badge } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useAppStore } from '@/store/useAppStore'
import { useShallow } from 'zustand/react/shallow'
import { calculateBaseAmount } from '@/lib/pricing'
import type { CatalogueItem, MeasurementUnit, RoomItem } from '@/types'
import { formatCurrency } from '@/lib/format'

const UNIT_LABEL: Record<MeasurementUnit, string> = {
  sqft: 'sqft',
  rft: 'rft',
  nos: 'nos',
  'lump-sum': 'lump sum',
}

interface AddItemSheetProps {
  open: boolean
  onClose: () => void
  onSave: (item: Omit<RoomItem, 'id'>) => void
  initialItem?: RoomItem
}

export function AddItemSheet({ open, onClose, onSave, initialItem }: AddItemSheetProps) {
  const activeCatalogueItems = useAppStore(
    useShallow((s) => s.catalogueItems.filter((c) => c.isActive)),
  )

  const [query, setQuery] = useState('')
  const [catalogueItemId, setCatalogueItemId] = useState(initialItem?.catalogueItemId)
  const [name, setName] = useState(initialItem?.name ?? '')
  const [category, setCategory] = useState(initialItem?.category ?? 'Custom')
  const [description, setDescription] = useState(initialItem?.description ?? '')
  const [unit, setUnit] = useState<MeasurementUnit>(initialItem?.unit ?? 'sqft')
  const [quantity, setQuantity] = useState(initialItem?.quantity ?? 1)
  const [masterRate, setMasterRate] = useState(initialItem?.masterRate ?? 0)
  const [rate, setRate] = useState(initialItem?.rate ?? 0)
  const [showCatalog, setShowCatalog] = useState(!initialItem)

  const filteredCatalog = useMemo(() => {
    if (!query.trim()) return activeCatalogueItems
    return activeCatalogueItems.filter((item) =>
      item.name.toLowerCase().includes(query.toLowerCase()),
    )
  }, [activeCatalogueItems, query])

  function reset() {
    setQuery('')
    setCatalogueItemId(undefined)
    setName('')
    setCategory('Custom')
    setDescription('')
    setUnit('sqft')
    setQuantity(1)
    setMasterRate(0)
    setRate(0)
    setShowCatalog(true)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function pickCatalogueItem(item: CatalogueItem) {
    setCatalogueItemId(item.id)
    setName(item.name)
    setCategory(item.category)
    setDescription(item.description ?? '')
    setUnit(item.unit)
    setMasterRate(item.defaultRate)
    setRate(item.defaultRate)
    setQuantity(1)
    setShowCatalog(false)
  }

  function handleUnitChange(nextUnit: MeasurementUnit) {
    setUnit(nextUnit)
    if (nextUnit === 'lump-sum') setQuantity(1)
  }

  function handleSave() {
    if (!name.trim() || rate <= 0) return
    onSave({
      catalogueItemId,
      name: name.trim(),
      category,
      description: description.trim() || undefined,
      unit,
      quantity,
      masterRate: catalogueItemId ? masterRate : rate,
      rate,
    })
    reset()
    onClose()
  }

  const amount = calculateBaseAmount(quantity, rate, unit)
  const isValid = name.trim().length > 0 && rate > 0 && (unit === 'lump-sum' || quantity > 0)
  const isRateOverridden = Boolean(catalogueItemId) && rate !== masterRate

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      title={initialItem ? 'Edit Item' : 'Add Item'}
      subtitle={showCatalog ? 'Pick from the rate catalogue or add a custom line item.' : undefined}
      footer={
        <div>
          {!showCatalog && (
            <div className="mb-3 flex items-center justify-between rounded-[--radius-md] bg-sand-100 px-4 py-3">
              <span className="text-sm font-semibold text-ink-600">Amount</span>
              <span className="font-display text-lg font-semibold text-ink-900">
                {formatCurrency(amount)}
              </span>
            </div>
          )}
          {!showCatalog && (
            <Button fullWidth size="xl" disabled={!isValid} onClick={handleSave}>
              {initialItem ? 'Save Changes' : 'Add to Room'}
            </Button>
          )}
        </div>
      }
    >
      {showCatalog ? (
        <div className="flex flex-col gap-3 py-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search rate catalogue..."
              className="h-13 w-full rounded-[--radius-md] border-2 border-ink-100 bg-white pl-12 pr-4 text-base outline-none focus:border-brass-500"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            {filteredCatalog.map((item) => (
              <button
                key={item.id}
                onClick={() => pickCatalogueItem(item)}
                className="flex items-center justify-between gap-3 rounded-[--radius-md] border-2 border-ink-100 bg-white px-4 py-3 text-left transition-colors hover:border-brass-400 hover:bg-brass-500/5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-900">{item.name}</p>
                  <p className="text-xs text-ink-500">
                    {item.category}
                    {item.subCategory ? ` · ${item.subCategory}` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-brass-600">
                  {formatCurrency(item.defaultRate)}/{UNIT_LABEL[item.unit]}
                </span>
              </button>
            ))}
            {filteredCatalog.length === 0 && (
              <p className="py-4 text-center text-sm text-ink-400">No matches — add a custom item below.</p>
            )}
          </div>

          <button
            onClick={() => setShowCatalog(false)}
            className="mt-1 flex items-center justify-center gap-2 rounded-[--radius-md] border-2 border-dashed border-ink-200 py-3.5 text-sm font-semibold text-ink-600 hover:border-ink-400 hover:bg-sand-50"
          >
            <Package className="h-4 w-4" />
            Add a Custom Item
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 py-2">
          <Input label="Item Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />

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

          {catalogueItemId && (
            <div className="flex items-center justify-between rounded-[--radius-md] border border-ink-100 bg-sand-50 px-4 py-3">
              <div className="flex items-center gap-1.5 text-sm text-ink-500">
                <Info className="h-4 w-4 shrink-0" />
                Master Rate
              </div>
              <span className="text-sm font-semibold text-ink-600">
                {formatCurrency(masterRate)}/{UNIT_LABEL[unit]}
              </span>
            </div>
          )}

          <Input
            label={catalogueItemId ? 'Project Rate' : 'Rate'}
            hint={catalogueItemId ? 'Overrides the catalogue rate for this project only.' : undefined}
            inputMode="decimal"
            prefix="₹"
            value={rate === 0 ? '' : String(rate)}
            onChange={(e) => setRate(Number(e.target.value.replace(/[^0-9.]/g, '')) || 0)}
          />
          {isRateOverridden && (
            <Badge tone="terracotta" className="-mt-2 w-fit">
              Custom rate — differs from master
            </Badge>
          )}

          <Textarea
            label="Description (optional)"
            placeholder="Spec or note that will appear on the BOQ..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          {!initialItem && (
            <button
              onClick={() => setShowCatalog(true)}
              className="text-left text-sm font-semibold text-brass-600 hover:text-brass-700"
            >
              ← Back to catalogue
            </button>
          )}
        </div>
      )}
    </Sheet>
  )
}
