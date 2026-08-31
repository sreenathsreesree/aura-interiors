import { useMemo, useState } from 'react'
import { Search, Package } from 'lucide-react'
import { Sheet, Input, Button, NumberStepper } from '@/components/ui'
import { cn } from '@/lib/cn'
import { ITEM_CATALOG } from '@/data/itemCatalog'
import type { CatalogItem } from '@/data/itemCatalog'
import type { ItemUnit, RoomItem } from '@/types'
import { formatCurrency } from '@/lib/format'

const UNIT_LABEL: Record<ItemUnit, string> = {
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
  const [query, setQuery] = useState('')
  const [name, setName] = useState(initialItem?.name ?? '')
  const [category, setCategory] = useState(initialItem?.category ?? 'Custom')
  const [unit, setUnit] = useState<ItemUnit>(initialItem?.unit ?? 'sqft')
  const [quantity, setQuantity] = useState(initialItem?.quantity ?? 1)
  const [rate, setRate] = useState(initialItem?.rate ?? 0)
  const [showCatalog, setShowCatalog] = useState(!initialItem)

  const filteredCatalog = useMemo(() => {
    if (!query.trim()) return ITEM_CATALOG
    return ITEM_CATALOG.filter((item) => item.name.toLowerCase().includes(query.toLowerCase()))
  }, [query])

  function reset() {
    setQuery('')
    setName('')
    setCategory('Custom')
    setUnit('sqft')
    setQuantity(1)
    setRate(0)
    setShowCatalog(true)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function pickCatalogItem(item: CatalogItem) {
    setName(item.name)
    setCategory(item.category)
    setUnit(item.unit)
    setRate(item.defaultRate)
    setQuantity(1)
    setShowCatalog(false)
  }

  function handleSave() {
    if (!name.trim() || rate <= 0) return
    onSave({ name: name.trim(), category, unit, quantity, rate })
    reset()
    onClose()
  }

  const amount = quantity * rate
  const isValid = name.trim().length > 0 && rate > 0 && quantity > 0

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      title={initialItem ? 'Edit Item' : 'Add Item'}
      subtitle={showCatalog ? 'Pick from the rate catalog or add a custom line item.' : undefined}
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
              placeholder="Search rate catalog..."
              className="h-13 w-full rounded-[--radius-md] border-2 border-ink-100 bg-white pl-12 pr-4 text-base outline-none focus:border-brass-500"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            {filteredCatalog.map((item) => (
              <button
                key={item.id}
                onClick={() => pickCatalogItem(item)}
                className="flex items-center justify-between gap-3 rounded-[--radius-md] border-2 border-ink-100 bg-white px-4 py-3 text-left transition-colors hover:border-brass-400 hover:bg-brass-500/5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-900">{item.name}</p>
                  <p className="text-xs text-ink-500">{item.category}</p>
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
              {(Object.keys(UNIT_LABEL) as ItemUnit[]).map((u) => (
                <button
                  key={u}
                  onClick={() => setUnit(u)}
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

          <div className="grid grid-cols-2 gap-3">
            <NumberStepper
              label="Quantity"
              value={quantity}
              onChange={setQuantity}
              step={unit === 'nos' ? 1 : 0.5}
              suffix={UNIT_LABEL[unit]}
            />
            <Input
              label="Rate"
              inputMode="decimal"
              prefix="₹"
              value={rate === 0 ? '' : String(rate)}
              onChange={(e) => setRate(Number(e.target.value.replace(/[^0-9.]/g, '')) || 0)}
            />
          </div>

          {!initialItem && (
            <button
              onClick={() => setShowCatalog(true)}
              className="text-left text-sm font-semibold text-brass-600 hover:text-brass-700"
            >
              ← Back to catalog
            </button>
          )}
        </div>
      )}
    </Sheet>
  )
}
