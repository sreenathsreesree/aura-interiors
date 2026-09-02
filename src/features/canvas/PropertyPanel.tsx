import { useRef, useState } from 'react'
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  ArrowDown,
  ArrowUp,
  Bold,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  Eye,
  EyeOff,
  FlipVertical2,
  Lock,
  LockOpen,
  MapPin,
  MapPinOff,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { NumberStepper } from '@/components/ui'
import type { CanvasEngine, CanvasEngineSnapshot } from '@/lib/canvasEngine'
import { getMaterialById } from '@/data/materials'
import { getMaterialThumbnailDataUrl } from '@/lib/materialPatterns'
import type { CanvasObject } from '@/types/canvas'
import { formatLength } from '@/lib/units'
import { AnchoredPopover } from './AnchoredPopover'
import { ColorPickerContent } from './ColorPicker'
import { LengthField } from './LengthField'
import { MaterialPickerContent } from './MaterialPanel'

interface Props {
  engine: CanvasEngine
  snapshot: CanvasEngineSnapshot
  className?: string
}

const TYPE_LABEL: Record<string, string> = {
  rectangle: 'Rectangle',
  square: 'Square',
  circle: 'Circle',
  line: 'Line',
  arc: 'Arc',
  polygon: 'Polygon',
  freeDraw: 'Free Draw',
  path: 'Path',
  text: 'Text',
  dimension: 'Dimension',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-ink-100 px-4 py-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">{title}</p>
      {children}
    </div>
  )
}

