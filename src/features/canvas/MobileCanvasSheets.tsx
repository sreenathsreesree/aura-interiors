import { useRef, useState } from 'react'
import {
  ClipboardPaste,
  Copy,
  CopyPlus,
  Eye,
  EyeOff,
  FlipHorizontal,
  Grid3x3,
  Group,
  Lock,
  LockOpen,
  Magnet,
  Palette,
  Pipette,
  Repeat2,
  RotateCw,
  Trash2,
  Ungroup,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { Sheet } from '@/components/ui'
import type { CanvasEngine, CanvasEngineSnapshot } from '@/lib/canvasEngine'
import { getMaterialThumbnailDataUrl } from '@/lib/materialPatterns'
import { DRAW_TOOLS } from './CanvasToolbars'
import { ColorPickerContent } from './ColorPicker'
import { DuplicateOffsetPopup } from './DuplicateOffsetPopup'
import { MaterialPickerContent } from './MaterialPanel'
import { PropertyPanel } from './PropertyPanel'

interface Props {
  engine: CanvasEngine
  snapshot: CanvasEngineSnapshot
  open: boolean
  onClose: () => void
}

/** iPhone: the full left-toolbar content reflowed into a touch-friendly grid inside a sheet. */
export function MobileToolSheet({ engine, snapshot, open, onClose }: Props) {
  const [fillOpen, setFillOpen] = useState(false)
  const [materialOpen, setMaterialOpen] = useState(false)
  const [offsetOpen, setOffsetOpen] = useState(false)
  const offsetAnchorRef = useRef<HTMLDivElement>(null)
  const hasSelection = snapshot.selection.length > 0
  const selectedLocked = snapshot.selectedObjects.some((o) => o.locked)
  const selectedHidden = snapshot.selectedObjects.some((o) => !o.visible)

  return (
    <Sheet open={open} onClose={onClose} title="Tools">
      <div className="flex flex-col gap-5 pb-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Draw</p>
          <div className="grid grid-cols-4 gap-2.5">
            {DRAW_TOOLS.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  engine.setTool(t.id)
                  onClose()
                }}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-[--radius-md] border-2 py-3 text-[11px] font-semibold',
                  snapshot.tool === t.id ? 'border-ink-900 bg-ink-900 text-sand-50' : 'border-ink-100 text-ink-600',
                )}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Paint / Fill</p>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => {
                // setTool() clears the current selection — only arm the
                // paint-bucket when there's nothing selected to recolour instead.
                if (snapshot.selection.length === 0) engine.setTool('fill')
                setFillOpen((v) => !v)
                setMaterialOpen(false)
              }}
              className={cn(
                'flex h-11 items-center gap-2 rounded-full border-2 px-4 text-sm font-semibold',
                snapshot.tool === 'fill' && !snapshot.activeMaterial ? 'border-ink-900 bg-ink-900 text-sand-50' : 'border-ink-100 text-ink-600',
              )}
            >
              <span className="h-5 w-5 rounded-full border border-ink-300" style={{ background: snapshot.activeFill === 'none' ? 'transparent' : snapshot.activeFill }} />
              Fill Color
            </button>
            <button
              onClick={() => {
                if (snapshot.selection.length === 0) engine.setTool('fill')
                setMaterialOpen((v) => !v)
                setFillOpen(false)
              }}
              className={cn(
                'flex h-11 items-center gap-2 rounded-full border-2 px-4 text-sm font-semibold',
                snapshot.tool === 'fill' && snapshot.activeMaterial ? 'border-ink-900 bg-ink-900 text-sand-50' : 'border-ink-100 text-ink-600',
              )}
            >
              {snapshot.activeMaterial ? (
                <span
                  className="h-5 w-5 rounded-full border border-ink-300 bg-cover bg-center"
                  style={{ backgroundImage: `url(${getMaterialThumbnailDataUrl(snapshot.activeMaterial)})` }}
                />
              ) : (
                <Palette className="h-4 w-4" />
              )}
              Materials
            </button>
            <MobileToolChip
              icon={<Pipette className="h-4 w-4" />}
              label="Eyedropper"
              active={snapshot.tool === 'eyedropper'}
              onClick={() => {
                engine.setTool('eyedropper')
                onClose()
              }}
            />
          </div>
          {fillOpen && (
            <div className="mt-3 rounded-[--radius-lg] border border-ink-100 bg-sand-50 p-3.5">
              <ColorPickerContent
                color={snapshot.activeFill}
                opacity={snapshot.activeOpacity}
                recentColors={snapshot.recentColors}
                onChangeColor={(c) => engine.setActiveFill(c)}
                onChangeOpacity={(o) => engine.setActiveOpacity(o)}
              />
            </div>
          )}
          {materialOpen && (
            <div className="mt-3 rounded-[--radius-lg] border border-ink-100 bg-sand-50 p-3.5">
              <MaterialPickerContent
                activeMaterialId={snapshot.activeMaterial?.id}
                onSelectMaterial={(m) => engine.setActiveMaterial(m)}
                onUseImage={(dataUrl) => {
                  if (snapshot.selection.length > 0) engine.setImageFillOnSelection(dataUrl)
                }}
              />
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Grid &amp; Snap</p>
          <div className="flex flex-wrap gap-2.5">
            <MobileToolChip icon={<Grid3x3 className="h-4 w-4" />} label="Grid" active={snapshot.settings.showGrid} onClick={() => engine.toggleGrid()} />
            <MobileToolChip icon={<Magnet className="h-4 w-4" />} label="Snap" active={snapshot.settings.snapToGrid} onClick={() => engine.toggleSnap()} />
            <MobileToolChip label="Ortho" active={snapshot.settings.ortho} onClick={() => engine.toggleOrtho()} />
            <MobileToolChip label={`Unit: ${snapshot.settings.unit}`} onClick={() => engine.cycleUnit()} />
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Actions</p>
          <div className="flex flex-wrap gap-2.5">
            <MobileToolChip icon={<Trash2 className="h-4 w-4" />} label="Delete" disabled={!hasSelection} onClick={() => engine.deleteSelected()} />
            <MobileToolChip icon={<Copy className="h-4 w-4" />} label="Copy" disabled={!hasSelection} onClick={() => engine.copySelection()} />
            <MobileToolChip icon={<ClipboardPaste className="h-4 w-4" />} label="Paste" disabled={snapshot.clipboardCount === 0} onClick={() => engine.pasteClipboard()} />
            <MobileToolChip icon={<CopyPlus className="h-4 w-4" />} label="Duplicate" disabled={!hasSelection} onClick={() => engine.duplicateSelected()} />
            <div ref={offsetAnchorRef} className="relative">
              <MobileToolChip icon={<Repeat2 className="h-4 w-4" />} label="Duplicate with Offset" disabled={!hasSelection} active={offsetOpen} onClick={() => setOffsetOpen((v) => !v)} />
              {offsetOpen && (
                <DuplicateOffsetPopup
                  anchorRef={offsetAnchorRef}
                  onDuplicate={(dx, dy, count) => engine.duplicateWithOffset(dx, dy, count)}
                  onClose={() => setOffsetOpen(false)}
                />
              )}
            </div>
            <MobileToolChip icon={<RotateCw className="h-4 w-4" />} label="Rotate" disabled={!hasSelection} onClick={() => engine.rotateSelectedBy(90)} />
            <MobileToolChip icon={<FlipHorizontal className="h-4 w-4" />} label="Mirror" disabled={!hasSelection} onClick={() => engine.mirrorSelected('horizontal')} />
            <MobileToolChip
              icon={selectedLocked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
              label={selectedLocked ? 'Unlock' : 'Lock'}
              disabled={!hasSelection}
              onClick={() => engine.toggleLockSelected()}
            />
            <MobileToolChip
              icon={selectedHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              label={selectedHidden ? 'Show' : 'Hide'}
              disabled={!hasSelection}
              onClick={() => engine.toggleVisibleSelected()}
            />
            <MobileToolChip icon={<Group className="h-4 w-4" />} label="Group" disabled={snapshot.selection.length < 2} onClick={() => engine.groupSelected()} />
            <MobileToolChip icon={<Ungroup className="h-4 w-4" />} label="Ungroup" disabled={!hasSelection} onClick={() => engine.ungroupSelected()} />
          </div>
        </div>
      </div>
    </Sheet>
  )
}

function MobileToolChip({
  icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon?: React.ReactNode
  label: string
  active?: boolean
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || !onClick}
      className={cn(
        'flex h-10 items-center gap-1.5 rounded-full border-2 px-3.5 text-xs font-semibold transition-colors disabled:opacity-40',
        active ? 'border-ink-900 bg-ink-900 text-sand-50' : 'border-ink-100 text-ink-600',
      )}
    >
      {icon}
      {label}
    </button>
  )
}

export function MobilePropertySheet({ engine, snapshot, open, onClose }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title="Properties">
      <PropertyPanel engine={engine} snapshot={snapshot} className="w-full" />
    </Sheet>
  )
}
