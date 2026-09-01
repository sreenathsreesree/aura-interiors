import { useRef, useState } from 'react'
import {
  ArrowLeft,
  Circle,
  Copy,
  ClipboardPaste,
  CopyPlus,
  Download,
  FlipHorizontal,
  Grid3x3,
  Group,
  Hand,
  Lock,
  LockOpen,
  Magnet,
  Maximize,
  Minus,
  MousePointer2,
  Palette,
  Pentagon,
  PenTool,
  Pipette,
  Redo2,
  RotateCw,
  Ruler,
  Save,
  Scan,
  Spline,
  Square,
  RectangleHorizontal,
  Trash2,
  Type,
  Ungroup,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import type { CanvasEngine, CanvasEngineSnapshot } from '@/lib/canvasEngine'
import { formatDimension } from '@/lib/canvasEngine'
import { getMaterialThumbnailDataUrl } from '@/lib/materialPatterns'
import type { CanvasToolId } from '@/types/canvas'
import { ToolButton } from './ToolButton'
import { ColorPickerPopover } from './ColorPicker'
import { MaterialPickerPopover } from './MaterialPanel'

interface EngineProps {
  engine: CanvasEngine
  snapshot: CanvasEngineSnapshot
}

// ------------------------------------------------------------- Top Bar
export function CanvasTopBar({
  engine,
  snapshot,
  roomName,
  onBack,
  onSave,
  onExport,
  justSaved,
}: EngineProps & { roomName: string; onBack: () => void; onSave: () => void; onExport: () => void; justSaved: boolean }) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-2 border-b border-ink-800 bg-ink-950 px-3 text-sand-50 sm:px-4">
      <ToolButton icon={<ArrowLeft className="h-5 w-5" />} label="Back to Room" onClick={onBack} />
      <div className="min-w-0 px-1">
        <p className="truncate text-sm font-semibold leading-tight">{roomName}</p>
        <p className="text-[11px] leading-tight text-sand-300/70">AURA Canvas</p>
      </div>

      <div className="ml-1 flex shrink-0 items-center gap-1 rounded-full bg-white/5 p-1">
        {(['plan', 'elevation'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => engine.setViewMode(mode)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-colors',
              snapshot.settings.viewMode === mode ? 'bg-brass-500 text-ink-950' : 'text-sand-300 hover:text-sand-50',
            )}
          >
            {mode}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      <div className="hidden items-center gap-1 sm:flex">
        <ToolButton icon={<Undo2 className="h-5 w-5" />} label="Undo" disabled={!snapshot.canUndo} onClick={() => engine.undo()} />
        <ToolButton icon={<Redo2 className="h-5 w-5" />} label="Redo" disabled={!snapshot.canRedo} onClick={() => engine.redo()} />
      </div>

      <button
        onClick={onSave}
        className="ml-1 flex h-10 shrink-0 items-center gap-2 rounded-[--radius-md] bg-white/10 px-3.5 text-sm font-semibold text-sand-50 transition-colors hover:bg-white/20 active:scale-95"
      >
        <Save className="h-4 w-4" />
        <span className="hidden sm:inline">{justSaved ? 'Saved' : 'Save'}</span>
      </button>
      <button
        onClick={onExport}
        className="flex h-10 shrink-0 items-center gap-2 rounded-[--radius-md] bg-brass-500 px-3.5 text-sm font-semibold text-ink-950 transition-colors hover:bg-brass-400 active:scale-95"
      >
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">Export</span>
      </button>
    </div>
  )
}

// -------------------------------------------------------------- shared tool metadata
export const DRAW_TOOLS: { id: CanvasToolId; icon: React.ReactNode; label: string }[] = [
  { id: 'select', icon: <MousePointer2 className="h-5 w-5" />, label: 'Select' },
  { id: 'pan', icon: <Hand className="h-5 w-5" />, label: 'Move / Pan' },
  { id: 'line', icon: <Minus className="h-5 w-5" />, label: 'Line' },
  { id: 'rectangle', icon: <RectangleHorizontal className="h-5 w-5" />, label: 'Rectangle' },
  { id: 'square', icon: <Square className="h-5 w-5" />, label: 'Square' },
  { id: 'circle', icon: <Circle className="h-5 w-5" />, label: 'Circle' },
  { id: 'arc', icon: <Spline className="h-5 w-5" />, label: 'Arc' },
  { id: 'polygon', icon: <Pentagon className="h-5 w-5" />, label: 'Polygon' },
  { id: 'freeDraw', icon: <PenTool className="h-5 w-5" />, label: 'Free Draw' },
  { id: 'text', icon: <Type className="h-5 w-5" />, label: 'Text' },
  { id: 'dimension', icon: <Ruler className="h-5 w-5" />, label: 'Dimension' },
]