export function PropertyPanel({ engine, snapshot, className }: Props) {
  const [swatchOpen, setSwatchOpen] = useState<'fill' | 'stroke' | null>(null)
  const fillSwatchRef = useRef<HTMLButtonElement>(null)
  const strokeSwatchRef = useRef<HTMLButtonElement>(null)
  const selected = snapshot.selectedObjects
  const single = selected.length === 1 ? selected[0] : null
  const first = selected[0]

  return (
    <div className={cn('flex h-full flex-col overflow-y-auto bg-white', className ?? 'w-72 shrink-0 border-l border-ink-100')}>
      {selected.length === 0 ? (
        <div className="px-4 py-5 text-sm text-ink-400">Select an object to see its properties.</div>
      ) : (
        <>
          <Section title={selected.length > 1 ? `${selected.length} objects selected` : TYPE_LABEL[first.type] ?? first.type}>
            {single && (
              <div className="grid grid-cols-2 gap-2.5">
                <LengthField label="X" unit={snapshot.settings.unit} valueMm={single.x} onChangeMm={(v) => engine.updateSelectedProps({ x: v })} />
                <LengthField label="Y" unit={snapshot.settings.unit} valueMm={single.y} onChangeMm={(v) => engine.updateSelectedProps({ y: v })} />
                <LengthField label="Width" unit={snapshot.settings.unit} valueMm={single.width} onChangeMm={(v) => engine.updateSelectedProps({ width: Math.max(10, v) })} min={10} />
                <LengthField label="Height" unit={snapshot.settings.unit} valueMm={single.height} onChangeMm={(v) => engine.updateSelectedProps({ height: Math.max(10, v) })} min={10} />
                <NumberStepper
                  label="Rotation °"
                  value={Math.round(single.rotation)}
                  onChange={(v) => engine.updateSelectedProps({ rotation: ((v % 360) + 360) % 360 })}
                  step={15}
                  className="col-span-2"
                />
                {(single.type === 'rectangle' || single.type === 'square') && (
                  <div className="col-span-2">
                    <CornerRadiusControls engine={engine} object={single} unit={snapshot.settings.unit} />
                  </div>
                )}
                {single.type === 'arc' && (
                  <>
                    <NumberStepper
                      label="Curve"
                      value={single.arcBulge ?? 0.5}
                      onChange={(v) => engine.updateSelectedProps({ arcBulge: v })}
                      step={0.1}
                      className="col-span-2"
                    />
                    <button
                      onClick={() => engine.updateSelectedProps({ arcBulge: -(single.arcBulge ?? 0.5) })}
                      className="col-span-2 flex h-9 items-center justify-center gap-1.5 rounded-md border-2 border-ink-100 text-xs font-semibold text-ink-600 hover:border-ink-400"
                    >
                      <FlipVertical2 className="h-3.5 w-3.5" />
                      Flip Orientation
                    </button>
                  </>
                )}
                {single.type === 'text' && (
                  <>
                    <NumberStepper
                      label="Font Size"
                      value={single.fontSize ?? 32}
                      onChange={(v) => engine.updateSelectedProps({ fontSize: Math.max(10, v) })}
                      step={2}
                    />
                    <button
                      onClick={() => engine.updateSelectedProps({ fontWeight: single.fontWeight === 'bold' ? 'normal' : 'bold' })}
                      className={cn(
                        'flex h-14 items-center justify-center gap-1.5 self-end rounded-[--radius-md] border-2 text-sm font-semibold',
                        single.fontWeight === 'bold' ? 'border-ink-900 bg-ink-900 text-sand-50' : 'border-ink-100 text-ink-600',
                      )}
                      aria-pressed={single.fontWeight === 'bold'}
                    >
                      <Bold className="h-4 w-4" />
                      Bold
                    </button>
                  </>
                )}
                {single.type === 'dimension' && (
                  <div className="col-span-2 rounded-md bg-sand-50 px-3 py-2.5 text-sm font-semibold text-ink-700">
                    Length: {formatLength(single.dimensionValue ?? 0, snapshot.settings.unit)}
                  </div>
                )}
              </div>
            )}
            {single?.type === 'text' && (
              <>
                <div className="mt-2.5 flex gap-1.5">
                  {(['left', 'center', 'right'] as const).map((align) => (
                    <button
                      key={align}
                      onClick={() => engine.updateSelectedProps({ textAlign: align })}
                      className={cn(
                        'h-9 flex-1 rounded-md border-2 text-xs font-semibold capitalize',
                        single.textAlign === align ? 'border-ink-900 bg-ink-900 text-sand-50' : 'border-ink-100 text-ink-600',
                      )}
                    >
                      {align}
                    </button>
                  ))}
                </div>
                <TextExtraControls engine={engine} object={single} unit={snapshot.settings.unit} />
              </>
            )}
            {snapshot.editingPathId && <PathEditControls engine={engine} snapshot={snapshot} />}

            {selected.length >= 2 && (
              <div className="flex flex-col gap-2.5">
                <div>
                  <p className="mb-1.5 text-xs font-medium text-ink-500">Align</p>
                  <div className="flex gap-1.5">
                    <PanelIconButton icon={<AlignStartVertical className="h-4 w-4" />} label="Align Left" onClick={() => engine.alignSelected('left')} />
                    <PanelIconButton icon={<AlignCenterVertical className="h-4 w-4" />} label="Align Center" onClick={() => engine.alignSelected('center')} />
                    <PanelIconButton icon={<AlignEndVertical className="h-4 w-4" />} label="Align Right" onClick={() => engine.alignSelected('right')} />
                    <PanelIconButton icon={<AlignStartHorizontal className="h-4 w-4" />} label="Align Top" onClick={() => engine.alignSelected('top')} />
                    <PanelIconButton icon={<AlignCenterHorizontal className="h-4 w-4" />} label="Align Middle" onClick={() => engine.alignSelected('middle')} />
                    <PanelIconButton icon={<AlignEndHorizontal className="h-4 w-4" />} label="Align Bottom" onClick={() => engine.alignSelected('bottom')} />
                  </div>
                </div>
                {selected.length >= 3 && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-ink-500">Distribute</p>
                    <div className="flex gap-1.5">
                      <PanelIconButton icon={<AlignHorizontalDistributeCenter className="h-4 w-4" />} label="Distribute Horizontally" onClick={() => engine.distributeSelected('horizontal')} />
                      <PanelIconButton icon={<AlignVerticalDistributeCenter className="h-4 w-4" />} label="Distribute Vertically" onClick={() => engine.distributeSelected('vertical')} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </Section>

          <Section title="Appearance">
            <div className="flex flex-col gap-3">
              {first.fillType === 'color' ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink-600">Colour</span>
                  <div className="relative">
                    <button
                      ref={fillSwatchRef}
                      onClick={() => setSwatchOpen(swatchOpen === 'fill' ? null : 'fill')}
                      className="h-8 w-8 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.15)]"
                      style={{ background: first.fill === 'none' ? 'transparent' : first.fill }}
                      aria-label="Edit fill color"
                    />
                    {swatchOpen === 'fill' && (
                      <AnchoredPopover anchorRef={fillSwatchRef} side="left" onClose={() => setSwatchOpen(null)}>
                        <ColorPickerContent
                          color={first.fill}
                          opacity={first.opacity}
                          recentColors={snapshot.recentColors}
                          onChangeColor={(c) =>
                            engine.updateSelectedProps({ fill: c, fillType: 'color', materialId: undefined, imageData: undefined, fillFit: undefined })
                          }
                          onChangeOpacity={(o) => engine.updateSelectedProps({ opacity: o })}
                        />
                      </AnchoredPopover>
                    )}
                  </div>
                </div>
              ) : (
                <MaterialFillControls engine={engine} object={first} unit={snapshot.settings.unit} />
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-ink-600">Stroke</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => engine.updateSelectedProps({ strokeEnabled: !first.strokeEnabled })}
                    className={cn(
                      'h-7 w-12 shrink-0 rounded-full border-2 transition-colors',
                      first.strokeEnabled ? 'border-sage-500 bg-sage-500/20' : 'border-ink-200 bg-ink-50',
                    )}
                    aria-label="Toggle stroke"
                  >
                    <span className={cn('block h-4 w-4 rounded-full bg-white shadow transition-transform', first.strokeEnabled ? 'translate-x-6' : 'translate-x-1')} />
                  </button>
                  <div className="relative">
                    <button
                      ref={strokeSwatchRef}
                      onClick={() => setSwatchOpen(swatchOpen === 'stroke' ? null : 'stroke')}
                      className="h-8 w-8 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.15)]"
                      style={{ background: first.stroke }}
                      aria-label="Edit stroke color"
                    />
                    {swatchOpen === 'stroke' && (
                      <AnchoredPopover anchorRef={strokeSwatchRef} side="left" onClose={() => setSwatchOpen(null)}>
                        <ColorPickerContent
                          color={first.stroke}
                          opacity={1}
                          recentColors={snapshot.recentColors}
                          onChangeColor={(c) => engine.updateSelectedProps({ stroke: c })}
                          onChangeOpacity={() => {}}
                        />
                      </AnchoredPopover>
                    )}
                  </div>
                </div>
              </div>

              <LengthField label="Stroke Width" unit={snapshot.settings.unit} valueMm={first.strokeWidth} onChangeMm={(v) => engine.updateSelectedProps({ strokeWidth: Math.max(0.5, v) })} min={0.5} stepMm={2} />

              <div>
                <div className="mb-1 flex items-center justify-between text-xs font-medium text-ink-500">
                  <span>Opacity</span>
                  <span className="tabular-nums">{Math.round(first.opacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={first.opacity}
                  onChange={(e) => engine.updateSelectedProps({ opacity: Number(e.target.value) })}
                  className="w-full accent-brass-500"
                />
              </div>
            </div>
          </Section>

          <Section title="Layer">
            <div className="flex flex-col gap-2">
              <select
                value={first.layerId}
                onChange={(e) => engine.setSelectedLayer(e.target.value)}
                className="h-10 w-full rounded-md border border-ink-200 bg-sand-50 px-2.5 text-sm text-ink-700 outline-none focus:border-brass-500"
              >
                {snapshot.layers.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-1.5">
                <PanelIconButton icon={<ChevronsDown className="h-4 w-4" />} label="Send to back" onClick={() => engine.reorderSelected('back')} />
                <PanelIconButton icon={<ArrowDown className="h-4 w-4" />} label="Send backward" onClick={() => engine.reorderSelected('down')} />
                <PanelIconButton icon={<ArrowUp className="h-4 w-4" />} label="Bring forward" onClick={() => engine.reorderSelected('up')} />
                <PanelIconButton icon={<ChevronsUp className="h-4 w-4" />} label="Bring to front" onClick={() => engine.reorderSelected('front')} />
                <PanelIconButton
                  icon={first.locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
                  label={first.locked ? 'Unlock' : 'Lock'}
                  onClick={() => engine.toggleLockSelected()}
                />
                <PanelIconButton
                  icon={!first.visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  label={!first.visible ? 'Show' : 'Hide'}
                  onClick={() => engine.toggleVisibleSelected()}
                />
              </div>
            </div>
          </Section>
        </>
      )}

      <LayersList engine={engine} snapshot={snapshot} />
    </div>
  )
}

/** Material/Type/Scale/Rotation/Offset/Opacity controls for a texture- or image-filled object. Opacity itself is handled by the shared slider further down in Appearance. */
function MaterialFillControls({ engine, object, unit }: { engine: CanvasEngine; object: CanvasObject; unit: CanvasEngineSnapshot['settings']['unit'] }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const isImage = object.fillType === 'image'
  const material = object.materialId ? getMaterialById(object.materialId) : undefined
  const scale = object.textureScale ?? 1
  const rotation = object.textureRotation ?? 0
  const offset = object.textureOffset ?? { x: 0, y: 0 }

  return (
    <div className="flex flex-col gap-3 rounded-[--radius-md] border border-ink-100 bg-sand-50 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink-600">{isImage ? 'Image' : 'Material'}</span>
        <div className="relative">
          <button
            ref={triggerRef}
            onClick={() => setPickerOpen((v) => !v)}
            className="flex items-center gap-2 rounded-md border border-ink-200 bg-white px-2 py-1.5 text-xs font-semibold text-ink-700 hover:border-ink-400"
          >
            <span
              className="h-6 w-6 shrink-0 rounded-[--radius-sm] border border-ink-100 bg-cover bg-center"
              style={{ backgroundImage: `url(${isImage ? object.imageData : material ? getMaterialThumbnailDataUrl(material) : ''})` }}
            />
            <span className="max-w-24 truncate">{isImage ? 'Custom Image' : (material?.name ?? 'Material')}</span>
          </button>
          {pickerOpen && (
            <AnchoredPopover anchorRef={triggerRef} side="left" onClose={() => setPickerOpen(false)}>
              <p className="mb-3 font-display text-sm font-semibold text-ink-900">Materials</p>
              <MaterialPickerContent
                activeMaterialId={object.materialId}
                onSelectMaterial={(m) => {
                  engine.setActiveMaterial(m)
                  setPickerOpen(false)
                }}
                onUseImage={(dataUrl) => {
                  engine.setImageFillOnSelection(dataUrl)
                  setPickerOpen(false)
                }}
              />
            </AnchoredPopover>
          )}
        </div>
      </div>

      {isImage && (
        <div className="flex gap-1.5">
          {(['cover', 'contain', 'tile'] as const).map((fit) => (
            <button
              key={fit}
              onClick={() => engine.updateSelectedProps({ fillFit: fit })}
              className={cn(
                'h-8 flex-1 rounded-md border-2 text-[11px] font-semibold capitalize',
                (object.fillFit ?? 'cover') === fit ? 'border-ink-900 bg-ink-900 text-sand-50' : 'border-ink-100 bg-white text-ink-600',
              )}
            >
              {fit}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <NumberStepper label="Scale" value={Number(scale.toFixed(2))} onChange={(v) => engine.updateSelectedProps({ textureScale: Math.max(0.1, v) })} step={0.1} />
        <NumberStepper
          label="Rotation °"
          value={Math.round(rotation)}
          onChange={(v) => engine.updateSelectedProps({ textureRotation: ((v % 360) + 360) % 360 })}
          step={15}
        />
        <LengthField label="Offset X" unit={unit} valueMm={offset.x} onChangeMm={(v) => engine.updateSelectedProps({ textureOffset: { x: v, y: offset.y } })} />
        <LengthField label="Offset Y" unit={unit} valueMm={offset.y} onChangeMm={(v) => engine.updateSelectedProps({ textureOffset: { x: offset.x, y: v } })} />
      </div>

      <button
        onClick={() => engine.removeFillOverride()}
        className="h-9 rounded-md border-2 border-dashed border-ink-300 text-xs font-semibold text-ink-500 hover:border-ink-500"
      >
        Remove {isImage ? 'Image' : 'Material'}
      </button>
    </div>
  )
}

const CORNER_LABELS = [
  { key: 'topLeft' as const, label: 'Top Left' },
  { key: 'topRight' as const, label: 'Top Right' },
  { key: 'bottomRight' as const, label: 'Bottom Right' },
  { key: 'bottomLeft' as const, label: 'Bottom Left' },
]

/** V3C — uniform corner radius by default, switchable to independent per-corner values. */
function CornerRadiusControls({ engine, object, unit }: { engine: CanvasEngine; object: CanvasObject; unit: CanvasEngineSnapshot['settings']['unit'] }) {
  const [perCorner, setPerCorner] = useState(Boolean(object.cornerRadii))

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink-500">Corner Radius</span>
        <div className="flex gap-1">
          <button
            onClick={() => setPerCorner(false)}
            className={cn('rounded px-2 py-1 text-[11px] font-semibold', !perCorner ? 'bg-ink-900 text-sand-50' : 'text-ink-500 hover:bg-sand-50')}
          >
            All corners
          </button>
          <button
            onClick={() => setPerCorner(true)}
            className={cn('rounded px-2 py-1 text-[11px] font-semibold', perCorner ? 'bg-ink-900 text-sand-50' : 'text-ink-500 hover:bg-sand-50')}
          >
            Individual
          </button>
        </div>
      </div>
      {!perCorner ? (
        <LengthField label="Radius" unit={unit} valueMm={object.cornerRadius ?? 0} onChangeMm={(v) => engine.setUniformCornerRadius(v)} min={0} stepMm={5} />
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {CORNER_LABELS.map(({ key, label }) => (
            <LengthField
              key={key}
              label={label}
              unit={unit}
              valueMm={object.cornerRadii?.[key] ?? object.cornerRadius ?? 0}
              onChangeMm={(v) => engine.setCornerRadius(key, v)}
              min={0}
              stepMm={5}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** V3C — text box width (word-wrap), background panel, and leader/callout controls. */
function TextExtraControls({ engine, object, unit }: { engine: CanvasEngine; object: CanvasObject; unit: CanvasEngineSnapshot['settings']['unit'] }) {
  const [bgSwatchOpen, setBgSwatchOpen] = useState(false)
  const bgSwatchRef = useRef<HTMLButtonElement>(null)
  const hasBackground = Boolean(object.textBackground && object.textBackground !== 'none')

  return (
    <div className="mt-2.5 flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <LengthField
          label="Text Box Width"
          unit={unit}
          valueMm={object.textBoxWidth ?? object.width}
          onChangeMm={(v) => engine.updateSelectedProps({ textBoxWidth: Math.max(20, v) })}
          min={20}
          className="flex-1"
        />
        {object.textBoxWidth !== undefined && (
          <button
            onClick={() => engine.updateSelectedProps({ textBoxWidth: undefined })}
            aria-label="Remove text box width (back to single line)"
            className="mt-6 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-ink-200 text-ink-500 hover:border-ink-400"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink-600">Background</span>
        <div className="flex items-center gap-2">
          {hasBackground && (
            <button onClick={() => engine.updateSelectedProps({ textBackground: 'none' })} className="text-xs font-semibold text-ink-400 hover:text-ink-700">
              None
            </button>
          )}
          <div className="relative">
            <button
              ref={bgSwatchRef}
              onClick={() => setBgSwatchOpen((v) => !v)}
              className="h-8 w-8 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.15)]"
              style={{ background: hasBackground ? object.textBackground : 'repeating-conic-gradient(#ccc 0% 25%, transparent 0% 50%) 50% / 8px 8px' }}
              aria-label="Edit text background colour"
            />
            {bgSwatchOpen && (
              <AnchoredPopover anchorRef={bgSwatchRef} side="left" onClose={() => setBgSwatchOpen(false)}>
                <ColorPickerContent
                  color={hasBackground ? object.textBackground! : '#ffffff'}
                  opacity={1}
                  recentColors={[]}
                  onChangeColor={(c) => engine.updateSelectedProps({ textBackground: c })}
                  onChangeOpacity={() => {}}
                />
              </AnchoredPopover>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink-600">Leader / Callout</span>
        {object.calloutTarget ? (
          <button onClick={() => engine.removeLeader(object.id)} className="flex h-9 items-center gap-1.5 rounded-md border-2 border-ink-100 px-3 text-xs font-semibold text-ink-600 hover:border-ink-400">
            <MapPinOff className="h-3.5 w-3.5" />
            Remove Leader
          </button>
        ) : (
          <button onClick={() => engine.startAddLeader(object.id)} className="flex h-9 items-center gap-1.5 rounded-md border-2 border-ink-100 px-3 text-xs font-semibold text-ink-600 hover:border-ink-400">
            <MapPin className="h-3.5 w-3.5" />
            Add Leader
          </button>
        )}
      </div>
    </div>
  )
}

/** V3C Pen tool — Corner/Smooth/Delete/Close/Done controls for the path currently in vertex-edit mode. */
function PathEditControls({ engine, snapshot }: { engine: CanvasEngine; snapshot: CanvasEngineSnapshot }) {
  const path = snapshot.objects.find((o) => o.id === snapshot.editingPathId)
  const hasVertexSelected = snapshot.selectedVertexIndex !== null
  return (
    <div className="col-span-2 mt-2 flex flex-col gap-2 rounded-md border border-dashed border-brass-500/50 bg-brass-500/5 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-brass-700">Editing Path</p>
      <div className="flex flex-wrap gap-1.5">
        <PanelIconButton icon={<Check className="h-4 w-4" />} label="Corner point" disabled={!hasVertexSelected} onClick={() => engine.setSelectedVertexSmooth(false)} />
        <PanelIconButton icon={<FlipVertical2 className="h-4 w-4" />} label="Smooth point" disabled={!hasVertexSelected} onClick={() => engine.setSelectedVertexSmooth(true)} />
        <PanelIconButton icon={<Trash2 className="h-4 w-4" />} label="Delete anchor" disabled={!hasVertexSelected} onClick={() => engine.deleteSelectedVertex()} />
        {path && !path.pathClosed && <PanelIconButton icon={<Check className="h-4 w-4" />} label="Close path" onClick={() => engine.closeEditingPath()} />}
        <PanelIconButton icon={<X className="h-4 w-4" />} label="Done editing" onClick={() => engine.exitPathEdit()} />
      </div>
    </div>
  )
}

function PanelIconButton({ icon, label, disabled, onClick }: { icon: React.ReactNode; label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 flex-1 items-center justify-center rounded-md border border-ink-200 text-ink-600 transition-colors hover:border-ink-400 hover:bg-sand-50 disabled:cursor-not-allowed disabled:opacity-30"
    >
      {icon}
    </button>
  )
}

function LayersList({ engine, snapshot }: Props) {
  const sorted = [...snapshot.layers].sort((a, b) => a.order - b.order)
  return (
    <Section title="Layers">
      <div className="flex flex-col gap-1.5">
        {sorted.map((layer, i) => (
          <div
            key={layer.id}
            onClick={() => engine.setActiveLayer(layer.id)}
            className={cn(
              'flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-2 text-sm transition-colors',
              layer.id === snapshot.activeLayerId ? 'bg-brass-500/12 text-brass-700 font-semibold' : 'text-ink-600 hover:bg-sand-50',
            )}
          >
            <span className="min-w-0 flex-1 truncate">{layer.name}</span>
            <div className="flex shrink-0 flex-col">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  engine.reorderLayer(layer.id, 'up')
                }}
                disabled={i === 0}
                aria-label={`Move ${layer.name} up`}
                className="text-ink-400 hover:text-ink-700 disabled:opacity-25"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  engine.reorderLayer(layer.id, 'down')
                }}
                disabled={i === sorted.length - 1}
                aria-label={`Move ${layer.name} down`}
                className="text-ink-400 hover:text-ink-700 disabled:opacity-25"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                engine.toggleLayerVisibility(layer.id)
              }}
              aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
              className="text-ink-400 hover:text-ink-700"
            >
              {layer.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                engine.toggleLayerLock(layer.id)
              }}
              aria-label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
              className="text-ink-400 hover:text-ink-700"
            >
              {layer.locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
            </button>
          </div>
        ))}
        <button
          onClick={() => engine.addLayer(`Layer ${snapshot.layers.length + 1}`)}
          className="mt-1 flex h-9 items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-ink-200 text-xs font-semibold text-ink-500 hover:border-ink-400"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Layer
        </button>
      </div>
    </Section>
  )
}
