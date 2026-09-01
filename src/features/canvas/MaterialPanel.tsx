import { useRef, useState, type RefObject } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/cn'
import { materialsByCategory } from '@/data/materials'
import { getMaterialThumbnailDataUrl } from '@/lib/materialPatterns'
import { fileToDownscaledDataUrl } from '@/lib/imageUtils'
import { MATERIAL_CATEGORIES } from '@/types/materials'
import type { Material, MaterialCategory } from '@/types/materials'
import { AnchoredPopover } from './AnchoredPopover'

// The Material Panel is deliberately catalogue-driven: this file only ever
// reads from data/materials.ts + types/materials.ts and never hard-codes a
// material's look or behaviour itself — a new category or sample material
// added to the catalogue shows up here for free.

interface MaterialPickerContentProps {
  /** Highlights the currently-applied material, when the selection has one. */
  activeMaterialId?: string
  onSelectMaterial: (material: Material) => void
  /** Fired with a downscaled data URI once the user picks a device image via "Use Image". */
  onUseImage: (dataUrl: string) => void
}

export function MaterialPickerContent({ activeMaterialId, onSelectMaterial, onUseImage }: MaterialPickerContentProps) {
  const [category, setCategory] = useState<MaterialCategory>('colour')
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const materials = materialsByCategory(category)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImporting(true)
    try {
      const dataUrl = await fileToDownscaledDataUrl(file)
      onUseImage(dataUrl)
    } catch {
      // An unreadable file just means nothing changes — no crash, no partial fill.
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="flex w-72 flex-col gap-3 sm:w-80">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 no-scrollbar">
        {MATERIAL_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            // See the matching comment on ColorSwatch — this panel nests inside
            // scrollable toolbars/panels, so click-to-focus here would trigger
            // an unwanted scroll of that ancestor.
            onMouseDown={(e) => e.preventDefault()}
            className={cn(
              'h-8 shrink-0 rounded-full border-2 px-3 text-xs font-semibold transition-colors',
              category === c.id ? 'border-ink-900 bg-ink-900 text-sand-50' : 'border-ink-100 text-ink-600',
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto pr-0.5 sm:max-h-72">
        {materials.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelectMaterial(m)}
            onMouseDown={(e) => e.preventDefault()}
            title={m.name}
            className={cn(
              'flex flex-col items-center gap-1 rounded-md border-2 p-1 transition-colors active:scale-95',
              activeMaterialId === m.id ? 'border-brass-500 ring-2 ring-brass-200' : 'border-transparent hover:border-ink-200',
            )}
          >
            <span
              className="h-12 w-full rounded-[--radius-sm] border border-ink-100 bg-cover bg-center"
              style={{ backgroundImage: `url(${getMaterialThumbnailDataUrl(m)})` }}
            />
            <span className="w-full truncate text-center text-[10px] font-medium text-ink-500">{m.name}</span>
          </button>
        ))}
      </div>

      <div className="border-t border-ink-100 pt-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onMouseDown={(e) => e.preventDefault()}
          disabled={importing}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-md border-2 border-dashed border-ink-200 text-xs font-semibold text-ink-600 transition-colors hover:border-ink-400 disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          {importing ? 'Importing…' : 'Use Image'}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
    </div>
  )
}

interface MaterialPickerPopoverProps extends MaterialPickerContentProps {
  onClose: () => void
  anchorRef: RefObject<HTMLElement | null>
  side?: 'right' | 'left'
}

/** Anchored popover for desktop/iPad — portaled + fixed-positioned (see AnchoredPopover for why). */
export function MaterialPickerPopover({ onClose, anchorRef, side, ...contentProps }: MaterialPickerPopoverProps) {
  return (
    <AnchoredPopover anchorRef={anchorRef} onClose={onClose} side={side}>
      <p className="mb-3 font-display text-sm font-semibold text-ink-900">Materials</p>
      <MaterialPickerContent {...contentProps} />
    </AnchoredPopover>
  )
}