// ------------------------------------------------------------- Left Toolbar
export function CanvasLeftToolbar({ engine, snapshot }: EngineProps) {
  const [fillPickerOpen, setFillPickerOpen] = useState(false)
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false)
  const fillAnchorRef = useRef<HTMLDivElement>(null)
  const materialAnchorRef = useRef<HTMLDivElement>(null)
  const hasSelection = snapshot.selection.length > 0
  const selectedLocked = snapshot.selectedObjects.some((o) => o.locked)

  return (
    <div className="flex h-full w-16 shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-ink-800 bg-ink-900 py-3 no-scrollbar">
      {DRAW_TOOLS.map((t) => (
        <ToolButton key={t.id} icon={t.icon} label={t.label} active={snapshot.tool === t.id} onClick={() => engine.setTool(t.id)} />
      ))}

      <div className="my-1.5 h-px w-8 shrink-0 bg-white/10" />

      <div ref={fillAnchorRef} className="relative">
        <ToolButton
          icon={<div className="h-5 w-5 rounded-full border border-white/40" style={{ background: snapshot.activeFill === 'none' ? 'transparent' : snapshot.activeFill }} />}
          label="Fill Color"
          active={snapshot.tool === 'fill' || fillPickerOpen}
          onClick={() => {
            // setTool() clears the current selection (it's a real tool switch
            // for every other case) — but with something already selected, the
            // point of opening this is to recolour it, so arm the paint-bucket
            // only when there's nothing selected to apply to instead.
            if (snapshot.selection.length === 0) engine.setTool('fill')
            setFillPickerOpen((v) => !v)
          }}
        />
        {fillPickerOpen && (
          <ColorPickerPopover
            anchorRef={fillAnchorRef}
            title="Fill Color"
            color={snapshot.activeFill}
            opacity={snapshot.activeOpacity}
            recentColors={snapshot.recentColors}
            onChangeColor={(c) => engine.setActiveFill(c)}
            onChangeOpacity={(o) => engine.setActiveOpacity(o)}
            onClose={() => setFillPickerOpen(false)}
          />
        )}
      </div>
      <div ref={materialAnchorRef} className="relative">
        <ToolButton
          icon={
            snapshot.activeMaterial ? (
              <span
                className="h-5 w-5 rounded-full border border-white/40 bg-cover bg-center"
                style={{ backgroundImage: `url(${getMaterialThumbnailDataUrl(snapshot.activeMaterial)})` }}
              />
            ) : (
              <Palette className="h-5 w-5" />
            )
          }
          label="Materials"
          active={(snapshot.tool === 'fill' && Boolean(snapshot.activeMaterial)) || materialPickerOpen}
          onClick={() => {
            // See the matching comment on Fill Color above.
            if (snapshot.selection.length === 0) engine.setTool('fill')
            setMaterialPickerOpen((v) => !v)
          }}
        />
        {materialPickerOpen && (
          <MaterialPickerPopover
            anchorRef={materialAnchorRef}
            activeMaterialId={snapshot.activeMaterial?.id}
            onSelectMaterial={(m) => engine.setActiveMaterial(m)}
            onUseImage={(dataUrl) => {
              if (snapshot.selection.length > 0) engine.setImageFillOnSelection(dataUrl)
            }}
            onClose={() => setMaterialPickerOpen(false)}
          />
        )}
      </div>
      <ToolButton icon={<Pipette className="h-5 w-5" />} label="Eyedropper" active={snapshot.tool === 'eyedropper'} onClick={() => engine.setTool('eyedropper')} />

      <div className="my-1.5 h-px w-8 shrink-0 bg-white/10" />

      <ToolButton icon={<Trash2 className="h-5 w-5" />} label="Delete" disabled={!hasSelection} onClick={() => engine.deleteSelected()} />
      <ToolButton icon={<Copy className="h-5 w-5" />} label="Copy" disabled={!hasSelection} onClick={() => engine.copySelection()} />
      <ToolButton icon={<ClipboardPaste className="h-5 w-5" />} label="Paste" disabled={snapshot.clipboardCount === 0} onClick={() => engine.pasteClipboard()} />
      <ToolButton icon={<CopyPlus className="h-5 w-5" />} label="Duplicate" disabled={!hasSelection} onClick={() => engine.duplicateSelected()} />
      <ToolButton icon={<RotateCw className="h-5 w-5" />} label="Rotate 90°" disabled={!hasSelection} onClick={() => engine.rotateSelectedBy(90)} />
      <ToolButton icon={<FlipHorizontal className="h-5 w-5" />} label="Mirror" disabled={!hasSelection} onClick={() => engine.mirrorSelected('horizontal')} />
      <ToolButton
        icon={selectedLocked ? <Lock className="h-5 w-5" /> : <LockOpen className="h-5 w-5" />}
        label={selectedLocked ? 'Unlock' : 'Lock'}
        disabled={!hasSelection}
        onClick={() => engine.toggleLockSelected()}
      />
      <ToolButton icon={<Group className="h-5 w-5" />} label="Group" disabled={snapshot.selection.length < 2} onClick={() => engine.groupSelected()} />
      <ToolButton icon={<Ungroup className="h-5 w-5" />} label="Ungroup" disabled={!hasSelection} onClick={() => engine.ungroupSelected()} />
    </div>
  )
}

