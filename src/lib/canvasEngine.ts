import { generateId } from '@/lib/id'
import {
  arcFromBulge,
  boundsOfPoints,
  distance,
  distanceToPolyline,
  objectCenter,
  objectSnapPoints,
  orthoConstrain,
  pointInCircle,
  pointInPolygon,
  pointInRotatedRect,
  rotatePoint,
  rotatedCorners,
  snapPoint,
} from '@/lib/canvasMath'
import type {
  CanvasDocument,
  CanvasLayer,
  CanvasObject,
  CanvasObjectType,
  CanvasSettings,
  CanvasToolId,
  CanvasUnit,
  FillFit,
  Point,
  PreciseCreateSpec,
} from '@/types/canvas'
import { CLOSED_SHAPE_TYPES } from '@/types/canvas'
import type { Material } from '@/types/materials'
import { getMaterialById } from '@/data/materials'
import { getMaterialPatternCanvas } from '@/lib/materialPatterns'
import { getCachedImage, onImageReady } from '@/lib/imageUtils'

const MIN_SIZE = 20 // mm — smallest a drawn shape can collapse to
const HANDLE_SCREEN_SIZE = 16 // px
const HANDLE_HIT_PADDING = 10 // px
const ROTATE_HANDLE_OFFSET = 34 // px, above the top edge
const CLICK_DRAG_THRESHOLD = 6 // px — below this, a "drag" is treated as a tap
const MAX_HISTORY = 60
const DEFAULT_ZOOM = 0.15 // px per mm
const MIN_ZOOM = 0.01
const MAX_ZOOM = 6
const SURFACE_COLOR = '#eef0ee'
const GRID_LINE_COLOR = 'rgba(34, 31, 27, 0.08)'
const GRID_AXIS_COLOR = 'rgba(34, 31, 27, 0.18)'

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

interface Viewport {
  zoom: number
  offsetX: number
  offsetY: number
}

type DragKind = 'move' | 'resize' | 'rotate' | 'marquee' | 'lasso' | 'pan'

interface DragState {
  kind: DragKind
  startWorld: Point
  currentWorld: Point
  handle?: ResizeHandle
  before: CanvasObject[]
  initial: Map<string, CanvasObject>
  center?: Point
  startAngleOffset?: number
}

interface DraftState {
  type: CanvasObjectType
  start: Point
  /** Screen-space point where the draft started — used to tell a tap from a drag. */
  startScreen: Point
  points: Point[]
  current: Point
}

export interface CanvasEngineSnapshot {
  tool: CanvasToolId
  selection: string[]
  selectedObjects: CanvasObject[]
  objects: CanvasObject[]
  layers: CanvasLayer[]
  activeLayerId: string
  settings: CanvasSettings
  zoomPercent: number
  canUndo: boolean
  canRedo: boolean
  activeFill: string
  activeStroke: string
  activeStrokeWidth: number
  activeOpacity: number
  activeMaterial: Material | null
  recentColors: string[]
  drawingPolygon: boolean
  polygonPointCount: number
  editingTextId: string | null
  clipboardCount: number
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

function cloneObjects(objects: CanvasObject[]): CanvasObject[] {
  return objects.map((o) => ({ ...o, points: o.points ? o.points.map((p) => ({ ...p })) : undefined }))
}

function measureTextSize(ctx: CanvasRenderingContext2D | null, text: string, fontSize: number) {
  if (ctx) {
    ctx.save()
    ctx.font = `${fontSize}px Manrope, sans-serif`
    const width = Math.max(ctx.measureText(text || ' ').width, fontSize * 0.6)
    ctx.restore()
    return { width, height: fontSize * 1.4 }
  }
  return { width: Math.max((text || ' ').length * fontSize * 0.55, fontSize), height: fontSize * 1.4 }
}

export class CanvasEngine {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private dpr = 1
  private cssWidth = 0
  private cssHeight = 0

  private viewport: Viewport = { zoom: DEFAULT_ZOOM, offsetX: 0, offsetY: 0 }
  private doc: CanvasDocument
  private selection: string[] = []
  private tool: CanvasToolId = 'select'
  /** Desktop "hold Space to pan" — a temporary override that doesn't touch `tool`, so releasing Space resumes whatever was active. */
  private spacePanOverride = false

  private past: CanvasObject[][] = []
  private future: CanvasObject[][] = []

  private drag: DragState | null = null
  private draft: DraftState | null = null
  private marqueeRect: { x: number; y: number; width: number; height: number } | null = null
  /** V3B lasso tool — world-space polyline while dragging; resolved into a selection on release, then cleared. */
  private lassoPoints: Point[] = []

  /** V3A Measure tool — always ephemeral: never written to doc.objects or undo history. */
  private measureDraft: { start: Point; current: Point } | null = null
  private lastMeasurement: { a: Point; b: Point; distance: number; dx: number; dy: number } | null = null
  /** V3A smart alignment guides — world-space x/y lines to draw while a move-drag is snapped to another object. */
  private alignmentGuides: { x?: number; y?: number } = {}

  private activeFill = '#c9a15f'
  private activeStroke = '#221f1b'
  private activeStrokeWidth = 6
  private activeOpacity = 1
  private activeMaterial: Material | null = null
  private recentColors: string[] = []
  private clipboard: CanvasObject[] = []
  private editingTextId: string | null = null

  private listeners = new Set<() => void>()
  private rafScheduled = false
  private snapshotCache: CanvasEngineSnapshot | null = null

  constructor(doc: CanvasDocument) {
    this.doc = doc
  }

  // ---------------------------------------------------------------- pubsub
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify() {
    this.snapshotCache = null
    for (const l of this.listeners) l()
  }

  getSnapshot(): CanvasEngineSnapshot {
    if (this.snapshotCache) return this.snapshotCache
    const selectedObjects = this.doc.objects.filter((o) => this.selection.includes(o.id))
    this.snapshotCache = {
      tool: this.tool,
      selection: this.selection,
      selectedObjects,
      objects: this.doc.objects,
      layers: this.doc.layers,
      activeLayerId: this.doc.activeLayerId,
      settings: this.doc.settings,
      zoomPercent: Math.round(this.viewport.zoom * 100),
      canUndo: this.past.length > 0,
      canRedo: this.future.length > 0,
      activeFill: this.activeFill,
      activeStroke: this.activeStroke,
      activeStrokeWidth: this.activeStrokeWidth,
      activeOpacity: this.activeOpacity,
      activeMaterial: this.activeMaterial,
      recentColors: this.recentColors,
      drawingPolygon: this.draft?.type === 'polygon',
      polygonPointCount: this.draft?.type === 'polygon' ? this.draft.points.length : 0,
      editingTextId: this.editingTextId,
      clipboardCount: this.clipboard.length,
    }
    return this.snapshotCache
  }

  // ------------------------------------------------------------- document
  getDocument(): CanvasDocument {
    return { ...this.doc, objects: cloneObjects(this.doc.objects), updatedAt: new Date().toISOString() }
  }

  loadDocument(doc: CanvasDocument) {
    this.doc = doc
    this.selection = []
    this.past = []
    this.future = []
    this.draft = null
    this.drag = null
    this.notify()
    this.scheduleRender()
  }

  // -------------------------------------------------------------- canvas
  setCanvasElement(canvas: HTMLCanvasElement | null) {
    this.canvas = canvas
    this.ctx = canvas ? canvas.getContext('2d') : null
    this.scheduleRender()
  }

  resize(cssWidth: number, cssHeight: number, dpr: number) {
    this.cssWidth = cssWidth
    this.cssHeight = cssHeight
    this.dpr = dpr
    if (this.canvas) {
      this.canvas.width = Math.max(1, Math.round(cssWidth * dpr))
      this.canvas.height = Math.max(1, Math.round(cssHeight * dpr))
    }
    this.scheduleRender()
  }

  scheduleRender() {
    if (this.rafScheduled) return
    this.rafScheduled = true
    requestAnimationFrame(() => {
      this.rafScheduled = false
      this.render()
    })
  }

  // -------------------------------------------------------------- history
  private snapshot(): CanvasObject[] {
    return cloneObjects(this.doc.objects)
  }

  private commit(before: CanvasObject[]) {
    const changed = JSON.stringify(before) !== JSON.stringify(this.doc.objects)
    if (!changed) return
    this.past.push(before)
    if (this.past.length > MAX_HISTORY) this.past.shift()
    this.future = []
  }

  undo() {
    if (this.past.length === 0) return
    const prev = this.past.pop()!
    this.future.push(this.snapshot())
    this.doc = { ...this.doc, objects: prev }
    this.selection = this.selection.filter((id) => prev.some((o) => o.id === id))
    this.notify()
    this.scheduleRender()
  }

  redo() {
    if (this.future.length === 0) return
    const next = this.future.pop()!
    this.past.push(this.snapshot())
    this.doc = { ...this.doc, objects: next }
    this.selection = this.selection.filter((id) => next.some((o) => o.id === id))
    this.notify()
    this.scheduleRender()
  }

  // ------------------------------------------------------------ viewport
  screenToWorld(pt: Point): Point {
    return {
      x: (pt.x - this.viewport.offsetX) / this.viewport.zoom,
      y: (pt.y - this.viewport.offsetY) / this.viewport.zoom,
    }
  }

  worldToScreen(pt: Point): Point {
    return {
      x: pt.x * this.viewport.zoom + this.viewport.offsetX,
      y: pt.y * this.viewport.zoom + this.viewport.offsetY,
    }
  }

  zoomAt(screenPt: Point, factor: number) {
    const worldBefore = this.screenToWorld(screenPt)
    this.viewport.zoom = clamp(this.viewport.zoom * factor, MIN_ZOOM, MAX_ZOOM)
    const worldAfter = this.screenToWorld(screenPt)
    this.viewport.offsetX += (worldAfter.x - worldBefore.x) * this.viewport.zoom
    this.viewport.offsetY += (worldAfter.y - worldBefore.y) * this.viewport.zoom
    this.notify()
    this.scheduleRender()
  }

  zoomIn() {
    this.zoomAt({ x: this.cssWidth / 2, y: this.cssHeight / 2 }, 1.2)
  }

  zoomOut() {
    this.zoomAt({ x: this.cssWidth / 2, y: this.cssHeight / 2 }, 1 / 1.2)
  }

  panBy(dx: number, dy: number) {
    this.viewport.offsetX += dx
    this.viewport.offsetY += dy
    this.notify()
    this.scheduleRender()
  }

  /** Used by the two-finger pinch gesture; absolute rather than incremental. */
  pinchTo(zoom: number, screenFocalPt: Point, worldFocalPt: Point) {
    this.viewport.zoom = clamp(zoom, MIN_ZOOM, MAX_ZOOM)
    this.viewport.offsetX = screenFocalPt.x - worldFocalPt.x * this.viewport.zoom
    this.viewport.offsetY = screenFocalPt.y - worldFocalPt.y * this.viewport.zoom
    this.notify()
    this.scheduleRender()
  }

  /**
   * "Reset to 100%" — zoom is a pure viewport transform, so 100% means
   * exactly 1 screen px per document mm (`viewport.zoom = 1`), never a
   * change to any object's stored geometry. Keeps whatever world point is
   * currently centred on screen anchored there, rather than jumping the
   * view back to the document origin.
   */
  resetZoom() {
    const screenCenter = { x: this.cssWidth / 2, y: this.cssHeight / 2 }
    const worldCenter = this.screenToWorld(screenCenter)
    this.viewport.zoom = 1
    this.viewport.offsetX = screenCenter.x - worldCenter.x
    this.viewport.offsetY = screenCenter.y - worldCenter.y
    this.notify()
    this.scheduleRender()
  }

