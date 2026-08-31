import { useState } from 'react'
import { Sheet, Input, Textarea, Button, Badge } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useAppStore } from '@/store/useAppStore'
import { CATALOGUE_CATEGORIES } from '@/data/catalogue'
import type { CatalogueItem, MeasurementUnit } from '@/types'

const UNIT_OPTIONS: { unit: MeasurementUnit; label: string }[] = [
  { unit: 'sqft', label: 'sqft' },
  { unit: 'rft', label: 'rft' },
  { unit: 'nos', label: 'nos' },
  { unit: 'lump-sum', label: 'lump sum' },
]

interface CatalogueItemSheetProps {
  open: boolean
  onClose: () => void
  editingItem?: CatalogueItem
}

export function CatalogueItemSheet({ open, onClose, editingItem }: CatalogueItemSheetProps) {
  const addCatalogueItem = useAppStore((s) => s.addCatalogueItem)
  const updateCatalogueItem = useAppStore((s) => s.updateCatalogueItem)
  const setCatalogueItemActive = useAppStore((s) => s.setCatalogueItemActive)

  const [name, setName] = useState(editingItem?.name ?? '')
  const [category, setCategory] = useState(editingItem?.category ?? CATALOGUE_CATEGORIES[0])
  const [subCategory, setSubCategory] = useState(editingItem?.subCategory ?? '')
  const [description, setDescription] = useState(editingItem?.description ?? '')
  const [unit, setUnit] = useState<MeasurementUnit>(editingItem?.unit ?? 'sqft')
  const [defaultRate, setDefaultRate] = useState(editingItem?.defaultRate ?? 0)
  const [material, setMaterial] = useState(editingItem?.material ?? '')
  const [finish, setFinish] = useState(editingItem?.finish ?? '')
  const [brand, setBrand] = useState(editingItem?.brand ?? '')

  const isValid = name.trim().length > 1 && defaultRate > 0

  function reset() {
    setName('')
    setCategory(CATALOGUE_CATEGORIES[0])
    setSubCategory('')
    setDescription('')
    setUnit('sqft')
    setDefaultRate(0)
    setMaterial('')
    setFinish('')
    setBrand('')
  }

  function handleClose() {
    if (!editingItem) reset()
    onClose()
  }

  function handleSave() {
    if (!isValid) return
    const payload = {
      name: name.trim(),
      category,
      subCategory: subCategory.trim() || undefined,
      description: description.trim() || undefined,
      unit,
      defaultRate,
      material: material.trim() || undefined,
      finish: finish.trim() || undefined,
      brand: brand.trim() || undefined,
    }
    if (editingItem) {
      updateCatalogueItem(editingItem.id, payload)
    } else {
      addCatalogueItem({ ...payload, isActive: true })
      reset()
    }
    onClose()
  }

  function handleToggleActive() {
    if (!editingItem) return
    setCatalogueItemActive(editingItem.id, !editingItem.isActive)
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      title={editingItem ? 'Edit Catalogue Item' : 'Add Catalogue Item'}
      subtitle={editingItem ? undefined : 'Add a new entry to the studio rate card.'}
      footer={
        <div className="flex flex-col gap-2.5">
          <Button fullWidth size="xl" disabled={!isValid} onClick={handleSave}>
            {editingItem ? 'Save Changes' : 'Add to Catalogue'}
          </Button>
          {editingItem && (
            <Button fullWidth size="lg" variant={editingItem.isActive ? 'outline' : 'secondary'} onClick={handleToggleActive}>
              {editingItem.isActive ? 'Deactivate Item' : 'Reactivate Item'}
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-4 py-2">
        {editingItem && !editingItem.isActive && (
          <Badge tone="neutral" className="w-fit">
            Inactive — hidden from Room Builder
          </Badge>
        )}

        <Input label="Item Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />

        <div>
          <span className="mb-1.5 block text-sm font-semibold text-ink-700">Category</span>
          <div className="flex flex-wrap gap-2">
            {CATALOGUE_CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  'h-9 rounded-full border-2 px-3.5 text-xs font-semibold transition-colors',
                  category === c
                    ? 'border-ink-900 bg-ink-900 text-sand-50'
                    : 'border-ink-100 bg-white text-ink-600 hover:border-ink-300',
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <Input
          label="Sub-category (optional)"
          placeholder="e.g. Sliding, Base Cabinets..."
          value={subCategory}
          onChange={(e) => setSubCategory(e.target.value)}
        />

        <div>
          <span className="mb-1.5 block text-sm font-semibold text-ink-700">Measurement Unit</span>
          <div className="flex flex-wrap gap-2">
            {UNIT_OPTIONS.map((option) => (
              <button
                key={option.unit}
                onClick={() => setUnit(option.unit)}
                className={cn(
                  'h-10 rounded-full border-2 px-4 text-sm font-semibold transition-colors',
                  unit === option.unit
                    ? 'border-ink-900 bg-ink-900 text-sand-50'
                    : 'border-ink-100 bg-white text-ink-600 hover:border-ink-300',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <Input
          label="Default Rate (Master Rate)"
          inputMode="decimal"
          prefix="₹"
          value={defaultRate === 0 ? '' : String(defaultRate)}
          onChange={(e) => setDefaultRate(Number(e.target.value.replace(/[^0-9.]/g, '')) || 0)}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input label="Material" placeholder="e.g. BWP Plywood" value={material} onChange={(e) => setMaterial(e.target.value)} />
          <Input label="Finish" placeholder="e.g. Laminate" value={finish} onChange={(e) => setFinish(e.target.value)} />
        </div>

        <Input
          label="Brand / Vendor (optional)"
          placeholder="e.g. Hettich"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
        />

        <Textarea
          label="Description (optional)"
          placeholder="What this item includes..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
    </Sheet>
  )
}
