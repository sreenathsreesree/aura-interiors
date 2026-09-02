import { useRef, useState, type RefObject } from 'react'
import { NumberStepper } from '@/components/ui'
import type { CanvasUnit, PreciseCreateSpec } from '@/types/canvas'
import { AnchoredPopover } from './AnchoredPopover'
import { ColorPickerContent } from './ColorPicker'
import { LengthField } from './LengthField'

interface PrecisionCreatePopupProps {
  tool: 'rectangle' | 'circle' | 'line' | 'semicircle'
  unit: CanvasUnit
  anchorRef: RefObject<HTMLElement | null>
  defaultFill: string
  defaultStroke: string
  onCreate: (spec: PreciseCreateSpec) => void
  onClose: () => void
}

/**
 * Compact contextual popup for numeric-precision object creation, opened by
 * double-click/double-tap on the canvas while Rectangle/Circle/Line/Semicircle
 * is the active tool. Deliberately one small popup per tool rather than a
 * single universal settings form. All length fields go through LengthField,
 * so entry happens in the project's current unit while geometry is still
 * created and stored in mm underneath.
 */
export function PrecisionCreatePopup({ tool, unit, anchorRef, defaultFill, defaultStroke, onCreate, onClose }: PrecisionCreatePopupProps) {
  const [width, setWidth] = useState(600)
  const [height, setHeight] = useState(400)
  const [cornerRadius, setCornerRadius] = useState(0)
  const [diameter, setDiameter] = useState(500)
  const [length, setLength] = useState(1000)
  const [angleDeg, setAngleDeg] = useState(0)
  const [fill, setFill] = useState(defaultFill)
  const [stroke, setStroke] = useState(defaultStroke)
  const [swatchOpen, setSwatchOpen] = useState<'fill' | 'stroke' | null>(null)
  const fillSwatchRef = useRef<HTMLButtonElement>(null)
  const strokeSwatchRef = useRef<HTMLButtonElement>(null)

  function handleCreate() {
    if (tool === 'rectangle') {
      onCreate({ type: 'rectangle', width: Math.max(width, 10), height: Math.max(height, 10), cornerRadius: Math.max(cornerRadius, 0), fill, stroke })
    } else if (tool === 'circle') {
      onCreate({ type: 'circle', diameter: Math.max(diameter, 10), fill, stroke })
    } else if (tool === 'semicircle') {
      onCreate({ type: 'semicircle', diameter: Math.max(diameter, 10), fill, stroke })
    } else {
      onCreate({ type: 'line', length: Math.max(length, 1), angleDeg, stroke })
    }
    onClose()
  }

  const title = tool === 'rectangle' ? 'Rectangle' : tool === 'circle' ? 'Circle' : tool === 'semicircle' ? 'Semicircle' : 'Line'

  return (
    <AnchoredPopover anchorRef={anchorRef} onClose={onClose}>
      <div className="flex w-60 flex-col gap-3">
        <p className="font-display text-sm font-semibold text-ink-900">{title}</p>

        {tool === 'rectangle' && (
          <div className="grid grid-cols-2 gap-2.5">
            <LengthField label="Width" unit={unit} valueMm={width} onChangeMm={(v) => setWidth(Math.max(10, v))} />
            <LengthField label="Height" unit={unit} valueMm={height} onChangeMm={(v) => setHeight(Math.max(10, v))} />
            <LengthField label="Corner Radius" unit={unit} valueMm={cornerRadius} onChangeMm={(v) => setCornerRadius(Math.max(0, v))} className="col-span-2" />
          </div>
        )}

        {tool === 'circle' && <LengthField label="Diameter" unit={unit} valueMm={diameter} onChangeMm={(v) => setDiameter(Math.max(10, v))} />}

        {tool === 'semicircle' && <LengthField label="Diameter" unit={unit} valueMm={diameter} onChangeMm={(v) => setDiameter(Math.max(10, v))} />}

        {tool === 'line' && (
          <div className="grid grid-cols-2 gap-2.5">
            <LengthField label="Length" unit={unit} valueMm={length} onChangeMm={(v) => setLength(Math.max(1, v))} />
            <NumberStepper label="Angle °" value={angleDeg} onChange={(v) => setAngleDeg(((v % 360) + 360) % 360)} step={15} />
          </div>
        )}

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-ink-600">Fill</span>
            <div className="relative">
              <button
                ref={fillSwatchRef}
                onClick={() => setSwatchOpen(swatchOpen === 'fill' ? null : 'fill')}
                className="h-7 w-7 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.15)]"
                style={{ background: fill === 'none' ? 'transparent' : fill }}
                aria-label="Fill colour"
              />
              {swatchOpen === 'fill' && (
                <AnchoredPopover anchorRef={fillSwatchRef} onClose={() => setSwatchOpen(null)}>
                  <ColorPickerContent color={fill} opacity={1} recentColors={[]} onChangeColor={setFill} onChangeOpacity={() => {}} />
                </AnchoredPopover>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-ink-600">Stroke</span>
            <div className="relative">
              <button
                ref={strokeSwatchRef}
                onClick={() => setSwatchOpen(swatchOpen === 'stroke' ? null : 'stroke')}
                className="h-7 w-7 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.15)]"
                style={{ background: stroke }}
                aria-label="Stroke colour"
              />
              {swatchOpen === 'stroke' && (
                <AnchoredPopover anchorRef={strokeSwatchRef} onClose={() => setSwatchOpen(null)}>
                  <ColorPickerContent color={stroke} opacity={1} recentColors={[]} onChangeColor={setStroke} onChangeOpacity={() => {}} />
                </AnchoredPopover>
              )}
            </div>
          </div>
        </div>

        <button onClick={handleCreate} className="h-11 rounded-md bg-ink-900 text-sm font-semibold text-sand-50 transition-transform active:scale-95">
          Create
        </button>
      </div>
    </AnchoredPopover>
  )
}
