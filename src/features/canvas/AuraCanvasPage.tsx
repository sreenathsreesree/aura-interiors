import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PenTool, Sliders } from 'lucide-react'
import { Button, EmptyState } from '@/components/ui'
import { useAppStore } from '@/store/useAppStore'
import { computeRoomWalls, getOrCreateRoomCanvas, getOrCreateRoomView, saveRoomCanvas } from '@/lib/canvasStorage'
import { pushCanvasDocumentNow } from '@/supabase/sync/pushActions'
import type { CanvasDocument } from '@/types/canvas'
import { useCanvasEngine } from './useCanvasEngine'
import { CanvasSurface } from './CanvasSurface'
import { CanvasTopBar, CanvasLeftToolbar, CanvasBottomBar } from './CanvasToolbars'
import { DrawingSheetPanel } from './DrawingSheetPanel'
import { PropertyPanel } from './PropertyPanel'
import { MobilePropertySheet, MobileToolSheet } from './MobileCanvasSheets'

function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable
}

export function AuraCanvasPage() {
  const { projectId, roomId } = useParams<{ projectId: string; roomId: string }>()
  const navigate = useNavigate()

  const project = useAppStore((s) => s.projects.find((p) => p.id === projectId))
  const room = useAppStore((s) => s.rooms.find((r) => r.id === roomId))
  const client = useAppStore((s) => s.clients.find((c) => c.id === project?.clientId))

  const initialDocRef = useRef<CanvasDocument | null>(null)
  if (!initialDocRef.current) {
    initialDocRef.current = getOrCreateRoomCanvas(
      projectId ?? '',
      roomId ?? '',
      room?.dimensions.lengthFt ?? 12,
      room?.dimensions.widthFt ?? 10,
    )
  }
  const { engine, snapshot } = useCanvasEngine(initialDocRef.current)

  // Cloud Foundation — every existing local save point (Save button, view
  // switch, and now unmount/navigate-away below) also pushes to Supabase.
  // saveRoomCanvas() is unchanged local behavior; pushCanvasDocumentNow() is
  // a no-op when signed out or Supabase isn't configured, so this is a pure
  // addition, never a change to what already happens locally.
  function persistCanvas(doc: CanvasDocument) {
    saveRoomCanvas(doc)
    pushCanvasDocumentNow(doc)
  }

  useEffect(() => {
    // Save-on-leave only (engine is a stable ref, so this effect never
    // re-runs mid-session) — deliberately not reactive to document changes,
    // which would turn this into an autosave-on-every-edit effect that
    // doesn't otherwise exist in this app.
    return () => persistCanvas(engine.getDocument())
  }, [engine])

  // AURA CANVAS V3D — which of the room's drawings (Plan or a wall
  // elevation) is currently loaded into the ONE shared engine. Switching
  // saves whatever's currently loaded under its own view key, then loads
  // the target (creating it fresh, seeded from the room's real dimensions,
  // the first time). Plan and every elevation stay part of this same
  // room — never a separate/unrelated room.
  const [currentViewId, setCurrentViewId] = useState('plan')
  const walls = useMemo(() => (room ? computeRoomWalls(room) : []), [room])

  function switchView(viewId: string) {
    if (!project || !room || viewId === currentViewId) return
    persistCanvas(engine.getDocument())
    const nextDoc = getOrCreateRoomView(project.id, room.id, viewId, room)
    engine.loadDocument(nextDoc)
    engine.fitToContent()
    setCurrentViewId(viewId)
  }

  const [toolSheetOpen, setToolSheetOpen] = useState(false)
  const [propertySheetOpen, setPropertySheetOpen] = useState(false)
  const [sheetPanelOpen, setSheetPanelOpen] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const isDesignerMode = (snapshot.settings.drawingMode ?? 'designer') === 'designer'

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return
      const meta = e.metaKey || e.ctrlKey
      if ((e.key === 'Delete' || e.key === 'Backspace') && !snapshot.editingTextId) {
        e.preventDefault()
        engine.deleteSelected()
      } else if (e.key === 'Escape') {
        if (snapshot.editingPathId) {
          engine.exitPathEdit()
        } else if (snapshot.penDraftVertexCount > 0) {
          engine.cancelPen()
        } else {
          engine.cancelDraft()
          engine.clearSelection()
          engine.clearMeasurement()
        }
      } else if (e.key === 'Enter' && snapshot.penDraftVertexCount > 0) {
        e.preventDefault()
        engine.finishPen(false)
      } else if (meta && e.key.toLowerCase() === 'z' && e.shiftKey) {
        e.preventDefault()
        engine.redo()
      } else if (meta && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        engine.undo()
      } else if (meta && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        engine.redo()
      } else if (meta && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        engine.duplicateSelected()
      } else if (meta && e.key.toLowerCase() === 'c') {
        engine.copySelection()
      } else if (meta && e.key.toLowerCase() === 'v') {
        engine.pasteClipboard()
      } else if (meta && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        engine.selectAll()
      } else if (meta && e.shiftKey && e.key.toLowerCase() === 'g') {
        e.preventDefault()
        engine.ungroupSelected()
      } else if (meta && e.key.toLowerCase() === 'g') {
        e.preventDefault()
        engine.groupSelected()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [engine, snapshot.editingTextId, snapshot.editingPathId, snapshot.penDraftVertexCount])

  if (!project || !room) {
    return (
      <div className="p-8">
        <EmptyState
          icon={<PenTool className="h-8 w-8" />}
          title="Room not found"
          description="This room may have been removed."
          action={<Button onClick={() => navigate('/projects')}>Back to Projects</Button>}
        />
      </div>
    )
  }

  function handleSave() {
    persistCanvas(engine.getDocument())
    setJustSaved(true)
    window.setTimeout(() => setJustSaved(false), 1600)
  }

  function handleExport() {
    const url = engine.exportPNG()
    if (!url) return
    const link = document.createElement('a')
    link.href = url
    link.download = `${room!.name.replace(/\s+/g, '-')}-canvas.png`
    link.click()
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-ink-950">
      <CanvasTopBar
        engine={engine}
        snapshot={snapshot}
        roomName={room.name}
        onBack={() => navigate(`/projects/${project.id}/rooms/${room.id}`)}
        onSave={handleSave}
        onExport={handleExport}
        onOpenSheet={() => setSheetPanelOpen(true)}
        justSaved={justSaved}
        currentViewId={currentViewId}
        walls={walls}
        onSwitchView={switchView}
      />

      <div className="flex flex-1 overflow-hidden">
        {isDesignerMode && (
          <div className="hidden md:flex">
            <CanvasLeftToolbar engine={engine} snapshot={snapshot} />
          </div>
        )}

        <div className="relative flex-1 overflow-hidden">
          <CanvasSurface engine={engine} snapshot={snapshot} />

          {/* iPhone: floating access to tools + properties, since there's no room for fixed rails.
              Hidden in Execution/Presentation — those modes are for viewing/handoff, not editing. */}
          {isDesignerMode && (
            <div className="absolute inset-x-0 bottom-3 flex items-center justify-between px-3 md:hidden">
              <button
                onClick={() => setToolSheetOpen(true)}
                className="flex h-12 items-center gap-2 rounded-full bg-ink-900/95 px-4 text-sm font-semibold text-sand-50 shadow-soft backdrop-blur active:scale-95"
              >
                <PenTool className="h-4 w-4" />
                Tools
              </button>
              {snapshot.selection.length > 0 && (
                <button
                  onClick={() => setPropertySheetOpen(true)}
                  className="flex h-12 items-center gap-2 rounded-full bg-brass-500 px-4 text-sm font-semibold text-ink-950 shadow-soft active:scale-95"
                >
                  <Sliders className="h-4 w-4" />
                  Properties
                </button>
              )}
            </div>
          )}
        </div>

        {isDesignerMode && (
          <div className="hidden md:flex">
            <PropertyPanel engine={engine} snapshot={snapshot} />
          </div>
        )}
      </div>

      <CanvasBottomBar engine={engine} snapshot={snapshot} />

      <MobileToolSheet
        engine={engine}
        snapshot={snapshot}
        open={toolSheetOpen}
        onClose={() => setToolSheetOpen(false)}
        currentViewId={currentViewId}
        walls={walls}
        onSwitchView={switchView}
      />
      <MobilePropertySheet engine={engine} snapshot={snapshot} open={propertySheetOpen} onClose={() => setPropertySheetOpen(false)} />
      <DrawingSheetPanel
        engine={engine}
        snapshot={snapshot}
        open={sheetPanelOpen}
        onClose={() => setSheetPanelOpen(false)}
        context={{ projectName: project.name, clientName: client?.name ?? '', roomName: room.name }}
      />
    </div>
  )
}
