import { useState } from 'react'
import { ArrowDown, ArrowUp, ChevronsDown, ChevronsUp, Eye, EyeOff, Lock, LockOpen, Plus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { NumberStepper } from '@/components/ui'
import type { CanvasEngine, CanvasEngineSnapshot } from '@/lib/canvasEngine'
import { ColorPickerContent } from './ColorPicker'

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
                <NumberStepper label="X (mm)" value={Math.round(single.x)} onChange={(v) => engine.updateSelectedProps({ x: v })} step={10} />
                <NumberStepper label="Y (mm)" value={Math.round(single.y)} onChange={(v) => engine.updateSelectedProps({ y: v })} step={10} />
                <NumberStepper label="Width (mm)" value={Math.round(single.width)} onChange={(v) => engine.updateSelectedProps({ width: Math.max(10, v) })} step={10} />
                <NumberStepper label="Height (mm)" value={Math.round(single.height)} onChange={(v) => engine.updateSelectedProps({ height: Math.max(10, v) })} step={10} />
                <NumberStepper
                  label="Rotation °"
                  value={Math.round(single.rotation)}
                  onChange={(v) => engine.updateSelectedProps({ rotation: ((v % 360) + 360) % 360 })}
                  step={15}
                  className="col-span-2"
                />
                {single.type === 'arc' && (
                  <NumberStepper
                    label="Curve"
                    value={single.arcBulge ?? 0.5}
                    onChange={(v) => engine.updateSelectedProps({ arcBulge: v })}
                    step={0.1}
                    className="col-span-2"
                  />
                )}
                {single.type === 'text' && (
                  <NumberStepper
                    label="Font Size"
                    value={single.fontSize ?? 32}
                    onChange={(v) => engine.updateSelectedProps({ fontSize: Math.max(10, v) })}
                    step={2}
                    className="col-span-2"
                  />
                )}
                {single.type === 'dimension' && (
                  <div className="col-span-2 rounded-md bg-sand-50 px-3 py-2.5 text-sm font-semibold text-ink-700">
                    Length: {Math.round(single.dimensionValue ?? 0)} mm
                  </div>
                )}
              </div>
            )}
            {single?.type === 'text' && (
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
            )}
          </Section>

          <Section title="Appearance">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-ink-600">Fill</span>
                <div className="relative">
                  <button
                    onClick={() => setSwatchOpen(swatchOpen === 'fill' ? null : 'fill')}
                    className="h-8 w-8 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.15)]"
                    style={{ background: first.fill === 'none' ? 'transparent' : first.fill }}
                    aria-label="Edit fill color"
                  />
                  {swatchOpen === 'fill' && (
                    <div className="fixed inset-0 z-30" onClick={() => setSwatchOpen(null)}>
                      <div
                        className="absolute right-4 top-24 z-40 rounded-[--radius-lg] border border-ink-100 bg-white p-4 shadow-[--shadow-float]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ColorPickerContent
                          color={first.fill}
                          opacity={first.opacity}
                          recentColors={snapshot.recentColors}
                          onChangeColor={(c) => engine.updateSelectedProps({ fill: c, fillType: 'color' })}
                          onChangeOpacity={(o) => engine.updateSelectedProps({ opacity: o })}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

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
                      onClick={() => setSwatchOpen(swatchOpen === 'stroke' ? null : 'stroke')}
                      className="h-8 w-8 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.15)]"
                      style={{ background: first.stroke }}
                      aria-label="Edit stroke color"
                    />
                    {swatchOpen === 'stroke' && (
                      <div className="fixed inset-0 z-30" onClick={() => setSwatchOpen(null)}>
                        <div
                          className="absolute right-4 top-24 z-40 rounded-[--radius-lg] border border-ink-100 bg-white p-4 shadow-[--shadow-float]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ColorPickerContent
                            color={first.stroke}
                            opacity={1}
                            recentColors={snapshot.recentColors}
                            onChangeColor={(c) => engine.updateSelectedProps({ stroke: c })}
                            onChangeOpacity={() => {}}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <NumberStepper
                label="Stroke Width"
                value={first.strokeWidth}
                onChange={(v) => engine.updateSelectedProps({ strokeWidth: Math.max(0.5, v) })}
                step={0.5}
              />

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
              </div>
            </div>
          </Section>
        </>
      )}

      <LayersList engine={engine} snapshot={snapshot} />
    </div>
  )
}

function PanelIconButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex h-9 flex-1 items-center justify-center rounded-md border border-ink-200 text-ink-600 transition-colors hover:border-ink-400 hover:bg-sand-50"
    >
      {icon}
    </button>
  )
}

function LayersList({ engine, snapshot }: Props) {
  return (
    <Section title="Layers">
      <div className="flex flex-col gap-1.5">
        {[...snapshot.layers]
          .sort((a, b) => a.order - b.order)
          .map((layer) => (
            <div
              key={layer.id}
              onClick={() => engine.setActiveLayer(layer.id)}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors',
                layer.id === snapshot.activeLayerId ? 'bg-brass-500/12 text-brass-700 font-semibold' : 'text-ink-600 hover:bg-sand-50',
              )}
            >
              <span className="min-w-0 flex-1 truncate">{layer.name}</span>
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
