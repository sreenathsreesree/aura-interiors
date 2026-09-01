import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import type { CanvasEngine, CanvasEngineSnapshot } from '@/lib/canvasEngine'
import type { CanvasObject } from '@/types/canvas'

interface CanvasSurfaceProps {
  engine: CanvasEngine
  snapshot: CanvasEngineSnapshot
}

const CURSOR_BY_TOOL: Record<string, string> = {
  select: 'default',
  pan: 'grab',
  fill: 'crosshair',
  eyedropper: 'crosshair',
  text: 'text',
}

export function CanvasSurface({ engine, snapshot }: CanvasSurfaceProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const pinchRef = useRef<{ startDistance: number; startZoom: number; worldFocal: { x: number; y: number } } | null>(null)
  const hasFitRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    engine.setCanvasElement(canvas)

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      engine.resize(width, height, window.devicePixelRatio || 1)
      if (!hasFitRef.current && width > 0 && height > 0) {
        hasFitRef.current = true
        engine.fitToContent()
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [engine])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function screenPointFromEvent(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    function distanceBetween(a: { x: number; y: number }, b: { x: number; y: number }) {
      return Math.hypot(a.x - b.x, a.y - b.y)
    }

    function midpoint(a: { x: number; y: number }, b: { x: number; y: number }) {
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    }

    function onPointerDown(e: PointerEvent) {
      canvas!.setPointerCapture(e.pointerId)
      const pt = screenPointFromEvent(e)
      pointersRef.current.set(e.pointerId, pt)

      if (pointersRef.current.size === 2) {
        engine.cancelGesture()
        const [a, b] = [...pointersRef.current.values()]
        const mid = midpoint(a, b)
        pinchRef.current = {
          startDistance: distanceBetween(a, b),
          startZoom: engine.getSnapshot().zoomPercent / 100,
          worldFocal: engine.screenToWorld(mid),
        }
        return
      }

      if (pointersRef.current.size === 1) {
        engine.pointerDown(pt, { shiftKey: e.shiftKey })
      }
    }

    function onPointerMove(e: PointerEvent) {
      const pt = screenPointFromEvent(e)
      if (pointersRef.current.has(e.pointerId)) pointersRef.current.set(e.pointerId, pt)

      if (pointersRef.current.size === 2 && pinchRef.current) {
        const [a, b] = [...pointersRef.current.values()]
        const dist = distanceBetween(a, b)
        const mid = midpoint(a, b)
        const scale = dist / Math.max(pinchRef.current.startDistance, 1)
        engine.pinchTo(pinchRef.current.startZoom * scale, mid, pinchRef.current.worldFocal)
        return
      }

      // Also drives the "click → click" rubber-band preview on desktop,
      // where mousemove keeps firing between the two taps with no button held.
      if (pointersRef.current.size <= 1) {
        engine.pointerMove(pt)
      }
    }

    function onPointerUp(e: PointerEvent) {
      const pt = screenPointFromEvent(e)
      pointersRef.current.delete(e.pointerId)
      if (pointersRef.current.size < 2) pinchRef.current = null
      if (pointersRef.current.size === 0) engine.pointerUp(pt)
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const rect = canvas!.getBoundingClientRect()
      const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-e.deltaY * 0.01)
        engine.zoomAt(pt, factor)
      } else {
        engine.panBy(-e.deltaX, -e.deltaY)
      }
    }

    function onDoubleClick(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect()
      const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      const obj = engine.objectAtScreen(pt)
      if (obj && obj.type === 'text' && !obj.locked) {
        engine.selectObject(obj.id, false)
        engine.startTextEdit(obj.id)
      }
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('dblclick', onDoubleClick)
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('dblclick', onDoubleClick)
    }
  }, [engine])

  const editingObject = snapshot.editingTextId
    ? snapshot.objects.find((o) => o.id === snapshot.editingTextId)
    : undefined

  return (
    <div ref={containerRef} className="relative h-full w-full touch-none overflow-hidden bg-[#eef0ee]">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none select-none"
        style={{ cursor: CURSOR_BY_TOOL[snapshot.tool] ?? 'crosshair' }}
      />

      {editingObject && (
        <TextEditOverlay
          key={editingObject.id}
          engine={engine}
          object={editingObject}
          zoom={snapshot.zoomPercent / 100}
        />
      )}

      {snapshot.drawingPolygon && snapshot.polygonPointCount >= 3 && (
        <button
          onClick={() => engine.finishPolygon()}
          className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-full bg-ink-900 px-5 py-3 text-sm font-semibold text-sand-50 shadow-soft active:scale-95"
        >
          Close Shape
        </button>
      )}

      {snapshot.drawingPolygon && snapshot.polygonPointCount > 0 && snapshot.polygonPointCount < 3 && (
        <div className="pointer-events-none absolute bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-full bg-ink-900/85 px-4 py-2 text-xs font-medium text-sand-100">
          Tap to add points ({snapshot.polygonPointCount})
        </div>
      )}
    </div>
  )
}

/**
 * Mounted fresh (via `key={object.id}`) each time a different text object
 * starts editing, so its local draft state naturally resets on identity
 * change — no effect needed to resync it.
 */
function TextEditOverlay({ engine, object, zoom }: { engine: CanvasEngine; object: CanvasObject; zoom: number }) {
  const [value, setValue] = useState(object.text ?? '')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const screen = engine.worldToScreen({ x: object.x, y: object.y })

  // Imperative focus via a ref (rather than the `autoFocus` attribute) so
  // React StrictMode's dev-only double-invoke of mount effects just calls
  // .focus() on an already-focused element the second time — a no-op.
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  function commit() {
    engine.commitTextEdit(object.id, value)
  }

  return (
    <div className="absolute z-20 flex items-start gap-1.5" style={{ left: screen.x, top: screen.y }}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.currentTarget.blur()
            engine.cancelTextEdit()
          }
        }}
        style={{
          width: Math.max(object.width * zoom, 120),
          fontSize: Math.max((object.fontSize ?? 32) * zoom, 14),
          color: object.fill,
        }}
        className="min-h-9 resize-none rounded-md border-2 border-brass-500 bg-white/95 px-2 py-1 leading-tight outline-none"
        rows={1}
      />
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={commit}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brass-500 text-white shadow-soft"
        aria-label="Done editing text"
      >
        <Check className="h-4 w-4" />
      </button>
    </div>
  )
}