// ------------------------------------------------------------ Bottom Bar
export function CanvasBottomBar({ engine, snapshot }: EngineProps) {
  return (
    <div className="flex h-13 shrink-0 items-center gap-1.5 overflow-x-auto border-t border-ink-800 bg-ink-950 px-3 no-scrollbar sm:gap-2">
      <ToolButton icon={<ZoomOut className="h-4 w-4" />} label="Zoom Out" onClick={() => engine.zoomOut()} />
      <span data-testid="zoom-percent" className="w-12 shrink-0 text-center text-xs font-semibold tabular-nums text-sand-200">
        {snapshot.zoomPercent}%
      </span>
      <ToolButton icon={<ZoomIn className="h-4 w-4" />} label="Zoom In" onClick={() => engine.zoomIn()} />
      <ToolButton icon={<Maximize className="h-4 w-4" />} label="Fit to Content" onClick={() => engine.fitToContent()} />
      <ToolButton icon={<Scan className="h-4 w-4" />} label="Reset Zoom" onClick={() => engine.resetZoom()} />

      <div className="mx-1 h-6 w-px shrink-0 bg-white/10" />

      <ChipToggle label="Grid" active={snapshot.settings.showGrid} icon={<Grid3x3 className="h-4 w-4" />} onClick={() => engine.toggleGrid()} />
      <ChipToggle label="Snap" active={snapshot.settings.snapToGrid} icon={<Magnet className="h-4 w-4" />} onClick={() => engine.toggleSnap()} />
      <ChipToggle label="Ortho" active={snapshot.settings.ortho} onClick={() => engine.toggleOrtho()} />

      <div className="mx-1 h-6 w-px shrink-0 bg-white/10" />

      <button
        onClick={() => engine.cycleUnit()}
        className="h-9 shrink-0 rounded-full border border-white/15 px-3 text-xs font-semibold text-sand-200 hover:bg-white/10"
      >
        Unit: {snapshot.settings.unit}
      </button>
      <span className="hidden shrink-0 text-xs text-sand-400 sm:inline">Grid {formatDimension(snapshot.settings.gridSize, snapshot.settings.unit)}</span>
    </div>
  )
}

function ChipToggle({ label, active, icon, onClick }: { label: string; active: boolean; icon?: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors',
        active ? 'border-brass-500 bg-brass-500/20 text-brass-300' : 'border-white/15 text-sand-300 hover:bg-white/10',
      )}
    >
      {icon}
      {label}
    </button>
  )
}