  private static boundsOfObjects(objs: CanvasObject[]): { x: number; y: number; width: number; height: number } {
    if (objs.length === 0) return { x: 0, y: 0, width: 4000, height: 3500 }
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const o of objs) {
      for (const c of rotatedCorners(o)) {
        minX = Math.min(minX, c.x)
        minY = Math.min(minY, c.y)
        maxX = Math.max(maxX, c.x)
        maxY = Math.max(maxY, c.y)
      }
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
  }

  private fitToBounds(bounds: { x: number; y: number; width: number; height: number }) {
    const padding = 80
    const availW = Math.max(this.cssWidth - padding * 2, 100)
    const availH = Math.max(this.cssHeight - padding * 2, 100)
    const zoom = clamp(Math.min(availW / Math.max(bounds.width, 1), availH / Math.max(bounds.height, 1)), MIN_ZOOM, MAX_ZOOM)
    this.viewport.zoom = zoom
    const centerWorld = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
    this.viewport.offsetX = this.cssWidth / 2 - centerWorld.x * zoom
    this.viewport.offsetY = this.cssHeight / 2 - centerWorld.y * zoom
    this.notify()
    this.scheduleRender()
  }

  /** "Fit Drawing" — frames every object in the document. */
  fitToContent() {
    this.fitToBounds(CanvasEngine.boundsOfObjects(this.doc.objects))
  }

  /** "Fit Selection" — frames just the selected objects; falls back to Fit Drawing when nothing is selected. */
  fitToSelection() {
    const selected = this.doc.objects.filter((o) => this.selection.includes(o.id))
    if (selected.length === 0) {
      this.fitToContent()
      return
    }
    this.fitToBounds(CanvasEngine.boundsOfObjects(selected))
  }

  /** Desktop "hold Space to pan" — call with `true` on keydown and `false` on keyup. */
  setSpacePanOverride(active: boolean) {
    this.spacePanOverride = active
  }

  // ---------------------------------------------------------------- tool
  setTool(tool: CanvasToolId) {
    this.cancelDraft()
    if (tool !== 'measure') this.clearMeasurement()
    this.lassoPoints = []
    this.tool = tool
    if (tool !== 'select') this.selection = []
    this.notify()
    this.scheduleRender()
  }

  /** Dismisses the Measure tool's current/last result (e.g. on Escape) without switching tools. */
  clearMeasurement() {
    if (!this.measureDraft && !this.lastMeasurement) return
    this.measureDraft = null
    this.lastMeasurement = null
    this.notify()
    this.scheduleRender()
  }

  setActiveFill(color: string) {
    this.activeFill = color
    this.activeMaterial = null
    this.pushRecentColor(color)
    if (this.selection.length > 0) {
      this.applyToSelection((o) => ({
        ...o,
        fill: color,
        fillType: 'color',
        materialId: undefined,
        imageData: undefined,
        fillFit: undefined,
      }))
    }
    this.notify()
    this.scheduleRender()
  }

  /** Builds the fill patch for applying `material` to an object — shared by setActiveMaterial and the Paint/Fill tool. */
  private materialFillPatch(material: Material): Partial<CanvasObject> {
    if (material.type === 'colour') {
      return {
        fillType: 'color',
        fill: material.baseColor,
        materialId: material.id,
        imageData: undefined,
        fillFit: undefined,
      }
    }
    return {
      fillType: 'texture',
      fill: material.baseColor,
      materialId: material.id,
      imageData: undefined,
      fillFit: undefined,
      textureScale: 1,
      textureRotation: 0,
      textureOffset: { x: 0, y: 0 },
    }
  }

  /** Sets the active material (used by the Material Panel + Paint/Fill tool) and, if anything is selected, applies it immediately. */
  setActiveMaterial(material: Material) {
    this.activeMaterial = material
    if (material.type === 'colour') {
      this.activeFill = material.baseColor
      this.pushRecentColor(material.baseColor)
    }
    if (this.selection.length > 0) {
      const patch = this.materialFillPatch(material)
      this.applyToSelection((o) => (CLOSED_SHAPE_TYPES.includes(o.type) ? { ...o, ...patch } : o))
    }
    this.notify()
    this.scheduleRender()
  }

  clearActiveMaterial() {
    this.activeMaterial = null
    this.notify()
  }

  /** Reverts the selection's fill to a plain colour — used by both "Remove Material" and "Remove Image". The object stays a normal editable vector shape. */
  removeFillOverride() {
    if (this.selection.length === 0) return
    this.applyToSelection((o) => ({
      ...o,
      fillType: 'color',
      materialId: undefined,
      imageData: undefined,
      fillFit: undefined,
    }))
    this.notify()
    this.scheduleRender()
  }

  /** Applies a custom image (already downscaled to a data URI by lib/imageUtils) as the selection's fill. */
  setImageFillOnSelection(dataUrl: string, fit: FillFit = 'cover') {
    if (this.selection.length === 0) return
    getCachedImage(dataUrl) // kick off decode now so the first paint after this call can already show it
    this.applyToSelection((o) => {
      if (!CLOSED_SHAPE_TYPES.includes(o.type)) return o
      return {
        ...o,
        fillType: 'image',
        imageData: dataUrl,
        materialId: undefined,
        fillFit: fit,
        textureScale: o.textureScale ?? 1,
        textureRotation: o.textureRotation ?? 0,
        textureOffset: o.textureOffset ?? { x: 0, y: 0 },
      }
    })
    this.notify()
    this.scheduleRender()
  }

  setActiveStroke(color: string) {
    this.activeStroke = color
    this.pushRecentColor(color)
    if (this.selection.length > 0) this.applyToSelection((o) => ({ ...o, stroke: color }))
    this.notify()
    this.scheduleRender()
  }

  setActiveStrokeWidth(width: number) {
    this.activeStrokeWidth = width
    if (this.selection.length > 0) this.applyToSelection((o) => ({ ...o, strokeWidth: width }))
    this.notify()
    this.scheduleRender()
  }

  setActiveOpacity(opacity: number) {
    this.activeOpacity = opacity
    if (this.selection.length > 0) this.applyToSelection((o) => ({ ...o, opacity }))
    this.notify()
    this.scheduleRender()
  }

  private pushRecentColor(color: string) {
    this.recentColors = [color, ...this.recentColors.filter((c) => c !== color)].slice(0, 8)
  }

  /**
   * `includeLocked: true` is reserved for lock/hide toggling itself — every
   * other bulk edit (fill, stroke, rotate, mirror, layer move, property
   * fields) must leave a locked object untouched, otherwise "locked" would
   * only block dragging and not the "or otherwise edit" half of that rule.
   */
  private applyToSelection(fn: (o: CanvasObject) => CanvasObject, opts: { includeLocked?: boolean } = {}) {
    const before = this.snapshot()
    this.doc = {
      ...this.doc,
      objects: this.doc.objects.map((o) =>
        this.selection.includes(o.id) && (opts.includeLocked || !o.locked) ? fn(o) : o,
      ),
    }
    this.commit(before)
  }

  updateSelectedProps(patch: Partial<CanvasObject>) {
    if (this.selection.length === 0) return
    const before = this.snapshot()
    this.doc = {
      ...this.doc,
      objects: this.doc.objects.map((o) => {
        if (!this.selection.includes(o.id) || o.locked) return o
        const next = { ...o, ...patch }
        if ((patch.text !== undefined || patch.fontSize !== undefined) && next.type === 'text') {
          const size = measureTextSize(this.ctx, next.text ?? '', next.fontSize ?? 32)
          next.width = size.width
          next.height = size.height
        }
        return next
      }),
    }
    this.commit(before)
    this.notify()
    this.scheduleRender()
  }

  // ------------------------------------------------------------ settings
  toggleGrid() {
    this.doc = { ...this.doc, settings: { ...this.doc.settings, showGrid: !this.doc.settings.showGrid } }
    this.notify()
    this.scheduleRender()
  }

  toggleSnap() {
    this.doc = { ...this.doc, settings: { ...this.doc.settings, snapToGrid: !this.doc.settings.snapToGrid } }
    this.notify()
  }

  toggleOrtho() {
    this.doc = { ...this.doc, settings: { ...this.doc.settings, ortho: !this.doc.settings.ortho } }
    this.notify()
  }

  /** Purely a render toggle — never touches object geometry or the manual Dimension tool's persisted objects. */
  toggleShowDimensions() {
    this.doc = { ...this.doc, settings: { ...this.doc.settings, showDimensions: !(this.doc.settings.showDimensions ?? true) } }
    this.notify()
    this.scheduleRender()
  }

  setGridSize(size: number) {
    this.doc = { ...this.doc, settings: { ...this.doc.settings, gridSize: clamp(size, 10, 2000) } }
    this.notify()
    this.scheduleRender()
  }

  cycleUnit() {
    const order: CanvasUnit[] = ['mm', 'cm', 'm']
    const next = order[(order.indexOf(this.doc.settings.unit) + 1) % order.length]
    this.doc = { ...this.doc, settings: { ...this.doc.settings, unit: next } }
    this.notify()
    this.scheduleRender()
  }

  setViewMode(mode: CanvasSettings['viewMode']) {
    this.doc = { ...this.doc, settings: { ...this.doc.settings, viewMode: mode } }
    this.notify()
  }

  // -------------------------------------------------------------- layers
  setActiveLayer(layerId: string) {
    this.doc = { ...this.doc, activeLayerId: layerId }
    this.notify()
  }

  addLayer(name: string) {
    const layer: CanvasLayer = {
      id: generateId('layer'),
      name,
      visible: true,
      locked: false,
      order: this.doc.layers.length,
    }
    this.doc = { ...this.doc, layers: [...this.doc.layers, layer], activeLayerId: layer.id }
    this.notify()
  }

  toggleLayerVisibility(layerId: string) {
    this.doc = {
      ...this.doc,
      layers: this.doc.layers.map((l) => (l.id === layerId ? { ...l, visible: !l.visible } : l)),
    }
    this.notify()
    this.scheduleRender()
  }

  toggleLayerLock(layerId: string) {
    this.doc = {
      ...this.doc,
      layers: this.doc.layers.map((l) => (l.id === layerId ? { ...l, locked: !l.locked } : l)),
    }
    this.notify()
  }

  /**
   * Section 11/12 — layer ORDER (this list's position) is purely
   * organizational, same as everything else about a layer (name,
   * visibility, lock): it's how the Layers panel lists them, not a z-order
   * that reaches into `doc.objects`. Object stacking stays exactly what
   * `reorderSelected` already controls, unaffected by this. Consistent with
   * the other layer methods above, this isn't part of undo history either.
   */
  reorderLayer(layerId: string, direction: 'up' | 'down') {
    const layers = [...this.doc.layers].sort((a, b) => a.order - b.order)
    const index = layers.findIndex((l) => l.id === layerId)
    const swapWith = direction === 'up' ? index - 1 : index + 1
    if (index === -1 || swapWith < 0 || swapWith >= layers.length) return
    ;[layers[index], layers[swapWith]] = [layers[swapWith], layers[index]]
    const reordered = layers.map((l, i) => ({ ...l, order: i }))
    this.doc = { ...this.doc, layers: reordered }
    this.notify()
  }

  setSelectedLayer(layerId: string) {
    this.applyToSelection((o) => ({ ...o, layerId }))
    this.notify()
    this.scheduleRender()
  }

