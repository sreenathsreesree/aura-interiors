import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import type { CanvasEngine, CanvasEngineSnapshot } from '@/lib/canvasEngine'
import type { CanvasObject, PreciseCreateSpec, Point } from '@/types/canvas'
import { PrecisionCreatePopup } from './PrecisionCreatePopup'

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
  measure: 'crosshair',
}

const PRECISION_TOOLS = new Set(['rectangle', 'circle', 'line'])
const DOUBLE_TAP_MS = 400
const DOUBLE_TAP_DIST = 28
const TAP_DRAG_THRESHOLD = 10

function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable
}

interface PrecisionPopupState {
  tool: 'rectangle' | 'circle' | 'line'
  worldPoint: Point
  clientX: number
  clientY: number
}

export function CanvasSurface({ engine, snapshot }: CanvasSurfaceProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const pinchRef = useRef<{ startDistance: number; startZoom: number; worldFocal: { x: number; y: number } } | null>(null)
  const hasFitRef = useRef(false)
  const pointerDownPtRef = useRef<{ x: number; y: number } | null>(null)
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null)
  const suppressedPointerIdRef = useRef<number | null>(null)
  const [precisionPopup, setPrecisionPopup] = useState<PrecisionPopupState | null>(null)
  const precisionAnchorRef = useRef<HTMLDivElement>(null)
  const [spacePanning, setSpacePanning] = useState(false)

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
        pointerDownPtRef.current = null // a second finger landing means this was never a tap
        suppressedPointerIdRef.current = null
        lastTapRef.current = null
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
        // Double-tap must be recognized here, BEFORE engine.pointerDown() runs —
        // for a two-point tool like Rectangle, the first tap arms a click-click
        // draft, and the engine treats any second press on the same tool as
        // "second click of the sequence," committing it immediately. Checking
        // only on pointerUp (as before) was always too late: by then the tiny
        // object already exists. So the check moves to the press itself; a
        // recognized double-tap short-circuits before the engine ever sees it.
        const last = lastTapRef.current
        const now = performance.now()
        const isDoubleTap = !!last && now - last.time < DOUBLE_TAP_MS && distanceBetween(pt, last) < DOUBLE_TAP_DIST
        lastTapRef.current = null

        if (isDoubleTap && handleDoubleTap(pt, e)) {
          suppressedPointerIdRef.current = e.pointerId
          pointerDownPtRef.current = null
          return
        }

        pointerDownPtRef.current = pt
        engine.pointerDown(pt, { shiftKey: e.shiftKey })
      }
    }

    /** Returns true if the double-tap was consumed (precision popup opened, or text edit started) — the caller then skips the normal single-tap finalize for this second tap. */
    function handleDoubleTap(pt: { x: number; y: number }, e: PointerEvent): boolean {
      const tool = engine.getSnapshot().tool
      if (PRECISION_TOOLS.has(tool)) {
        engine.cancelDraft()
        setPrecisionPopup({
          tool: tool as 'rectangle' | 'circle' | 'line',
          worldPoint: engine.screenToWorld(pt),
          clientX: e.clientX,
          clientY: e.clientY,
        })
        return true
      }
      const obj = engine.objectAtScreen(pt)
      if (obj && obj.type === 'text' && !obj.locked) {
        engine.selectObject(obj.id, false)
        // Recognizing the double-tap on pointerDOWN (rather than pointerUp, as
        // before) means this now runs before the browser applies this same
        // mousedown's default action — assigning focus to whatever the
        // pointerdown originally targeted (the canvas). Opening the text
        // editor synchronously here would just have that default action steal
        // focus right back off the freshly-mounted textarea. Deferring two
        // frames — the same trick already used when text is first created —
        // lets that settle first.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            engine.startTextEdit(obj.id)
          })
        })
        return true
      }
      return false
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

      // This press was already consumed as a double-tap in onPointerDown (a
      // precision popup opened, or text editing started) — the engine never
      // saw a matching pointerDown for it, so it must not see a pointerUp
      // either, and this release must not re-arm the tap tracker.
      if (suppressedPointerIdRef.current === e.pointerId) {
        suppressedPointerIdRef.current = null
        pointerDownPtRef.current = null
        return
      }

      const downPt = pointerDownPtRef.current
      pointerDownPtRef.current = null
      if (pointersRef.current.size !== 0) return

      // Track this release as a candidate first-tap-of-a-double-tap (rather
      // than relying solely on native `dblclick`, whose touch behavior is
      // inconsistent once touch-action is disabled, which this canvas already
      // does to stop native pinch-zoom). The actual double-tap recognition
      // happens on the NEXT press, in onPointerDown, before the engine sees it.
      const wasTap = downPt ? distanceBetween(pt, downPt) < TAP_DRAG_THRESHOLD : false
      lastTapRef.current = wasTap ? { time: performance.now(), x: pt.x, y: pt.y } : null

      engine.pointerUp(pt)
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

    // All touch handling on the canvas goes through the Pointer Events above
    // (pointerdown/move/up already cover taps, drags and pinch). Left alone,
    // though, the browser still follows every touch tap with a synthetic
    // compatibility "click" once touchend fires. That's harmless on a plain
    // tap, but when the tap just opened a popover (the precision popup's
    // double-tap), the ghost click lands on the popover's now-covering
    // backdrop and closes it immediately via its click-outside handler.
    // Suppressing it at the source — touchstart, the only place Chromium
    // reliably honors preventDefault() for this — avoids that race entirely.
    function onTouchStart(e: TouchEvent) {
      e.preventDefault()
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('touchstart', onTouchStart)
    }
  }, [engine])

  // Desktop "hold Space to pan" — a temporary override on top of whatever
  // tool is active, so releasing Space resumes exactly where the designer
  // was (matches the convention from Figma/Illustrator/etc). Skipped while
  // an input/textarea elsewhere on the page has focus, so typing a literal
  // space doesn't hijack the canvas.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Space' || e.repeat || isEditableTarget(e.target)) return
      e.preventDefault()
      setSpacePanning(true)
      engine.setSpacePanOverride(true)
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code !== 'Space') return
      setSpacePanning(false)
      engine.setSpacePanOverride(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      engine.setSpacePanOverride(false)
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
        style={{ cursor: spacePanning ? 'grab' : (CURSOR_BY_TOOL[snapshot.tool] ?? 'crosshair') }}
      />

      {precisionPopup && (
        <>
          <div ref={precisionAnchorRef} className="pointer-events-none fixed h-px w-px" style={{ left: precisionPopup.clientX, top: precisionPopup.clientY }} />
          <PrecisionCreatePopup
            tool={precisionPopup.tool}
            anchorRef={precisionAnchorRef}
            defaultFill={snapshot.activeFill === 'none' ? '#c9a15f' : snapshot.activeFill}
            defaultStroke={snapshot.activeStroke}
            onCreate={(spec: PreciseCreateSpec) => engine.createPreciseObject(spec, precisionPopup.worldPoint)}
            onClose={() => setPrecisionPopup(null)}
          />
        </>
      )}

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
