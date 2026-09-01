import { useRef, useSyncExternalStore } from 'react'
import { CanvasEngine } from '@/lib/canvasEngine'
import type { CanvasDocument } from '@/types/canvas'

/**
 * Creates a CanvasEngine once and exposes its state to React via
 * useSyncExternalStore. Heavy canvas work (drag math, rendering) lives
 * entirely inside the engine and never touches React state — only the
 * lightweight snapshot used to paint the surrounding chrome does.
 */
export function useCanvasEngine(initialDoc: CanvasDocument) {
  const engineRef = useRef<CanvasEngine | null>(null)
  if (!engineRef.current) engineRef.current = new CanvasEngine(initialDoc)
  const engine = engineRef.current
  const snapshot = useSyncExternalStore(
    (listener) => engine.subscribe(listener),
    () => engine.getSnapshot(),
  )
  return { engine, snapshot }
}