  // ----------------------------------------------------------- selection
  private objectsAndSiblings(id: string): string[] {
    const obj = this.doc.objects.find((o) => o.id === id)
    if (!obj) return [id]
    if (!obj.groupId) return [id]
    return this.doc.objects.filter((o) => o.groupId === obj.groupId).map((o) => o.id)
  }

  selectObject(id: string, additive: boolean) {
    const group = this.objectsAndSiblings(id)
    if (additive) {
      const already = group.every((gid) => this.selection.includes(gid))
      this.selection = already
        ? this.selection.filter((sid) => !group.includes(sid))
        : [...new Set([...this.selection, ...group])]
    } else {
      this.selection = group
    }
    this.notify()
    this.scheduleRender()
  }

  clearSelection() {
    this.selection = []
    this.notify()
    this.scheduleRender()
  }

  selectAll() {
    this.selection = this.doc.objects.filter((o) => o.visible && !o.locked).map((o) => o.id)
    this.notify()
    this.scheduleRender()
  }

  /**
   * V3B lasso tool — deliberately lightweight rather than a true polygon
   * intersection test: an object is selected when its own centre point falls
   * inside the drawn loop. Simple, fast, and predictable for furniture-sized
   * shapes without turning this into a vector-clipping system.
   */
  private resolveLassoSelection() {
    const points = this.lassoPoints
    this.lassoPoints = []
    if (points.length < 3) return
    const rawIds = this.doc.objects
      .filter((o) => o.visible && !o.locked)
      .filter((o) => pointInPolygon(objectCenter(o), points))
      .map((o) => o.id)
    const expanded = new Set<string>()
    for (const id of rawIds) for (const gid of this.objectsAndSiblings(id)) expanded.add(gid)
    this.selection = [...new Set([...this.selection, ...expanded])]
  }

  // -------------------------------------------------------- object edits
  deleteSelected() {
    if (this.selection.length === 0) return
    const before = this.snapshot()
    this.doc = { ...this.doc, objects: this.doc.objects.filter((o) => !this.selection.includes(o.id)) }
    this.selection = []
    this.commit(before)
    this.notify()
    this.scheduleRender()
  }

  duplicateSelected() {
    if (this.selection.length === 0) return
    const before = this.snapshot()
    const offset = this.doc.settings.gridSize > 0 ? this.doc.settings.gridSize : 40
    const newGroupMap = new Map<string, string>()
    const copies = this.doc.objects
      .filter((o) => this.selection.includes(o.id))
      .map((o) => {
        let groupId = o.groupId
        if (groupId) {
          if (!newGroupMap.has(groupId)) newGroupMap.set(groupId, generateId('group'))
          groupId = newGroupMap.get(groupId)
        }
        return { ...o, id: generateId('obj'), x: o.x + offset, y: o.y + offset, groupId }
      })
    this.doc = { ...this.doc, objects: [...this.doc.objects, ...copies] }
    this.selection = copies.map((c) => c.id)
    this.commit(before)
    this.notify()
    this.scheduleRender()
  }

  copySelection() {
    this.clipboard = cloneObjects(this.doc.objects.filter((o) => this.selection.includes(o.id)))
    this.notify()
  }

  pasteClipboard() {
    if (this.clipboard.length === 0) return
    const before = this.snapshot()
    const offset = this.doc.settings.gridSize > 0 ? this.doc.settings.gridSize : 40
    const newGroupMap = new Map<string, string>()
    const copies = this.clipboard.map((o) => {
      let groupId = o.groupId
      if (groupId) {
        if (!newGroupMap.has(groupId)) newGroupMap.set(groupId, generateId('group'))
        groupId = newGroupMap.get(groupId)
      }
      return { ...o, id: generateId('obj'), x: o.x + offset, y: o.y + offset, groupId }
    })
    this.doc = { ...this.doc, objects: [...this.doc.objects, ...copies] }
    this.selection = copies.map((c) => c.id)
    this.commit(before)
    this.notify()
    this.scheduleRender()
  }

  rotateSelectedBy(deltaDeg: number) {
    if (this.selection.length === 0) return
    this.applyToSelection((o) => ({ ...o, rotation: (o.rotation + deltaDeg + 360) % 360 }))
    this.notify()
    this.scheduleRender()
  }

  mirrorSelected(axis: 'horizontal' | 'vertical') {
    if (this.selection.length === 0) return
    this.applyToSelection((o) => {
      if (!o.points) return { ...o, rotation: axis === 'horizontal' ? (360 - o.rotation) % 360 : (180 - o.rotation + 360) % 360 }
      const points = o.points.map((p) =>
        axis === 'horizontal' ? { x: o.width - p.x, y: p.y } : { x: p.x, y: o.height - p.y },
      )
      return { ...o, points }
    })
    this.notify()
    this.scheduleRender()
  }

  toggleLockSelected() {
    if (this.selection.length === 0) return
    this.applyToSelection((o) => ({ ...o, locked: !o.locked }), { includeLocked: true })
    this.notify()
    this.scheduleRender()
  }

  toggleVisibleSelected() {
    if (this.selection.length === 0) return
    this.applyToSelection((o) => ({ ...o, visible: !o.visible }), { includeLocked: true })
    this.notify()
    this.scheduleRender()
  }

  groupSelected() {
    if (this.selection.length < 2) return
    const groupId = generateId('group')
    this.applyToSelection((o) => ({ ...o, groupId }))
    this.notify()
  }

  ungroupSelected() {
    if (this.selection.length === 0) return
    this.applyToSelection((o) => ({ ...o, groupId: undefined }))
    this.notify()
  }

  /**
   * Splits the current (non-locked) selection into movable clusters — a
   * grouped object's whole group moves together as one rigid unit, an
   * ungrouped object is its own cluster of one. Shared by Align and
   * Distribute so a group's internal arrangement survives either operation
   * instead of its members scattering independently.
   */
  private selectionClusters(): CanvasObject[][] {
    const byGroup = new Map<string, CanvasObject[]>()
    for (const o of this.doc.objects) {
      if (!this.selection.includes(o.id) || o.locked) continue
      const key = o.groupId ?? o.id
      const list = byGroup.get(key)
      if (list) list.push(o)
      else byGroup.set(key, [o])
    }
    return [...byGroup.values()]
  }

  /** Section 4 — align selected objects'/groups' bounds to the overall selection bounds. */
  alignSelected(mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') {
    const clusters = this.selectionClusters()
    if (clusters.length < 2) return
    const before = this.snapshot()
    const overall = CanvasEngine.boundsOfObjects(clusters.flat())
    const deltas = new Map<string, { dx: number; dy: number }>()

    for (const cluster of clusters) {
      const bounds = CanvasEngine.boundsOfObjects(cluster)
      let dx = 0
      let dy = 0
      if (mode === 'left') dx = overall.x - bounds.x
      else if (mode === 'right') dx = overall.x + overall.width - (bounds.x + bounds.width)
      else if (mode === 'center') dx = overall.x + overall.width / 2 - (bounds.x + bounds.width / 2)
      else if (mode === 'top') dy = overall.y - bounds.y
      else if (mode === 'bottom') dy = overall.y + overall.height - (bounds.y + bounds.height)
      else dy = overall.y + overall.height / 2 - (bounds.y + bounds.height / 2)
      for (const o of cluster) deltas.set(o.id, { dx, dy })
    }

    this.doc = {
      ...this.doc,
      objects: this.doc.objects.map((o) => {
        const d = deltas.get(o.id)
        return d ? { ...o, x: o.x + d.dx, y: o.y + d.dy } : o
      }),
    }
    this.commit(before)
    this.notify()
    this.scheduleRender()
  }

  /**
   * Section 5 — equal-gap distribution along one axis. Keeps the two
   * outermost clusters fixed and spaces the rest so the GAP between adjacent
   * bounds is identical, which (unlike equal centre-spacing) stays correct
   * when clusters are different sizes and never resizes anything.
   */
  distributeSelected(axis: 'horizontal' | 'vertical') {
    const clusters = this.selectionClusters()
    if (clusters.length < 3) return
    const before = this.snapshot()

    const withBounds = clusters
      .map((cluster) => ({ cluster, bounds: CanvasEngine.boundsOfObjects(cluster) }))
      .sort((a, b) => (axis === 'horizontal' ? a.bounds.x - b.bounds.x : a.bounds.y - b.bounds.y))

    const first = withBounds[0].bounds
    const last = withBounds[withBounds.length - 1].bounds
    const totalSpan =
      axis === 'horizontal' ? last.x + last.width - first.x : last.y + last.height - first.y
    const sumSizes = withBounds.reduce((sum, w) => sum + (axis === 'horizontal' ? w.bounds.width : w.bounds.height), 0)
    const gap = (totalSpan - sumSizes) / (withBounds.length - 1)

    const deltas = new Map<string, { dx: number; dy: number }>()
    let cursor = axis === 'horizontal' ? first.x : first.y
    for (const { cluster, bounds } of withBounds) {
      const size = axis === 'horizontal' ? bounds.width : bounds.height
      const targetStart = cursor
      const currentStart = axis === 'horizontal' ? bounds.x : bounds.y
      const delta = targetStart - currentStart
      for (const o of cluster) deltas.set(o.id, axis === 'horizontal' ? { dx: delta, dy: 0 } : { dx: 0, dy: delta })
      cursor += size + gap
    }

    this.doc = {
      ...this.doc,
      objects: this.doc.objects.map((o) => {
        const d = deltas.get(o.id)
        return d ? { ...o, x: o.x + d.dx, y: o.y + d.dy } : o
      }),
    }
    this.commit(before)
    this.notify()
    this.scheduleRender()
  }

  /**
   * Section 7 — exact-distance duplication: `count` successive copies, each
   * offset by (dxMm, dyMm) from the previous one, in real-world Canvas
   * coordinates. Reuses the same groupId-remap pattern as duplicateSelected
   * so a duplicated group stays one group, not `count` merged ones.
   */
  duplicateWithOffset(dxMm: number, dyMm: number, count: number) {
    if (this.selection.length === 0 || count < 1) return
    const before = this.snapshot()
    const source = this.doc.objects.filter((o) => this.selection.includes(o.id))
    const allCopies: CanvasObject[] = []
    for (let step = 1; step <= count; step++) {
      const newGroupMap = new Map<string, string>()
      for (const o of source) {
        let groupId = o.groupId
        if (groupId) {
          if (!newGroupMap.has(groupId)) newGroupMap.set(groupId, generateId('group'))
          groupId = newGroupMap.get(groupId)
        }
        allCopies.push({ ...o, id: generateId('obj'), x: o.x + dxMm * step, y: o.y + dyMm * step, groupId })
      }
    }
    this.doc = { ...this.doc, objects: [...this.doc.objects, ...allCopies] }
    this.selection = allCopies.map((c) => c.id)
    this.commit(before)
    this.notify()
    this.scheduleRender()
  }

