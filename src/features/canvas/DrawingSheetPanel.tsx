import { Download } from 'lucide-react'
import { Button, Input, Sheet, Textarea } from '@/components/ui'
import type { CanvasEngine, CanvasEngineSnapshot } from '@/lib/canvasEngine'
import { formatLength } from '@/lib/units'
import type { DrawingScale, DrawingSheetSize } from '@/types/canvas'
import { DEFAULT_SHEET_META } from '@/types/canvas'
import { cn } from '@/lib/cn'

const SHEET_SIZES: DrawingSheetSize[] = ['A4', 'A3']
const SCALES: DrawingScale[] = ['1:10', '1:20', '1:25', '1:50']

interface DrawingSheetPanelProps {
  engine: CanvasEngine
  snapshot: CanvasEngineSnapshot
  open: boolean
  onClose: () => void
  context: { projectName: string; clientName: string; roomName: string }
}

/**
 * AURA CANVAS V3D — lightweight drawing-sheet / title-block preparation
 * (spec sections 10-13). Not a desktop-publishing editor: a handful of
 * fields, a sheet size, a labelled scale, and one export action. Project /
 * client / room / drawing type / date / units are derived from existing
 * app data rather than re-entered — only the fields a drafter actually
 * fills in by hand (title, drawing no., revision, notes) are editable here.
 */
export function DrawingSheetPanel({ engine, snapshot, open, onClose, context }: DrawingSheetPanelProps) {
  const sheet = snapshot.settings.sheet ?? DEFAULT_SHEET_META
  const drawingType = snapshot.viewId === 'plan' ? 'Plan' : `Elevation — ${snapshot.elevation?.wallLabel ?? ''}`
  const wallSize = snapshot.elevation ? `${formatLength(snapshot.elevation.wallWidthMm, snapshot.settings.unit)} × ${formatLength(snapshot.elevation.wallHeightMm, snapshot.settings.unit)}` : null

  function handleExport() {
    const url = engine.exportSheetPNG(context)
    if (!url) return
    const link = document.createElement('a')
    link.href = url
    const safeTitle = (sheet.drawingTitle || drawingType).replace(/\s+/g, '-')
    link.download = `${context.roomName.replace(/\s+/g, '-')}-${safeTitle}-sheet.png`
    link.click()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Drawing Sheet"
      subtitle={`${drawingType}${wallSize ? ` · ${wallSize}` : ''}`}
      footer={
        <Button onClick={handleExport} className="w-full">
          <Download className="h-4 w-4" />
          Export Sheet ({sheet.size})
        </Button>
      }
    >
      <div className="flex flex-col gap-5 pb-2">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-[--radius-lg] bg-sand-50 p-4 text-sm">
          <InfoRow label="Project" value={context.projectName} />
          <InfoRow label="Client" value={context.clientName || '—'} />
          <InfoRow label="Room" value={context.roomName} />
          <InfoRow label="Drawing Type" value={drawingType} />
          <InfoRow label="Date" value={new Date().toLocaleDateString()} />
          <InfoRow label="Units" value={snapshot.settings.unit} />
        </div>

        <Input label="Drawing Title" placeholder={drawingType} value={sheet.drawingTitle} onChange={(e) => engine.setSheetMeta({ drawingTitle: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Drawing No." placeholder="DWG-001" value={sheet.drawingNumber} onChange={(e) => engine.setSheetMeta({ drawingNumber: e.target.value })} />
          <Input label="Revision" placeholder="A" value={sheet.revision} onChange={(e) => engine.setSheetMeta({ revision: e.target.value })} />
        </div>

        <div>
          <p className="mb-1.5 text-sm font-semibold text-ink-700">Sheet Size</p>
          <div className="flex gap-2">
            {SHEET_SIZES.map((size) => (
              <button
                key={size}
                onClick={() => engine.setSheetMeta({ size })}
                className={cn(
                  'h-11 flex-1 rounded-[--radius-md] border-2 text-sm font-semibold transition-colors',
                  sheet.size === size ? 'border-ink-900 bg-ink-900 text-sand-50' : 'border-ink-100 text-ink-600',
                )}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-sm font-semibold text-ink-700">Scale</p>
          <div className="grid grid-cols-4 gap-2">
            {SCALES.map((scale) => (
              <button
                key={scale}
                onClick={() => engine.setSheetMeta({ scale })}
                className={cn(
                  'h-11 rounded-[--radius-md] border-2 text-sm font-semibold transition-colors',
                  sheet.scale === scale ? 'border-ink-900 bg-ink-900 text-sand-50' : 'border-ink-100 text-ink-600',
                )}
              >
                {scale}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-ink-400">Scale is a print/export label only — Canvas geometry always stays real-world millimetres.</p>
        </div>

        <Textarea label="Notes" placeholder="e.g. All dimensions to be verified on site." value={sheet.notes} onChange={(e) => engine.setSheetMeta({ notes: e.target.value })} />
      </div>
    </Sheet>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</p>
      <p className="truncate font-semibold text-ink-800">{value}</p>
    </div>
  )
}