  /**
   * Object-level stacking order (front/back visual z-order within the flat
   * `doc.objects` array) — deliberately independent of layer membership, per
   * V3B's "layer = organizational category, stacking = visual order" split.
   * None of these branches ever touch `layerId`. Works for any selection
   * size: 'front'/'back' move the whole selected set (in its existing
   * relative order) to the very end/start of the array; 'up'/'down' step
   * every selected object past exactly one unselected neighbour, which for a
   * single selected object is the familiar "swap with the next object" and
   * generalizes predictably to a multi-selection moving forward/back together.
   */
  reorderSelected(direction: 'up' | 'down' | 'front' | 'back') {
    if (this.selection.length === 0) return
    const before = this.snapshot()
    const selected = new Set(this.selection)
    let objects = [...this.doc.objects]

    if (direction === 'front') {
      const rest = objects.filter((o) => !selected.has(o.id))
      const moved = objects.filter((o) => selected.has(o.id))
      objects = [...rest, ...moved]
    } else if (direction === 'back') {
      const rest = objects.filter((o) => !selected.has(o.id))
      const moved = objects.filter((o) => selected.has(o.id))
      objects = [...moved, ...rest]
    } else if (direction === 'up') {
      for (let i = objects.length - 2; i >= 0; i--) {
        if (selected.has(objects[i].id) && !selected.has(objects[i + 1].id)) {
          ;[objects[i], objects[i + 1]] = [objects[i + 1], objects[i]]
        }
      }
    } else {
      for (let i = 1; i < objects.length; i++) {
        if (selected.has(objects[i].id) && !selected.has(objects[i - 1].id)) {
          ;[objects[i], objects[i - 1]] = [objects[i - 1], objects[i]]
        }
      }
    }

    this.doc = { ...this.doc, objects }
    this.commit(before)
    this.notify()
    this.scheduleRender()
  }

  // ------------------------------------------------------------- fill/eyedropper
  private applyFillAt(worldPt: Point) {
    const target = this.hitTestClosedShape(worldPt)
    if (!target) return
    const before = this.snapshot()
    const patch: Partial<CanvasObject> = this.activeMaterial
      ? this.materialFillPatch(this.activeMaterial)
      : { fill: this.activeFill, fillType: 'color', materialId: undefined, imageData: undefined, fillFit: undefined, opacity: this.activeOpacity }
    this.doc = {
      ...this.doc,
      objects: this.doc.objects.map((o) => (o.id === target.id ? { ...o, ...patch } : o)),
    }
    this.commit(before)
    this.notify()
    this.scheduleRender()
  }

  private pickColorAt(worldPt: Point) {
    const target = this.hitTest(worldPt)
    if (!target) return
    // Colour eyedropper always captures the object's flat colour, unchanged from V1.
    this.activeFill = target.fill
    this.pushRecentColor(target.fill)
    // Material/image objects additionally hand back their material, where one exists,
    // so a filled shape's look can be reused elsewhere without breaking the colour capture above.
    this.activeMaterial = target.fillType === 'texture' && target.materialId ? (getMaterialById(target.materialId) ?? null) : null
    this.tool = 'select'
    this.notify()
  }

  // -------------------------------------------------------------- text
  startTextEdit(id: string) {
    this.editingTextId = id
    this.notify()
  }

  commitTextEdit(id: string, text: string) {
    const before = this.snapshot()
    this.doc = {
      ...this.doc,
      objects: this.doc.objects.map((o) => {
        if (o.id !== id) return o
        const size = measureTextSize(this.ctx, text, o.fontSize ?? 32)
        return { ...o, text, width: size.width, height: size.height }
      }),
    }
    this.editingTextId = null
    this.commit(before)
    this.notify()
    this.scheduleRender()
  }

  cancelTextEdit() {
    const id = this.editingTextId
    this.editingTextId = null
    if (id) {
      const obj = this.doc.objects.find((o) => o.id === id)
      if (obj && !obj.text?.trim()) {
        this.doc = { ...this.doc, objects: this.doc.objects.filter((o) => o.id !== id) }
        this.selection = this.selection.filter((sid) => sid !== id)
      }
    }
    this.notify()
    this.scheduleRender()
  }

  // ----------------------------------------------------------- polygon
  finishPolygon() {
    if (this.draft?.type !== 'polygon') return
    if (this.draft.points.length >= 3) {
      this.commitDraftObject(true)
    } else {
      this.draft = null
      this.scheduleRender()
    }
    this.notify()
  }

  cancelDraft() {
    if (this.draft) {
      this.draft = null
      this.scheduleRender()
    }
  }

  // -------------------------------------------------------------- hit test
  private hitTestHandles(worldPt: Point, screenPt: Point): ResizeHandle | 'rotate' | null {
    if (this.selection.length !== 1) return null
    const obj = this.doc.objects.find((o) => o.id === this.selection[0])
    if (!obj || obj.locked) return null
    const center = objectCenter(obj)
    const half = { x: obj.width / 2, y: obj.height / 2 }
    const localHandlePositions: Record<ResizeHandle, Point> = {
      nw: { x: -half.x, y: -half.y },
      n: { x: 0, y: -half.y },
      ne: { x: half.x, y: -half.y },
      e: { x: half.x, y: 0 },
      se: { x: half.x, y: half.y },
      s: { x: 0, y: half.y },
      sw: { x: -half.x, y: half.y },
      w: { x: -half.x, y: 0 },
    }
    for (const [handle, local] of Object.entries(localHandlePositions) as [ResizeHandle, Point][]) {
      const world = rotatePoint({ x: center.x + local.x, y: center.y + local.y }, center, obj.rotation)
      const screen = this.worldToScreen(world)
      if (distance(screen, screenPt) <= HANDLE_SCREEN_SIZE / 2 + HANDLE_HIT_PADDING) return handle
    }
    const rotateLocal = { x: 0, y: -half.y - ROTATE_HANDLE_OFFSET / this.viewport.zoom }
    const rotateWorld = rotatePoint({ x: center.x + rotateLocal.x, y: center.y + rotateLocal.y }, center, obj.rotation)
    const rotateScreen = this.worldToScreen(rotateWorld)
    if (distance(rotateScreen, screenPt) <= HANDLE_SCREEN_SIZE / 2 + HANDLE_HIT_PADDING) return 'rotate'
    void worldPt
    return null
  }

  /** Aborts whatever single-pointer gesture is in flight without committing — used when a second touch point arrives (starting a pinch). */
  cancelGesture() {
    this.drag = null
    this.draft = null
    this.marqueeRect = null
    this.lassoPoints = []
    this.alignmentGuides = {}
    this.scheduleRender()
  }

  /** Public hit-test in screen space, for double-tap/double-click handling in the React layer. */
  objectAtScreen(screenPt: Point): CanvasObject | null {
    return this.hitTest(this.screenToWorld(screenPt))
  }

  private hitTest(worldPt: Point): CanvasObject | null {
    const layerLookup = new Map(this.doc.layers.map((l) => [l.id, l]))
    for (let i = this.doc.objects.length - 1; i >= 0; i--) {
      const o = this.doc.objects[i]
      const layer = layerLookup.get(o.layerId)
      if (!o.visible || (layer && !layer.visible)) continue
      if (this.objectContainsPoint(o, worldPt)) return o
    }
    return null
  }

  private hitTestClosedShape(worldPt: Point): CanvasObject | null {
    const hit = this.hitTest(worldPt)
    if (hit && CLOSED_SHAPE_TYPES.includes(hit.type)) return hit
    return null
  }

  private objectContainsPoint(o: CanvasObject, worldPt: Point): boolean {
    const padding = 6 / this.viewport.zoom
    switch (o.type) {
      case 'circle':
        return pointInCircle(worldPt, o, padding)
      case 'rectangle':
      case 'square':
      case 'text':
        return pointInRotatedRect(worldPt, o, padding)
      case 'polygon': {
        if (!o.points) return false
        const center = objectCenter(o)
        const local = rotatePoint(worldPt, center, -o.rotation)
        const abs = o.points.map((p) => ({ x: o.x + p.x, y: o.y + p.y }))
        return pointInPolygon(local, abs) || distanceToPolyline(local, abs, true) <= padding
      }
      case 'line':
      case 'arc':
      case 'freeDraw':
      case 'dimension': {
        if (!o.points) return false
        const center = objectCenter(o)
        const local = rotatePoint(worldPt, center, -o.rotation)
        const abs = o.points.map((p) => ({ x: o.x + p.x, y: o.y + p.y }))
        return distanceToPolyline(local, abs, false) <= padding + o.strokeWidth
      }
      default:
        return pointInRotatedRect(worldPt, o, padding)
    }
  }

  // -------------------------------------------------------------- pointer
  private maybeSnap(pt: Point): Point {
    return this.doc.settings.snapToGrid ? snapPoint(pt, this.doc.settings.gridSize) : pt
  }

  private isTwoPointTool(tool: CanvasToolId): tool is 'rectangle' | 'square' | 'circle' | 'line' | 'arc' {
    return tool === 'rectangle' || tool === 'square' || tool === 'circle' || tool === 'line' || tool === 'arc'
  }

  private isTwoPointObjectType(type: CanvasObjectType): boolean {
    return type === 'rectangle' || type === 'square' || type === 'circle' || type === 'line' || type === 'arc'
  }

  pointerDown(screenPt: Point, opts: { shiftKey?: boolean } = {}) {
    const worldRaw = this.screenToWorld(screenPt)
    const world = this.maybeSnap(worldRaw)

    if (this.spacePanOverride || this.tool === 'pan') {
      this.drag = { kind: 'pan', startWorld: screenPt, currentWorld: screenPt, before: [], initial: new Map() }
      return
    }

    if (this.tool === 'measure') {
      this.measureDraft = { start: worldRaw, current: worldRaw }
      this.lastMeasurement = null
      this.notify()
      return
    }

    if (this.tool === 'lasso') {
      if (!opts.shiftKey) this.clearSelection()
      this.lassoPoints = [worldRaw]
      this.drag = { kind: 'lasso', startWorld: worldRaw, currentWorld: worldRaw, before: [], initial: new Map() }
      this.notify()
      return
    }

    if (this.tool === 'fill') {
      this.applyFillAt(worldRaw)
      return
    }

    if (this.tool === 'eyedropper') {
      this.pickColorAt(worldRaw)
      return
    }

    if (this.tool === 'text') {
      const before = this.snapshot()
      const size = measureTextSize(this.ctx, 'Text', 32)
      const obj: CanvasObject = this.baseObject('text', world.x, world.y, size.width, size.height)
      obj.text = 'Text'
      obj.fontSize = 32
      obj.textAlign = 'left'
      obj.strokeEnabled = false
      this.doc = { ...this.doc, objects: [...this.doc.objects, obj] }
      this.selection = [obj.id]
      this.commit(before)
      this.tool = 'select'
      this.notify()
      this.scheduleRender()
      // Mounting the inline text editor (and focusing it) one frame later
      // avoids a browser quirk where the tail end of the same tap/click
      // gesture that created this object (a late compatibility mousedown
      // on the canvas) immediately blurs the editor back to <body>.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.editingTextId = obj.id
          this.notify()
        })
      })
      return
    }

    if (this.tool === 'polygon') {
      if (!this.draft || this.draft.type !== 'polygon') {
        this.draft = { type: 'polygon', start: world, startScreen: screenPt, points: [{ x: 0, y: 0 }], current: world }
      } else {
        // Close if tapping near the first point.
        const firstWorld = { x: this.draft.start.x + this.draft.points[0].x, y: this.draft.start.y + this.draft.points[0].y }
        if (this.draft.points.length >= 3 && distance(this.worldToScreen(firstWorld), screenPt) < 20) {
          this.finishPolygon()
          return
        }
        this.draft.points.push({ x: world.x - this.draft.start.x, y: world.y - this.draft.start.y })
      }
      this.notify()
      this.scheduleRender()
      return
    }

    if (this.tool === 'freeDraw') {
      this.draft = { type: 'freeDraw', start: world, startScreen: screenPt, points: [{ x: 0, y: 0 }], current: world }
      return
    }

    if (this.tool === 'dimension') {
      if (!this.draft || this.draft.type !== 'dimension') {
        this.draft = { type: 'dimension', start: world, startScreen: screenPt, points: [{ x: 0, y: 0 }], current: world }
      } else {
        this.draft.points.push({ x: world.x - this.draft.start.x, y: world.y - this.draft.start.y })
        this.commitDraftObject(true)
      }
      this.notify()
      this.scheduleRender()
      return
    }

    if (this.isTwoPointTool(this.tool)) {
      if (this.draft && this.draft.type === this.tool) {
        // Second click of a "click → click" sequence — finish the shape here.
        this.draft.current = world
        this.commitDraftObject(true)
        return
      }
      this.draft = { type: this.tool, start: world, startScreen: screenPt, points: [], current: world }
      return
    }

    // select tool
    const handle = this.hitTestHandles(worldRaw, screenPt)
    if (handle) {
      const obj = this.doc.objects.find((o) => o.id === this.selection[0])!
      const center = objectCenter(obj)
      this.drag = {
        kind: handle === 'rotate' ? 'rotate' : 'resize',
        startWorld: worldRaw,
        currentWorld: worldRaw,
        handle: handle === 'rotate' ? undefined : handle,
        before: this.snapshot(),
        initial: new Map([[obj.id, { ...obj }]]),
        center,
        startAngleOffset: handle === 'rotate' ? Math.atan2(worldRaw.y - center.y, worldRaw.x - center.x) - degToRadLocal(obj.rotation) : 0,
      }
      return
    }

    const hit = this.hitTest(worldRaw)
    if (hit) {
      // A locked object still needs to be selectable directly — otherwise,
      // with no per-object list anywhere in the UI, locking one from the
      // property panel and then deselecting it would make it permanently
      // unreachable, with no way to ever select it again to unlock it. It
      // just never arms a move-drag, so it can't be dragged out of place.
      if (!this.selection.includes(hit.id)) this.selectObject(hit.id, Boolean(opts.shiftKey))
      if (!hit.locked) {
        const initial = new Map<string, CanvasObject>()
        for (const id of this.selection) {
          const o = this.doc.objects.find((oo) => oo.id === id)
          // A mixed selection (e.g. shift-clicked one locked object in with
          // unlocked ones) still moves — just without dragging the locked
          // member along, so "must not accidentally move" holds per-object.
          if (o && !o.locked) initial.set(id, { ...o })
        }
        this.drag = { kind: 'move', startWorld: world, currentWorld: world, before: this.snapshot(), initial }
      }
      return
    }

    if (!opts.shiftKey) this.clearSelection()
    this.drag = { kind: 'marquee', startWorld: worldRaw, currentWorld: worldRaw, before: [], initial: new Map() }
  }

  pointerMove(screenPt: Point) {
    if (this.measureDraft) {
      this.measureDraft.current = this.screenToWorld(screenPt)
      this.scheduleRender()
      return
    }

    if (this.draft) {
      const worldRaw = this.screenToWorld(screenPt)
      let world = this.maybeSnap(worldRaw)
      if (this.doc.settings.ortho && (this.draft.type === 'line' || this.draft.type === 'dimension')) {
        world = orthoConstrain(this.draft.start, world)
      }
      if (this.draft.type === 'freeDraw') {
        const last = this.draft.points[this.draft.points.length - 1]
        const lastWorld = { x: this.draft.start.x + last.x, y: this.draft.start.y + last.y }
        if (distance(lastWorld, world) > 4 / this.viewport.zoom) {
          this.draft.points.push({ x: world.x - this.draft.start.x, y: world.y - this.draft.start.y })
        }
      }
      this.draft.current = world
      this.scheduleRender()
      return
    }

    if (!this.drag) return
    const worldRaw = this.screenToWorld(screenPt)

    if (this.drag.kind === 'pan') {
      const dx = screenPt.x - this.drag.currentWorld.x
      const dy = screenPt.y - this.drag.currentWorld.y
      this.drag.currentWorld = screenPt
      this.panBy(dx, dy)
      return
    }

    const world = this.maybeSnap(worldRaw)

    if (this.drag.kind === 'lasso') {
      this.drag.currentWorld = worldRaw
      const last = this.lassoPoints[this.lassoPoints.length - 1]
      if (!last || distance(last, worldRaw) > 4 / this.viewport.zoom) {
        this.lassoPoints.push(worldRaw)
      }
      this.scheduleRender()
      return
    }

    if (this.drag.kind === 'marquee') {
      this.drag.currentWorld = worldRaw
      const x = Math.min(this.drag.startWorld.x, worldRaw.x)
      const y = Math.min(this.drag.startWorld.y, worldRaw.y)
      this.marqueeRect = { x, y, width: Math.abs(worldRaw.x - this.drag.startWorld.x), height: Math.abs(worldRaw.y - this.drag.startWorld.y) }
      this.scheduleRender()
      return
    }

    if (this.drag.kind === 'move') {
      let dx = world.x - this.drag.startWorld.x
      let dy = world.y - this.drag.startWorld.y
      this.alignmentGuides = {}

      // Smart snap to other objects' edges/centres — reuses the existing Snap
      // toggle rather than adding a second one. Only the primary (first)
      // selected object drives the match; the whole group still moves by the
      // one resulting dx/dy so it stays rigid.
      if (this.doc.settings.snapToGrid) {
        const primaryInit = this.drag.initial.get(this.selection[0])
        if (primaryInit) {
          const moved = objectSnapPoints({ ...primaryInit, x: primaryInit.x + dx, y: primaryInit.y + dy })
          const threshold = 8 / this.viewport.zoom
          let bestXDist = threshold
          let bestYDist = threshold
          let snappedX: number | undefined
          let snappedY: number | undefined
          let deltaX = 0
          let deltaY = 0
          for (const other of this.doc.objects) {
            if (this.drag.initial.has(other.id) || !other.visible) continue
            const cand = objectSnapPoints(other)
            for (const mx of moved.xs) {
              for (const ox of cand.xs) {
                const d = Math.abs(mx - ox)
                if (d < bestXDist) {
                  bestXDist = d
                  deltaX = ox - mx
                  snappedX = ox
                }
              }
            }
            for (const my of moved.ys) {
              for (const oy of cand.ys) {
                const d = Math.abs(my - oy)
                if (d < bestYDist) {
                  bestYDist = d
                  deltaY = oy - my
                  snappedY = oy
                }
              }
            }
          }
          dx += deltaX
          dy += deltaY
          this.alignmentGuides = { x: snappedX, y: snappedY }
        }
      }

      this.doc = {
        ...this.doc,
        objects: this.doc.objects.map((o) => {
          const init = this.drag!.initial.get(o.id)
          if (!init) return o
          return { ...o, x: init.x + dx, y: init.y + dy }
        }),
      }
      this.scheduleRender()
      return
    }

    if (this.drag.kind === 'resize' && this.drag.handle) {
      const id = this.selection[0]
      const init = this.drag.initial.get(id)
      if (!init) return
      const next = resizeObject(init, this.drag.handle, worldRaw)
      this.doc = { ...this.doc, objects: this.doc.objects.map((o) => (o.id === id ? next : o)) }
      this.scheduleRender()
      return
    }

    if (this.drag.kind === 'rotate') {
      const id = this.selection[0]
      const init = this.drag.initial.get(id)
      if (!init || !this.drag.center) return
      const angle = Math.atan2(worldRaw.y - this.drag.center.y, worldRaw.x - this.drag.center.x)
      let rotationDeg = radToDegLocal(angle - (this.drag.startAngleOffset ?? 0))
      rotationDeg = ((rotationDeg % 360) + 360) % 360
      if (Math.abs(Math.round(rotationDeg / 15) * 15 - rotationDeg) < 3) rotationDeg = Math.round(rotationDeg / 15) * 15
      this.doc = {
        ...this.doc,
        objects: this.doc.objects.map((o) => (o.id === id ? { ...o, rotation: rotationDeg % 360 } : o)),
      }
      this.scheduleRender()
      return
    }
  }

  pointerUp(screenPt?: Point) {
    if (this.measureDraft) {
      const { start: a, current: b } = this.measureDraft
      this.measureDraft = null
      // A tap with no real drag isn't a measurement — just clears the crosshair, matching a mis-tap.
      if (distance(a, b) > 2) {
        this.lastMeasurement = { a, b, distance: distance(a, b), dx: Math.abs(b.x - a.x), dy: Math.abs(b.y - a.y) }
      }
      this.notify()
      this.scheduleRender()
      return
    }

    if (this.draft && this.draft.type !== 'polygon' && this.draft.type !== 'dimension') {
      const isTwoPoint = this.isTwoPointObjectType(this.draft.type)
      const draggedEnough = !screenPt || distance(this.draft.startScreen, screenPt) > CLICK_DRAG_THRESHOLD
      // A two-point tool (rectangle/circle/line/...) with no real drag is the
      // first tap of a "click → click" sequence — leave it armed rather than
      // discarding it, so the next tap can finish the shape.
      if (!isTwoPoint || draggedEnough) {
        this.commitDraftObject(false)
      }
    }
    if (this.drag && this.drag.kind === 'marquee') {
      const rect = this.marqueeRect
      // Direction-sensitive like AutoCAD/most CAD tools: dragging left-to-right
      // is a "window" select (an object must be fully contained), dragging
      // right-to-left is a "crossing" select (any intersection qualifies) —
      // both are predictable once you know the convention, and together they
      // cover "objects intersecting/contained by the selection area."
      const draggedRightward = this.drag.currentWorld.x >= this.drag.startWorld.x
      this.marqueeRect = null
      if (rect && (rect.width > 2 || rect.height > 2)) {
        const rawIds = this.doc.objects
          .filter((o) => o.visible && !o.locked)
          .filter((o) => {
            const corners = rotatedCorners(o)
            const minX = Math.min(...corners.map((c) => c.x))
            const maxX = Math.max(...corners.map((c) => c.x))
            const minY = Math.min(...corners.map((c) => c.y))
            const maxY = Math.max(...corners.map((c) => c.y))
            if (draggedRightward) {
              return minX >= rect.x && maxX <= rect.x + rect.width && minY >= rect.y && maxY <= rect.y + rect.height
            }
            return minX < rect.x + rect.width && maxX > rect.x && minY < rect.y + rect.height && maxY > rect.y
          })
          .map((o) => o.id)
        // Expand to whole groups (grabbing one member selects all of them),
        // then union with whatever selection shift-drag preserved — a plain
        // drag already cleared `this.selection` to [] at pointerDown, so this
        // union is a no-op there and purely additive when shift was held.
        const expanded = new Set<string>()
        for (const id of rawIds) for (const gid of this.objectsAndSiblings(id)) expanded.add(gid)
        this.selection = [...new Set([...this.selection, ...expanded])]
      }
    } else if (this.drag && this.drag.kind === 'lasso') {
      this.resolveLassoSelection()
    } else if (this.drag && (this.drag.kind === 'move' || this.drag.kind === 'resize' || this.drag.kind === 'rotate')) {
      this.commit(this.drag.before)
    }
    if (this.drag?.kind === 'move') this.alignmentGuides = {}
    this.drag = null
    this.notify()
    this.scheduleRender()
  }

  private baseObject(type: CanvasObjectType, x: number, y: number, width: number, height: number): CanvasObject {
    return {
      id: generateId('obj'),
      type,
      x,
      y,
      width,
      height,
      rotation: 0,
      fillType: 'color',
      fill: this.activeFill,
      opacity: this.activeOpacity,
      strokeEnabled: true,
      stroke: this.activeStroke,
      strokeWidth: this.activeStrokeWidth,
      layerId: this.doc.activeLayerId,
      locked: false,
      visible: true,
    }
  }

  /**
   * V3A precision creation — builds a rectangle/circle/line directly from
   * typed numeric fields (the double-click popup), centred on `atWorld`
   * rather than dragged. Goes through the same selection/undo/tool-revert
   * path as a normal drag-committed object.
   */
  createPreciseObject(spec: PreciseCreateSpec, atWorld: Point) {
    const before = this.snapshot()
    let obj: CanvasObject

    if (spec.type === 'rectangle') {
      const width = Math.max(spec.width, MIN_SIZE)
      const height = Math.max(spec.height, MIN_SIZE)
      obj = this.baseObject('rectangle', atWorld.x - width / 2, atWorld.y - height / 2, width, height)
      obj.fill = spec.fill
      obj.stroke = spec.stroke
      if (spec.cornerRadius > 0) obj.cornerRadius = spec.cornerRadius
    } else if (spec.type === 'circle') {
      const size = Math.max(spec.diameter, MIN_SIZE)
      obj = this.baseObject('circle', atWorld.x - size / 2, atWorld.y - size / 2, size, size)
      obj.fill = spec.fill
      obj.stroke = spec.stroke
    } else {
      const length = Math.max(spec.length, 1)
      const rad = degToRadLocal(spec.angleDeg)
      const half = { x: (Math.cos(rad) * length) / 2, y: (Math.sin(rad) * length) / 2 }
      const p1 = { x: -half.x, y: -half.y }
      const p2 = { x: half.x, y: half.y }
      const bounds = boundsOfPoints([p1, p2])
      obj = this.baseObject('line', atWorld.x + bounds.x, atWorld.y + bounds.y, Math.max(bounds.width, 1), Math.max(bounds.height, 1))
      obj.points = [
        { x: p1.x - bounds.x, y: p1.y - bounds.y },
        { x: p2.x - bounds.x, y: p2.y - bounds.y },
      ]
      obj.fillType = 'color'
      obj.stroke = spec.stroke
    }

    this.doc = { ...this.doc, objects: [...this.doc.objects, obj] }
    this.selection = [obj.id]
    this.commit(before)
    this.tool = 'select'
    this.notify()
    this.scheduleRender()
  }

  private commitDraftObject(force: boolean) {
    const draft = this.draft
    this.draft = null
    if (!draft) return
    const before = this.snapshot()
    let obj: CanvasObject | null = null

    if (draft.type === 'rectangle') {
      const x = Math.min(draft.start.x, draft.current.x)
      const y = Math.min(draft.start.y, draft.current.y)
      const width = Math.abs(draft.current.x - draft.start.x)
      const height = Math.abs(draft.current.y - draft.start.y)
      if (width < MIN_SIZE || height < MIN_SIZE) {
        if (!force) return
      }
      obj = this.baseObject('rectangle', x, y, Math.max(width, MIN_SIZE), Math.max(height, MIN_SIZE))
    } else if (draft.type === 'square' || draft.type === 'circle') {
      const dx = draft.current.x - draft.start.x
      const dy = draft.current.y - draft.start.y
      const size = Math.max(Math.abs(dx), Math.abs(dy), MIN_SIZE)
      const x = dx < 0 ? draft.start.x - size : draft.start.x
      const y = dy < 0 ? draft.start.y - size : draft.start.y
      obj = this.baseObject(draft.type, x, y, size, size)
    } else if (draft.type === 'line') {
      const p2 = { x: draft.current.x - draft.start.x, y: draft.current.y - draft.start.y }
      if (distance({ x: 0, y: 0 }, p2) < 2 && !force) return
      const bounds = boundsOfPoints([{ x: 0, y: 0 }, p2])
      obj = this.baseObject('line', draft.start.x + bounds.x, draft.start.y + bounds.y, Math.max(bounds.width, 1), Math.max(bounds.height, 1))
      obj.points = [{ x: -bounds.x, y: -bounds.y }, { x: p2.x - bounds.x, y: p2.y - bounds.y }]
      obj.fillType = 'color'
    } else if (draft.type === 'arc') {
      const p2 = { x: draft.current.x - draft.start.x, y: draft.current.y - draft.start.y }
      if (distance({ x: 0, y: 0 }, p2) < 2 && !force) return
      const bounds = boundsOfPoints([{ x: 0, y: 0 }, p2])
      const padded = { x: bounds.x - bounds.width * 0.3 - 10, y: bounds.y - bounds.height * 0.3 - 10, width: bounds.width * 1.6 + 20, height: bounds.height * 1.6 + 20 }
      obj = this.baseObject('arc', draft.start.x + padded.x, draft.start.y + padded.y, Math.max(padded.width, 1), Math.max(padded.height, 1))
      obj.points = [{ x: -padded.x, y: -padded.y }, { x: p2.x - padded.x, y: p2.y - padded.y }]
      obj.arcBulge = 0.5
    } else if (draft.type === 'polygon') {
      if (draft.points.length < 3) return
      const bounds = boundsOfPoints(draft.points)
      obj = this.baseObject('polygon', draft.start.x + bounds.x, draft.start.y + bounds.y, Math.max(bounds.width, 1), Math.max(bounds.height, 1))
      obj.points = draft.points.map((p) => ({ x: p.x - bounds.x, y: p.y - bounds.y }))
      obj.closed = true
    } else if (draft.type === 'freeDraw') {
      if (draft.points.length < 2) return
      const bounds = boundsOfPoints(draft.points)
      obj = this.baseObject('freeDraw', draft.start.x + bounds.x, draft.start.y + bounds.y, Math.max(bounds.width, 1), Math.max(bounds.height, 1))
      obj.points = draft.points.map((p) => ({ x: p.x - bounds.x, y: p.y - bounds.y }))
      obj.fillType = 'color'
    } else if (draft.type === 'dimension') {
      if (draft.points.length < 2) return
      const p1 = draft.points[0]
      const p2 = draft.points[1]
      const bounds = boundsOfPoints([p1, p2])
      obj = this.baseObject('dimension', draft.start.x + bounds.x, draft.start.y + bounds.y, Math.max(bounds.width, 1), Math.max(bounds.height, 1))
      obj.points = [{ x: p1.x - bounds.x, y: p1.y - bounds.y }, { x: p2.x - bounds.x, y: p2.y - bounds.y }]
      obj.dimensionValue = distance(p1, p2)
      obj.strokeWidth = Math.max(1.5, this.activeStrokeWidth * 0.4)
      obj.layerId = this.doc.layers.find((l) => l.name === 'Dimensions')?.id ?? this.doc.activeLayerId
    }

    if (!obj) return
    this.doc = { ...this.doc, objects: [...this.doc.objects, obj] }
    this.selection = [obj.id]
    this.commit(before)
    this.tool = 'select'
    this.notify()
    this.scheduleRender()
  }

  // -------------------------------------------------------------- export
  exportPNG(): string | null {
    if (!this.canvas) return null
    return this.canvas.toDataURL('image/png')
  }

  // -------------------------------------------------------------- render
  private render() {
    const ctx = this.ctx
    const canvas = this.canvas
    if (!ctx || !canvas) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = SURFACE_COLOR
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const { zoom, offsetX, offsetY } = this.viewport
    ctx.setTransform(this.dpr * zoom, 0, 0, this.dpr * zoom, this.dpr * offsetX, this.dpr * offsetY)

    if (this.doc.settings.showGrid) this.drawGrid(ctx)
    this.drawObjects(ctx)
    this.drawDraft(ctx)

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    this.drawSelectionOverlay(ctx)
    if (this.doc.settings.showDimensions ?? true) this.drawLiveDimensions(ctx)
    this.drawDraftLabel(ctx)
    this.drawMeasure(ctx)
    this.drawAlignmentGuides(ctx)
    this.drawMarquee(ctx)
    this.drawLasso(ctx)
  }

  /** A small screen-space pill label anchored near `worldAnchor`, offset toward screen bottom-right. */
  private drawLabelPill(
    ctx: CanvasRenderingContext2D,
    text: string,
    worldAnchor: Point,
    offset = { x: 14, y: 14 },
    bg = 'rgba(34, 31, 27, 0.88)',
    fg = '#f6f1ea',
  ) {
    const screenPt = this.worldToScreen(worldAnchor)
    this.drawScreenPill(ctx, text, screenPt.x + offset.x, screenPt.y + offset.y, bg, fg)
  }

  /** Same pill, but centred horizontally on an already-known screen point and placed just above it. */
  private drawCenteredScreenPill(ctx: CanvasRenderingContext2D, text: string, screenPt: Point, bg: string, fg: string) {
    ctx.save()
    ctx.font = '600 12px Manrope, sans-serif'
    const boxW = ctx.measureText(text).width + 16
    ctx.restore()
    this.drawScreenPill(ctx, text, screenPt.x - boxW / 2, screenPt.y - 32, bg, fg)
  }

  private drawScreenPill(ctx: CanvasRenderingContext2D, text: string, bx: number, by: number, bg: string, fg: string) {
    const padX = 8
    const boxH = 22
    ctx.save()
    ctx.font = '600 12px Manrope, sans-serif'
    const boxW = ctx.measureText(text).width + padX * 2
    ctx.fillStyle = bg
    ctx.beginPath()
    ctx.roundRect(bx, by, boxW, boxH, 5)
    ctx.fill()
    ctx.fillStyle = fg
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, bx + padX, by + boxH / 2)
    ctx.restore()
  }

  /**
   * Manual Measure tool (AURA CANVAS V3A) — always ephemeral (never written
   * to doc.objects/history). Visually distinct (blue) from the amber
   * automatic-dimension labels so the two are never confused: this measures
   * arbitrary distance, it doesn't describe an object.
   */
  private drawMeasure(ctx: CanvasRenderingContext2D) {
    const pair = this.measureDraft ? { a: this.measureDraft.start, b: this.measureDraft.current } : this.lastMeasurement
    if (!pair) return
    const { a, b } = pair
    const sa = this.worldToScreen(a)
    const sb = this.worldToScreen(b)
    const unit = this.doc.settings.unit
    const MEASURE_COLOR = '#2f6fed'

    ctx.save()
    ctx.strokeStyle = MEASURE_COLOR
    ctx.fillStyle = MEASURE_COLOR
    ctx.lineWidth = 2
    ctx.setLineDash([7, 5])
    ctx.beginPath()
    ctx.moveTo(sa.x, sa.y)
    ctx.lineTo(sb.x, sb.y)
    ctx.stroke()
    ctx.setLineDash([])
    for (const p of [sa, sb]) {
      ctx.beginPath()
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()

    const midScreen = { x: (sa.x + sb.x) / 2, y: (sa.y + sb.y) / 2 }
    this.drawCenteredScreenPill(ctx, formatDimension(distance(a, b), unit), midScreen, MEASURE_COLOR, '#ffffff')

    // Horizontal/vertical legs "where useful" — skip when the segment is already
    // purely horizontal or vertical (the main label already covers that case).
    const dxWorld = Math.abs(b.x - a.x)
    const dyWorld = Math.abs(b.y - a.y)
    const minLegScreen = 20
    if (dxWorld * this.viewport.zoom > minLegScreen && dyWorld * this.viewport.zoom > minLegScreen) {
      const corner = { x: sb.x, y: sa.y }
      ctx.save()
      ctx.strokeStyle = 'rgba(47, 111, 237, 0.45)'
      ctx.lineWidth = 1.5
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(sa.x, sa.y)
      ctx.lineTo(corner.x, corner.y)
      ctx.lineTo(sb.x, sb.y)
      ctx.stroke()
      ctx.restore()
      this.drawCenteredScreenPill(ctx, formatDimension(dxWorld, unit), { x: (sa.x + corner.x) / 2, y: corner.y }, 'rgba(47, 111, 237, 0.75)', '#ffffff')
      this.drawCenteredScreenPill(ctx, formatDimension(dyWorld, unit), { x: corner.x, y: (corner.y + sb.y) / 2 }, 'rgba(47, 111, 237, 0.75)', '#ffffff')
    }
  }

  /** Subtle full-span alignment guide lines while a move-drag is snapped to another object's edge/centre. */
  private drawAlignmentGuides(ctx: CanvasRenderingContext2D) {
    const { x, y } = this.alignmentGuides
    if (x === undefined && y === undefined) return
    ctx.save()
    ctx.strokeStyle = '#e0498a'
    ctx.lineWidth = 1
    ctx.setLineDash([5, 4])
    if (x !== undefined) {
      const sx = this.worldToScreen({ x, y: 0 }).x
      ctx.beginPath()
      ctx.moveTo(sx, 0)
      ctx.lineTo(sx, this.cssHeight)
      ctx.stroke()
    }
    if (y !== undefined) {
      const sy = this.worldToScreen({ x: 0, y }).y
      ctx.beginPath()
      ctx.moveTo(0, sy)
      ctx.lineTo(this.cssWidth, sy)
      ctx.stroke()
    }
    ctx.restore()
  }

  /** Live width/height/diameter/length readout while dragging to draw a rectangle/square/circle/line. */
  private drawDraftLabel(ctx: CanvasRenderingContext2D) {
    const draft = this.draft
    if (!draft) return
    const unit = this.doc.settings.unit
    let text: string | null = null

    if (draft.type === 'rectangle') {
      const w = Math.abs(draft.current.x - draft.start.x)
      const h = Math.abs(draft.current.y - draft.start.y)
      text = formatDimensionPair(w, h, unit)
    } else if (draft.type === 'square') {
      const size = Math.max(Math.abs(draft.current.x - draft.start.x), Math.abs(draft.current.y - draft.start.y))
      text = formatDimension(size, unit)
    } else if (draft.type === 'circle') {
      const size = Math.max(Math.abs(draft.current.x - draft.start.x), Math.abs(draft.current.y - draft.start.y))
      text = `Ø${formatDimensionValue(size, unit)} ${unitSuffix(unit)}`
    } else if (draft.type === 'line') {
      text = formatDimension(distance(draft.start, draft.current), unit)
    }
    if (!text) return
    this.drawLabelPill(ctx, text, draft.current)
  }

  /**
   * Automatic live dimensions (AURA CANVAS V3A) — a pure render overlay for
   * each selected rectangle/square/circle/line/arc, never persisted geometry
   * or user-editable text, so toggling "Show Dimensions" off never touches
   * the object's actual data.
   */
  private drawLiveDimensions(ctx: CanvasRenderingContext2D) {
    const unit = this.doc.settings.unit
    for (const id of this.selection) {
      const o = this.doc.objects.find((oo) => oo.id === id)
      if (!o || !o.visible) continue
      let text: string | null = null
      let anchorWorld: Point

      if (o.type === 'rectangle' || o.type === 'square') {
        text = o.type === 'square' ? formatDimension(o.width, unit) : formatDimensionPair(o.width, o.height, unit)
        anchorWorld = rotatePoint({ x: o.x + o.width, y: o.y + o.height }, objectCenter(o), o.rotation)
      } else if (o.type === 'circle') {
        text = `Ø${formatDimensionValue(o.width, unit)} ${unitSuffix(unit)}`
        anchorWorld = rotatePoint({ x: o.x + o.width, y: o.y + o.height }, objectCenter(o), o.rotation)
      } else if (o.type === 'line' && o.points && o.points.length >= 2) {
        const [p1, p2] = o.points
        text = formatDimension(distance(p1, p2), unit)
        anchorWorld = { x: o.x + Math.max(p1.x, p2.x), y: o.y + Math.max(p1.y, p2.y) }
      } else if (o.type === 'arc' && o.points && o.points.length >= 2) {
        const [p1, p2] = o.points
        const arc = arcFromBulge(p1, p2, o.arcBulge ?? 0.5)
        if (arc) {
          text = `R${formatDimensionValue(arc.radius, unit)} ${unitSuffix(unit)}`
          anchorWorld = { x: o.x + Math.max(p1.x, p2.x), y: o.y + Math.max(p1.y, p2.y) }
        } else {
          continue
        }
      } else {
        continue
      }
      if (!text) continue
      this.drawLabelPill(ctx, text, anchorWorld, { x: 10, y: 10 })
    }
  }

  private drawGrid(ctx: CanvasRenderingContext2D) {
    const { zoom, offsetX, offsetY } = this.viewport
    const size = this.doc.settings.gridSize
    if (size * zoom < 6) return
    const left = -offsetX / zoom
    const top = -offsetY / zoom
    const right = left + this.cssWidth / zoom
    const bottom = top + this.cssHeight / zoom
    const startX = Math.floor(left / size) * size
    const startY = Math.floor(top / size) * size
    ctx.lineWidth = 1 / zoom
    ctx.strokeStyle = GRID_LINE_COLOR
    ctx.beginPath()
    for (let x = startX; x <= right; x += size) {
      ctx.moveTo(x, top)
      ctx.lineTo(x, bottom)
    }
    for (let y = startY; y <= bottom; y += size) {
      ctx.moveTo(left, y)
      ctx.lineTo(right, y)
    }
    ctx.stroke()

    ctx.strokeStyle = GRID_AXIS_COLOR
    ctx.lineWidth = 1.5 / zoom
    ctx.beginPath()
    ctx.moveTo(0, top)
    ctx.lineTo(0, bottom)
    ctx.moveTo(left, 0)
    ctx.lineTo(right, 0)
    ctx.stroke()
  }

  private drawObjects(ctx: CanvasRenderingContext2D) {
    const layerLookup = new Map(this.doc.layers.map((l) => [l.id, l]))
    for (const o of this.doc.objects) {
      const layer = layerLookup.get(o.layerId)
      if (!o.visible || (layer && !layer.visible)) continue
      this.drawObject(ctx, o)
    }
  }

  private drawObject(ctx: CanvasRenderingContext2D, o: CanvasObject) {
    const center = objectCenter(o)
    ctx.save()
    ctx.globalAlpha = o.opacity
    ctx.translate(center.x, center.y)
    ctx.rotate(degToRadLocal(o.rotation))
    ctx.fillStyle = o.fill
    ctx.strokeStyle = o.stroke
    ctx.lineWidth = o.strokeWidth
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'

    const hw = o.width / 2
    const hh = o.height / 2
    const local = (p: Point) => ({ x: p.x - hw, y: p.y - hh })

    switch (o.type) {
      case 'rectangle':
      case 'square':
        ctx.beginPath()
        if (o.cornerRadius && o.cornerRadius > 0) {
          const r = Math.min(o.cornerRadius, hw, hh)
          ctx.roundRect(-hw, -hh, o.width, o.height, r)
        } else {
          ctx.rect(-hw, -hh, o.width, o.height)
        }
        this.paintClosedFill(ctx, o, hw, hh)
        if (o.strokeEnabled) ctx.stroke()
        break
      case 'circle':
        ctx.beginPath()
        ctx.ellipse(0, 0, Math.max(hw, 0.01), Math.max(hh, 0.01), 0, 0, Math.PI * 2)
        this.paintClosedFill(ctx, o, hw, hh)
        if (o.strokeEnabled) ctx.stroke()
        break
      case 'polygon': {
        if (!o.points || o.points.length < 2) break
        ctx.beginPath()
        const pts = o.points.map(local)
        ctx.moveTo(pts[0].x, pts[0].y)
        for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y)
        ctx.closePath()
        this.paintClosedFill(ctx, o, hw, hh)
        if (o.strokeEnabled) ctx.stroke()
        break
      }
      case 'freeDraw': {
        if (!o.points || o.points.length < 2) break
        ctx.beginPath()
        const pts = o.points.map(local)
        ctx.moveTo(pts[0].x, pts[0].y)
        for (let i = 1; i < pts.length - 1; i++) {
          const mid = { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 }
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, mid.x, mid.y)
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y)
        if (o.strokeEnabled) ctx.stroke()
        break
      }
      case 'line': {
        if (!o.points || o.points.length < 2) break
        const [p1, p2] = o.points.map(local)
        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        if (o.strokeEnabled) ctx.stroke()
        break
      }
      case 'arc': {
        if (!o.points || o.points.length < 2) break
        const [p1, p2] = o.points.map(local)
        const arc = arcFromBulge(p1, p2, o.arcBulge ?? 0.5)
        ctx.beginPath()
        if (arc) {
          ctx.arc(arc.center.x, arc.center.y, arc.radius, arc.startAngle, arc.endAngle, arc.ccw)
        } else {
          ctx.moveTo(p1.x, p1.y)
          ctx.lineTo(p2.x, p2.y)
        }
        if (o.strokeEnabled) ctx.stroke()
        break
      }
      case 'dimension': {
        if (!o.points || o.points.length < 2) break
        const [p1, p2] = o.points.map(local)
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x)
        const tickLen = 8
        const perp = { x: -Math.sin(angle) * tickLen, y: Math.cos(angle) * tickLen }
        ctx.beginPath()
        ctx.moveTo(p1.x - perp.x, p1.y - perp.y)
        ctx.lineTo(p1.x + perp.x, p1.y + perp.y)
        ctx.moveTo(p2.x - perp.x, p2.y - perp.y)
        ctx.lineTo(p2.x + perp.x, p2.y + perp.y)
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.stroke()
        const label = o.dimensionLabel ?? formatDimension(o.dimensionValue ?? distance(p1, p2), this.doc.settings.unit)
        const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
        ctx.save()
        ctx.translate(mid.x, mid.y)
        ctx.rotate(Math.abs(angle) > Math.PI / 2 ? angle + Math.PI : angle)
        ctx.fillStyle = o.stroke
        ctx.font = `600 13px Manrope, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.fillText(label, 0, -6)
        ctx.restore()
        break
      }
      case 'text': {
        ctx.fillStyle = o.fill
        ctx.font = `${o.fontSize ?? 32}px Manrope, sans-serif`
        ctx.textAlign = o.textAlign ?? 'left'
        ctx.textBaseline = 'top'
        const tx = o.textAlign === 'center' ? 0 : o.textAlign === 'right' ? hw : -hw
        ctx.fillText(o.text ?? '', tx, -hh)
        break
      }
      default:
        ctx.beginPath()
        ctx.rect(-hw, -hh, o.width, o.height)
        if (o.fillType === 'color') ctx.fill()
        if (o.strokeEnabled) ctx.stroke()
    }
    ctx.restore()
  }

  /**
   * Paints the fill for a closed shape whose path is already on `ctx`
   * (rect/ellipse/polygon, not yet stroked). Colour fills are unchanged from
   * V1; texture/image fills are painted live every frame from the material
   * catalogue / cached image — the object itself never gets rasterized, it
   * just gets a different paint each render.
   */
  private paintClosedFill(ctx: CanvasRenderingContext2D, o: CanvasObject, hw: number, hh: number) {
    if (o.fillType === 'color') {
      if (o.fill !== 'none') {
        ctx.fillStyle = o.fill
        ctx.fill()
      }
      return
    }

    if (o.fillType === 'texture' && o.materialId) {
      const material = getMaterialById(o.materialId)
      const pattern = material ? ctx.createPattern(getMaterialPatternCanvas(material), 'repeat') : null
      if (pattern) {
        const scale = o.textureScale ?? 1
        const rot = degToRadLocal(o.textureRotation ?? 0)
        const offset = o.textureOffset ?? { x: 0, y: 0 }
        const cos = Math.cos(rot)
        const sin = Math.sin(rot)
        pattern.setTransform(new DOMMatrix([cos * scale, sin * scale, -sin * scale, cos * scale, offset.x, offset.y]))
        ctx.save()
        ctx.fillStyle = pattern
        ctx.fill()
        ctx.restore()
        return
      }
      // Material removed from the catalogue since this was saved — fall back to its stored flat colour.
      if (o.fill !== 'none') {
        ctx.fillStyle = o.fill
        ctx.fill()
      }
      return
    }

    if (o.fillType === 'image' && o.imageData) {
      const img = getCachedImage(o.imageData)
      if (!img) {
        // Still decoding — paint a neutral placeholder and repaint once it's ready.
        ctx.fillStyle = o.fill !== 'none' ? o.fill : '#d8d3c8'
        ctx.fill()
        onImageReady(o.imageData, () => this.scheduleRender())
        return
      }
      ctx.save()
      ctx.clip()
      const scale = o.textureScale ?? 1
      const rot = degToRadLocal(o.textureRotation ?? 0)
      const offset = o.textureOffset ?? { x: 0, y: 0 }
      ctx.translate(offset.x, offset.y)
      ctx.rotate(rot)
      const fit = o.fillFit ?? 'cover'
      if (fit === 'tile') {
        const pattern = ctx.createPattern(img, 'repeat')
        if (pattern) {
          pattern.setTransform(new DOMMatrix().scale(scale))
          ctx.fillStyle = pattern
          ctx.fillRect(-hw * 2, -hh * 2, hw * 4, hh * 4)
        }
      } else {
        const ratio =
          fit === 'cover'
            ? Math.max((hw * 2) / img.naturalWidth, (hh * 2) / img.naturalHeight)
            : Math.min((hw * 2) / img.naturalWidth, (hh * 2) / img.naturalHeight)
        const drawW = img.naturalWidth * ratio * scale
        const drawH = img.naturalHeight * ratio * scale
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH)
      }
      ctx.restore()
      return
    }

    // fillType claims texture/image but the underlying data is missing — fall back to the stored colour.
    if (o.fill !== 'none') {
      ctx.fillStyle = o.fill
      ctx.fill()
    }
  }

  private drawDraft(ctx: CanvasRenderingContext2D) {
    const draft = this.draft
    if (!draft) return
    ctx.save()
    ctx.strokeStyle = this.activeStroke
    ctx.fillStyle = hexWithAlpha(this.activeFill, 0.25)
    ctx.lineWidth = Math.max(this.activeStrokeWidth, 1.5)
    ctx.setLineDash([6, 4])

    if (draft.type === 'rectangle') {
      const x = Math.min(draft.start.x, draft.current.x)
      const y = Math.min(draft.start.y, draft.current.y)
      const w = Math.abs(draft.current.x - draft.start.x)
      const h = Math.abs(draft.current.y - draft.start.y)
      ctx.strokeRect(x, y, w, h)
      ctx.fillRect(x, y, w, h)
    } else if (draft.type === 'square' || draft.type === 'circle') {
      const dx = draft.current.x - draft.start.x
      const dy = draft.current.y - draft.start.y
      const size = Math.max(Math.abs(dx), Math.abs(dy))
      const x = dx < 0 ? draft.start.x - size : draft.start.x
      const y = dy < 0 ? draft.start.y - size : draft.start.y
      if (draft.type === 'square') {
        ctx.strokeRect(x, y, size, size)
      } else {
        ctx.beginPath()
        ctx.ellipse(x + size / 2, y + size / 2, size / 2, size / 2, 0, 0, Math.PI * 2)
        ctx.stroke()
      }
    } else if (draft.type === 'line' || draft.type === 'arc' || draft.type === 'dimension') {
      ctx.beginPath()
      ctx.moveTo(draft.start.x, draft.start.y)
      ctx.lineTo(draft.current.x, draft.current.y)
      ctx.stroke()
    } else if (draft.type === 'polygon' || draft.type === 'freeDraw') {
      const pts = draft.points.map((p) => ({ x: draft.start.x + p.x, y: draft.start.y + p.y }))
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y)
      if (draft.type === 'polygon') ctx.lineTo(draft.current.x, draft.current.y)
      ctx.stroke()
      for (const p of pts) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, 4 / this.viewport.zoom, 0, Math.PI * 2)
        ctx.fillStyle = this.activeStroke
        ctx.fill()
      }
    }
    ctx.restore()
  }

  private drawSelectionOverlay(ctx: CanvasRenderingContext2D) {
    for (const id of this.selection) {
      const obj = this.doc.objects.find((o) => o.id === id)
      if (!obj) continue
      const corners = rotatedCorners(obj).map((c) => this.worldToScreen(c))
      ctx.save()
      ctx.strokeStyle = '#966f30'
      ctx.lineWidth = 1.5
      ctx.setLineDash(obj.locked ? [4, 4] : [])
      ctx.beginPath()
      ctx.moveTo(corners[0].x, corners[0].y)
      for (const c of corners.slice(1)) ctx.lineTo(c.x, c.y)
      ctx.closePath()
      ctx.stroke()
      ctx.restore()
    }

    if (this.selection.length === 1) {
      const obj = this.doc.objects.find((o) => o.id === this.selection[0])
      if (obj && !obj.locked) {
        const center = objectCenter(obj)
        const half = { x: obj.width / 2, y: obj.height / 2 }
        const handles: [ResizeHandle, Point][] = [
          ['nw', { x: -half.x, y: -half.y }],
          ['n', { x: 0, y: -half.y }],
          ['ne', { x: half.x, y: -half.y }],
          ['e', { x: half.x, y: 0 }],
          ['se', { x: half.x, y: half.y }],
          ['s', { x: 0, y: half.y }],
          ['sw', { x: -half.x, y: half.y }],
          ['w', { x: -half.x, y: 0 }],
        ]
        ctx.save()
        ctx.fillStyle = '#ffffff'
        ctx.strokeStyle = '#966f30'
        ctx.lineWidth = 1.5
        for (const [, local] of handles) {
          const world = rotatePoint({ x: center.x + local.x, y: center.y + local.y }, center, obj.rotation)
          const s = this.worldToScreen(world)
          ctx.beginPath()
          ctx.rect(s.x - HANDLE_SCREEN_SIZE / 2, s.y - HANDLE_SCREEN_SIZE / 2, HANDLE_SCREEN_SIZE, HANDLE_SCREEN_SIZE)
          ctx.fill()
          ctx.stroke()
        }
        const rotateLocal = { x: 0, y: -half.y - ROTATE_HANDLE_OFFSET / this.viewport.zoom }
        const rotateWorld = rotatePoint({ x: center.x + rotateLocal.x, y: center.y + rotateLocal.y }, center, obj.rotation)
        const topWorld = rotatePoint({ x: center.x, y: center.y - half.y }, center, obj.rotation)
        const rs = this.worldToScreen(rotateWorld)
        const ts = this.worldToScreen(topWorld)
        ctx.beginPath()
        ctx.moveTo(ts.x, ts.y)
        ctx.lineTo(rs.x, rs.y)
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(rs.x, rs.y, HANDLE_SCREEN_SIZE / 2, 0, Math.PI * 2)
        ctx.fillStyle = '#966f30'
        ctx.fill()
        ctx.restore()
      }
    }
  }

  private drawMarquee(ctx: CanvasRenderingContext2D) {
    if (!this.marqueeRect) return
    const topLeft = this.worldToScreen({ x: this.marqueeRect.x, y: this.marqueeRect.y })
    const bottomRight = this.worldToScreen({
      x: this.marqueeRect.x + this.marqueeRect.width,
      y: this.marqueeRect.y + this.marqueeRect.height,
    })
    ctx.save()
    ctx.fillStyle = 'rgba(150, 111, 48, 0.12)'
    ctx.strokeStyle = '#966f30'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 3])
    ctx.fillRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y)
    ctx.strokeRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y)
    ctx.restore()
  }

  private drawLasso(ctx: CanvasRenderingContext2D) {
    if (this.lassoPoints.length < 2) return
    const screenPts = this.lassoPoints.map((p) => this.worldToScreen(p))
    ctx.save()
    ctx.fillStyle = 'rgba(150, 111, 48, 0.12)'
    ctx.strokeStyle = '#966f30'
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 3])
    ctx.beginPath()
    ctx.moveTo(screenPts[0].x, screenPts[0].y)
    for (const p of screenPts.slice(1)) ctx.lineTo(p.x, p.y)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }
}

function degToRadLocal(deg: number): number {
  return (deg * Math.PI) / 180
}

function radToDegLocal(rad: number): number {
  return (rad * 180) / Math.PI
}

function hexWithAlpha(hex: string, alpha: number): string {
  if (!/^#([0-9a-f]{6})$/i.test(hex)) return hex
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function formatDimension(mm: number, unit: CanvasUnit): string {
  if (unit === 'mm') return `${Math.round(mm)} mm`
  if (unit === 'cm') return `${(mm / 10).toFixed(1)} cm`
  return `${(mm / 1000).toFixed(2)} m`
}

/** Same numeric formatting as formatDimension, without the trailing unit — for compact combined labels like "2400 × 750 mm". */
function formatDimensionValue(mm: number, unit: CanvasUnit): string {
  if (unit === 'mm') return `${Math.round(mm)}`
  if (unit === 'cm') return `${(mm / 10).toFixed(1)}`
  return `${(mm / 1000).toFixed(2)}`
}

function unitSuffix(unit: CanvasUnit): string {
  return unit
}

/** "2400 × 750 mm" — width/height sharing one unit suffix. */
function formatDimensionPair(wMm: number, hMm: number, unit: CanvasUnit): string {
  return `${formatDimensionValue(wMm, unit)} × ${formatDimensionValue(hMm, unit)} ${unitSuffix(unit)}`
}

/** Resizes `init` toward `worldPt` via the given handle, accounting for rotation. */
function resizeObject(init: CanvasObject, handle: ResizeHandle, worldPt: Point): CanvasObject {
  const center = objectCenter(init)
  const local = rotatePoint(worldPt, center, -init.rotation)
  let left = init.x
  let right = init.x + init.width
  let top = init.y
  let bottom = init.y + init.height

  const affectsLeft = handle === 'nw' || handle === 'w' || handle === 'sw'
  const affectsRight = handle === 'ne' || handle === 'e' || handle === 'se'
  const affectsTop = handle === 'nw' || handle === 'n' || handle === 'ne'
  const affectsBottom = handle === 'sw' || handle === 's' || handle === 'se'

  if (affectsLeft) left = Math.min(local.x, right - MIN_SIZE)
  if (affectsRight) right = Math.max(local.x, left + MIN_SIZE)
  if (affectsTop) top = Math.min(local.y, bottom - MIN_SIZE)
  if (affectsBottom) bottom = Math.max(local.y, top + MIN_SIZE)

  const newWidth = right - left
  const newHeight = bottom - top
  const localCenter = { x: (left + right) / 2, y: (top + bottom) / 2 }
  const worldCenter = rotatePoint(localCenter, center, init.rotation)

  const next: CanvasObject = {
    ...init,
    x: worldCenter.x - newWidth / 2,
    y: worldCenter.y - newHeight / 2,
    width: newWidth,
    height: newHeight,
  }

  if (init.points && init.width > 0 && init.height > 0) {
    next.points = init.points.map((p) => ({
      x: (p.x / init.width) * newWidth,
      y: (p.y / init.height) * newHeight,
    }))
  }

  return next
}
