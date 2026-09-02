import { generateId } from '@/lib/id'
import {
  arcFromBulge,
  boundsOfPoints,
  distance,
  distanceToPolyline,
  distanceToSegment,
  flattenCubicBezier,
  objectCenter,
  objectSnapPoints,
  offsetPolygon,
  orthoConstrain,
  pointInCircle,
  pointInMultiPolygon,
  pointInPolygon,
  pointInRotatedRect,
  rayIntersectsSegment,
  rotatePoint,
  rotatedCorners,
  segmentIntersection,
  snapPoint,
} from '@/lib/canvasMath'
import { computeBoolean, type BooleanOp } from '@/lib/booleanOps'
import { formatLength, formatLengthPair, formatLengthValue, unitSuffix } from '@/lib/units'
import type {
  CanvasDocument,
  CanvasLayer,
  CanvasObject,
  CanvasObjectType,
  CanvasSettings,
  CanvasToolId,
  CanvasUnit,
  CopiedStyle,
  FillFit,
  PathVertex,
  Point,
  PreciseCreateSpec,
} from '@/types/canvas'
import { CLOSED_SHAPE_TYPES, BOOLEAN_COMPATIBLE_TYPES } from '@/types/canvas'
import type { Material } from '@/types/materials'
import { getMaterialById } from '@/data/materials'
import { getMaterialPatternCanvas } from '@/lib/materialPatterns'
import { getCachedImage, onImageReady } from '@/lib/imageUtils'

// Re-exported so existing call sites (`import { formatDimension } from '@/lib/canvasEngine'`)
// keep working unchanged — the actual conversion/formatting logic now lives
// in the centralized `lib/units.ts`, per V3C's "don't scatter conversion
// calculations throughout components" requirement.
export { formatLength as formatDimension, formatLengthValue as formatDimensionValue, formatLengthPair as formatDimensionPair, unitSuffix } from '@/lib/units'
export { mmToEditableNumber, parseLength, LengthParseError, defaultStepMm } from '@/lib/units'
export type { CanvasUnit } from '@/lib/units'

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
  /** 'semicircle' isn't a stored CanvasObjectType (it commits as an 'arc' with a fixed bulge+closed) — it only exists as a draft-in-progress marker. */
  type: CanvasObjectType | 'semicircle'
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
  hasCopiedStyle: boolean
  /** V3C Pen tool — id of the 'path' object currently in vertex-edit mode (double-clicked with Select), or null. */
  editingPathId: string | null
  /** V3C Pen tool — index into that path's `pathVertices` the designer last clicked, for Corner/Smooth/Delete actions. */
  selectedVertexIndex: number | null
  /** V3C Pen tool — vertex count of the in-progress draft while actively drawing a new path (0 when not drawing one). */
  penDraftVertexCount: number
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

/** V3C — greedy word-wrap for a fixed text-box width. Falls back to breaking an unbreakably-long single word rather than overflowing. */
function wrapText(ctx: CanvasRenderingContext2D | null, text: string, fontSize: number, maxWidth: number, bold: boolean): string[] {
  const words = (text || '').split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']
  if (!ctx) return [text]
  ctx.save()
  ctx.font = `${bold ? '700' : '400'} ${fontSize}px Manrope, sans-serif`
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (ctx.measureText(candidate).width <= maxWidth || !line) {
      line = candidate
    } else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  ctx.restore()
  return lines
}

/** Text bbox size accounting for word-wrap when `textBoxWidth` is set — width is fixed to it, height grows with the wrapped line count. Without it, behaves exactly like plain `measureTextSize` (single line, auto-width). */
function measureTextBoxSize(ctx: CanvasRenderingContext2D | null, text: string, fontSize: number, textBoxWidth: number | undefined, bold: boolean) {
  if (!textBoxWidth) return measureTextSize(ctx, text, fontSize)
  const lines = wrapText(ctx, text, fontSize, textBoxWidth, bold)
  return { width: textBoxWidth, height: Math.max(lines.length, 1) * fontSize * 1.3 }
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

  /** V3C Pen tool — vertices of the path currently being drawn (world space, becomes local-to-bbox on commit), or null when not drawing one. */
  private penDraft: PathVertex[] | null = null
  /** V3C Pen tool — id of the 'path' object currently in vertex-edit mode (entered via double-click with Select active), or null. */
  private editingPathId: string | null = null
  /** V3C Pen tool — index into the editing path's vertices last clicked, target for Corner/Smooth/Delete. */
  private selectedVertexIndex: number | null = null
  /** V3C Pen tool edit-mode drag — which handle of which vertex is being dragged. */
  private penDrag: { vertexIndex: number; part: 'anchor' | 'handleIn' | 'handleOut' } | null = null
  private penDragBefore: CanvasObject[] | null = null
  /** V3C Pen tool creation — screen point of the vertex currently being placed, used to tell a tap from a click-drag. */
  private penDownScreen: Point | null = null
  private penActiveVertexIndex: number | null = null
  /** V3C Pen tool creation — live cursor position for the rubber-band preview segment while a path is being drawn. */
  private penHoverPoint: Point | null = null
  /** V3C text leader/callout — id of the text object waiting for its next canvas click to become the leader's target point, or null. */
  private pendingLeaderTextId: string | null = null

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
  /** V3C Copy Style / Paste Style — visual properties only, kept separate from the geometry clipboard above. */
  private styleClipboard: CopiedStyle | null = null
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
      hasCopiedStyle: this.styleClipboard !== null,
      editingPathId: this.editingPathId,
      selectedVertexIndex: this.selectedVertexIndex,
      penDraftVertexCount: this.penDraft?.length ?? 0,
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
    // Leaving Pen mid-path finishes what's already drawn as an open path
    // rather than silently discarding it — losing several already-placed
    // anchors to an accidental tool switch would be a much worse experience
    // than just ending up with an open (rather than closed) path.
    if (tool !== 'pen' && this.penDraft) this.finishPen(false)
    if (tool !== 'select' && tool !== 'pen') this.exitPathEdit()
    this.tool = tool
    // Eyedropper is exempt: its whole point (per pickColorAt) is sampling a
    // colour/style and applying it immediately to whatever is already
    // selected — clearing the selection the instant the tool is armed would
    // make that primary workflow impossible to reach from the toolbar.
    if (tool !== 'select' && tool !== 'eyedropper') this.selection = []
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
        if ((patch.text !== undefined || patch.fontSize !== undefined || patch.textBoxWidth !== undefined || patch.fontWeight !== undefined) && next.type === 'text') {
          const size = measureTextBoxSize(this.ctx, next.text ?? '', next.fontSize ?? 32, next.textBoxWidth, next.fontWeight === 'bold')
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

  /**
   * V3C — a pure display setting, exactly like `unit` always was: it only
   * changes how `formatLength`/`parseLength` read and print `doc.objects`'
   * mm fields, never the fields themselves. Consistent with every other
   * settings toggle in this file (grid/snap/ortho/showDimensions), this
   * isn't part of the object-undo history — there is nothing here that
   * undo needs to reverse, since no geometry ever changes.
   */
  setUnit(unit: CanvasUnit) {
    this.doc = { ...this.doc, settings: { ...this.doc.settings, unit } }
    this.notify()
    this.scheduleRender()
  }

  cycleUnit() {
    const order: CanvasUnit[] = ['mm', 'cm', 'm', 'in', 'ft', 'ftin']
    const next = order[(order.indexOf(this.doc.settings.unit) + 1) % order.length]
    this.setUnit(next)
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

  /**
   * V3C Flip Horizontal/Vertical (supersedes the old single-object-only
   * "Mirror"). Every selected object gets its own shape mirrored exactly as
   * before, but its POSITION now also reflects across the whole selection's
   * combined bounds — for a single object those bounds ARE the object's own
   * bounds, so the position term is a no-op and it still flips in place
   * (unchanged V1 behaviour); for a multi-selection or a group, two
   * side-by-side objects actually swap sides, which is what "flip a group"
   * has to mean to be useful rather than just mirroring each member
   * privately in place.
   */
  flipSelected(axis: 'horizontal' | 'vertical') {
    const targets = this.doc.objects.filter((o) => this.selection.includes(o.id) && !o.locked)
    if (targets.length === 0) return
    const before = this.snapshot()
    const overall = CanvasEngine.boundsOfObjects(targets)
    const targetIds = new Set(targets.map((t) => t.id))
    this.doc = {
      ...this.doc,
      objects: this.doc.objects.map((o) => {
        if (!targetIds.has(o.id)) return o
        const next: CanvasObject = { ...o }
        if (o.points) {
          next.points = o.points.map((p) => (axis === 'horizontal' ? { x: o.width - p.x, y: p.y } : { x: p.x, y: o.height - p.y }))
        } else {
          next.rotation = axis === 'horizontal' ? (360 - o.rotation) % 360 : (180 - o.rotation + 360) % 360
        }
        if (axis === 'horizontal') next.x = 2 * overall.x + overall.width - o.x - o.width
        else next.y = 2 * overall.y + overall.height - o.y - o.height
        return next
      }),
    }
    this.commit(before)
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

  /** Section 8 — uniform radius for every selected rectangle/square, clearing any per-corner override. */
  setUniformCornerRadius(radiusMm: number) {
    this.applyToSelection((o) => (o.type === 'rectangle' || o.type === 'square' ? { ...o, cornerRadius: Math.max(0, radiusMm), cornerRadii: undefined } : o))
    this.notify()
    this.scheduleRender()
  }

  /** Section 8 — one corner at a time, merged into whatever the object already has (falling back to the legacy uniform value for corners not yet customised). */
  setCornerRadius(corner: 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft', radiusMm: number) {
    this.applyToSelection((o) => {
      if (o.type !== 'rectangle' && o.type !== 'square') return o
      const base = o.cornerRadius ?? 0
      const cornerRadii = { topLeft: base, topRight: base, bottomRight: base, bottomLeft: base, ...o.cornerRadii, [corner]: Math.max(0, radiusMm) }
      return { ...o, cornerRadii }
    })
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

  /**
   * Section 10 — Eyedropper. Colour capture is unchanged from V1; V3C adds
   * stroke and opacity to what it samples. When something is already
   * selected, the sampled style applies to it immediately (matching how
   * picking a plain colour already behaves via setActiveFill) — "sample an
   * object's properties and apply them to another object" in one click.
   * With nothing selected, it just becomes the active style for the next
   * shape you draw, same as always.
   */
  private pickColorAt(worldPt: Point) {
    const target = this.hitTest(worldPt)
    if (!target) return
    this.activeFill = target.fill
    this.pushRecentColor(target.fill)
    this.activeMaterial = target.fillType === 'texture' && target.materialId ? (getMaterialById(target.materialId) ?? null) : null
    this.activeStroke = target.stroke
    this.activeStrokeWidth = target.strokeWidth
    this.activeOpacity = target.opacity
    this.tool = 'select'
    if (this.selection.length > 0) {
      this.applyToSelection((o) => ({
        ...o,
        fillType: target.fillType,
        fill: target.fill,
        materialId: target.materialId,
        imageData: target.imageData,
        fillFit: target.fillFit,
        stroke: target.stroke,
        strokeEnabled: target.strokeEnabled,
        strokeWidth: target.strokeWidth,
        opacity: target.opacity,
      }))
    }
    this.notify()
    this.scheduleRender()
  }

  /** Section 11 — Copy Style: snapshots the primary selected object's visual properties only, never geometry. */
  copyStyle() {
    const o = this.doc.objects.find((oo) => oo.id === this.selection[0])
    if (!o) return
    this.styleClipboard = {
      fillType: o.fillType,
      fill: o.fill,
      opacity: o.opacity,
      strokeEnabled: o.strokeEnabled,
      stroke: o.stroke,
      strokeWidth: o.strokeWidth,
      materialId: o.materialId,
      imageData: o.imageData,
      fillFit: o.fillFit,
      textureScale: o.textureScale,
      textureOffset: o.textureOffset,
      textureRotation: o.textureRotation,
      cornerRadius: o.cornerRadius,
      cornerRadii: o.cornerRadii,
    }
    this.notify()
  }

  /** Section 11 — Paste Style: applies the copied visual properties to every selected object, leaving each one's own geometry untouched. */
  pasteStyle() {
    if (!this.styleClipboard || this.selection.length === 0) return
    const style = this.styleClipboard
    this.applyToSelection((o) => {
      const next: CanvasObject = { ...o, ...style }
      // Corner radius only means something on a rectangle/square — never let pasting a
      // rounded rectangle's style onto a circle or line silently graft an unused field on.
      if (o.type !== 'rectangle' && o.type !== 'square') {
        next.cornerRadius = o.cornerRadius
        next.cornerRadii = o.cornerRadii
      }
      return next
    })
    this.notify()
    this.scheduleRender()
  }

  /** V3C — arms "the next canvas click sets this text's leader/callout target point." */
  startAddLeader(textId: string) {
    this.pendingLeaderTextId = textId
  }

  removeLeader(textId: string) {
    const before = this.snapshot()
    this.doc = { ...this.doc, objects: this.doc.objects.map((o) => (o.id === textId ? { ...o, calloutTarget: undefined } : o)) }
    this.commit(before)
    this.notify()
    this.scheduleRender()
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
        const size = measureTextBoxSize(this.ctx, text, o.fontSize ?? 32, o.textBoxWidth, o.fontWeight === 'bold')
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
    this.penActiveVertexIndex = null
    this.penDrag = null
    this.penDragBefore = null
    this.scheduleRender()
  }

  // ---------------------------------------------------------- V3C Pen tool
  private penPathObject(): CanvasObject | undefined {
    return this.editingPathId ? this.doc.objects.find((o) => o.id === this.editingPathId) : undefined
  }

  private pointerDownPen(screenPt: Point, worldRaw: Point) {
    if (!this.penDraft) this.penDraft = []
    if (this.penDraft.length >= 2) {
      const firstScreen = this.worldToScreen(this.penDraft[0])
      if (distance(firstScreen, screenPt) < 20) {
        this.finishPen(true)
        return
      }
    }
    const world = this.maybeSnap(worldRaw)
    this.penDraft.push({ x: world.x, y: world.y })
    this.penActiveVertexIndex = this.penDraft.length - 1
    this.penDownScreen = screenPt
    this.notify()
    this.scheduleRender()
  }

  /** Commits the in-progress Pen draft as a new 'path' object. `closed` false discards a draft with fewer than 2 vertices. */
  finishPen(closed: boolean) {
    const draft = this.penDraft
    this.penDraft = null
    this.penActiveVertexIndex = null
    this.penHoverPoint = null
    if (!draft || draft.length < 2) {
      this.notify()
      this.scheduleRender()
      return
    }
    const before = this.snapshot()
    const allPts: Point[] = []
    for (const v of draft) {
      allPts.push({ x: v.x, y: v.y })
      if (v.handleIn) allPts.push(v.handleIn)
      if (v.handleOut) allPts.push(v.handleOut)
    }
    const bounds = boundsOfPoints(allPts)
    const obj = this.baseObject('path', bounds.x, bounds.y, Math.max(bounds.width, 1), Math.max(bounds.height, 1))
    obj.pathVertices = draft.map((v) => ({
      x: v.x - bounds.x,
      y: v.y - bounds.y,
      handleIn: v.handleIn ? { x: v.handleIn.x - bounds.x, y: v.handleIn.y - bounds.y } : undefined,
      handleOut: v.handleOut ? { x: v.handleOut.x - bounds.x, y: v.handleOut.y - bounds.y } : undefined,
      smooth: v.smooth,
    }))
    obj.pathClosed = closed
    obj.fillType = 'color'
    this.doc = { ...this.doc, objects: [...this.doc.objects, obj] }
    this.selection = [obj.id]
    this.commit(before)
    this.tool = 'select'
    this.notify()
    this.scheduleRender()
  }

  /** Discards the in-progress Pen draft without creating anything. */
  cancelPen() {
    this.penDraft = null
    this.penActiveVertexIndex = null
    this.penHoverPoint = null
    this.scheduleRender()
  }

  /** Enters vertex-edit mode for a 'path' object (double-click with Select, mirroring the existing double-click-to-edit-text pattern). */
  enterPathEdit(id: string) {
    const obj = this.doc.objects.find((o) => o.id === id)
    if (!obj || obj.type !== 'path' || !obj.pathVertices || obj.locked) return
    this.editingPathId = id
    this.selectedVertexIndex = null
    this.selection = [id]
    this.notify()
    this.scheduleRender()
  }

  exitPathEdit() {
    if (!this.editingPathId) return
    this.editingPathId = null
    this.selectedVertexIndex = null
    this.notify()
    this.scheduleRender()
  }

  /** Hit-tests the editing path's anchor/handle dots in screen space. */
  private hitTestPathHandle(o: CanvasObject, screenPt: Point): { vertexIndex: number; part: 'anchor' | 'handleIn' | 'handleOut' } | null {
    if (!o.pathVertices) return null
    const hitRadius = HANDLE_SCREEN_SIZE / 2 + HANDLE_HIT_PADDING
    for (let i = 0; i < o.pathVertices.length; i++) {
      const v = o.pathVertices[i]
      const anchorWorld = { x: o.x + v.x, y: o.y + v.y }
      if (distance(this.worldToScreen(anchorWorld), screenPt) <= hitRadius) return { vertexIndex: i, part: 'anchor' }
      if (v.handleOut) {
        const hWorld = { x: o.x + v.handleOut.x, y: o.y + v.handleOut.y }
        if (distance(this.worldToScreen(hWorld), screenPt) <= hitRadius) return { vertexIndex: i, part: 'handleOut' }
      }
      if (v.handleIn) {
        const hWorld = { x: o.x + v.handleIn.x, y: o.y + v.handleIn.y }
        if (distance(this.worldToScreen(hWorld), screenPt) <= hitRadius) return { vertexIndex: i, part: 'handleIn' }
      }
    }
    return null
  }

  /** Returns true if the click was consumed by path-edit interaction (handle grabbed, or a new anchor inserted). */
  private pointerDownPathEdit(screenPt: Point, worldRaw: Point): boolean {
    const obj = this.penPathObject()
    if (!obj || !obj.pathVertices) {
      this.exitPathEdit()
      return false
    }
    const hit = this.hitTestPathHandle(obj, screenPt)
    if (hit) {
      this.selectedVertexIndex = hit.vertexIndex
      this.penDrag = hit
      this.penDragBefore = this.snapshot()
      this.notify()
      return true
    }
    if (this.tool === 'pen') {
      const inserted = this.insertVertexOnPath(obj, worldRaw)
      if (inserted) return true
    }
    return false
  }

  private pointerMovePenDrag(screenPt: Point) {
    const drag = this.penDrag
    const obj = this.penPathObject()
    if (!drag || !obj || !obj.pathVertices) return
    const worldRaw = this.screenToWorld(screenPt)
    const local = { x: worldRaw.x - obj.x, y: worldRaw.y - obj.y }
    this.doc = {
      ...this.doc,
      objects: this.doc.objects.map((o) => {
        if (o.id !== obj.id || !o.pathVertices) return o
        const vertices = o.pathVertices.map((v, i) => {
          if (i !== drag.vertexIndex) return v
          const next: PathVertex = { ...v }
          if (drag.part === 'anchor') {
            const dx = local.x - v.x
            const dy = local.y - v.y
            next.x = local.x
            next.y = local.y
            if (v.handleIn) next.handleIn = { x: v.handleIn.x + dx, y: v.handleIn.y + dy }
            if (v.handleOut) next.handleOut = { x: v.handleOut.x + dx, y: v.handleOut.y + dy }
          } else if (drag.part === 'handleOut') {
            next.handleOut = local
            if (v.smooth) next.handleIn = { x: 2 * v.x - local.x, y: 2 * v.y - local.y }
          } else {
            next.handleIn = local
            if (v.smooth) next.handleOut = { x: 2 * v.x - local.x, y: 2 * v.y - local.y }
          }
          return next
        })
        return { ...o, pathVertices: vertices }
      }),
    }
    this.scheduleRender()
  }

  /** Splits the nearest flattened segment of `obj`'s path at the point closest to `worldPt`, inserting a plain corner vertex there. Returns false if the click wasn't actually close enough to the path to mean "insert here". */
  private insertVertexOnPath(obj: CanvasObject, worldPt: Point): boolean {
    if (!obj.pathVertices || obj.pathVertices.length < 2) return false
    const padding = 8 / this.viewport.zoom
    const segmentCount = obj.pathClosed ? obj.pathVertices.length : obj.pathVertices.length - 1
    let best: { segIndex: number; point: Point; dist: number } | null = null
    for (let i = 0; i < segmentCount; i++) {
      const a = obj.pathVertices[i]
      const b = obj.pathVertices[(i + 1) % obj.pathVertices.length]
      const flat = flattenCubicBezier({ x: obj.x + a.x, y: obj.y + a.y }, { x: obj.x + (a.handleOut?.x ?? a.x), y: obj.y + (a.handleOut?.y ?? a.y) }, { x: obj.x + (b.handleIn?.x ?? b.x), y: obj.y + (b.handleIn?.y ?? b.y) }, { x: obj.x + b.x, y: obj.y + b.y }, 12)
      for (let s = 0; s < flat.length - 1; s++) {
        const d = distanceToSegment(worldPt, flat[s], flat[s + 1])
        if (!best || d < best.dist) best = { segIndex: i, point: worldPt, dist: d }
      }
    }
    if (!best || best.dist > padding + (obj.strokeWidth ?? 1)) return false
    const before = this.snapshot()
    const newVertex: PathVertex = { x: worldPt.x - obj.x, y: worldPt.y - obj.y }
    this.doc = {
      ...this.doc,
      objects: this.doc.objects.map((o) => {
        if (o.id !== obj.id || !o.pathVertices) return o
        const vertices = [...o.pathVertices]
        vertices.splice(best!.segIndex + 1, 0, newVertex)
        return { ...o, pathVertices: vertices }
      }),
    }
    this.selectedVertexIndex = best.segIndex + 1
    this.commit(before)
    this.notify()
    this.scheduleRender()
    return true
  }

  /** Deletes the currently-selected vertex of the path being edited (needs at least 3 remaining, or 2 for an open path). */
  deleteSelectedVertex() {
    const obj = this.penPathObject()
    if (!obj || !obj.pathVertices || this.selectedVertexIndex === null) return
    const minCount = obj.pathClosed ? 3 : 2
    if (obj.pathVertices.length <= minCount) return
    const before = this.snapshot()
    const index = this.selectedVertexIndex
    this.doc = {
      ...this.doc,
      objects: this.doc.objects.map((o) => (o.id === obj.id && o.pathVertices ? { ...o, pathVertices: o.pathVertices.filter((_, i) => i !== index) } : o)),
    }
    this.selectedVertexIndex = null
    this.commit(before)
    this.notify()
    this.scheduleRender()
  }

  /** Corner <-> Smooth for the selected vertex. Converting to Smooth grows symmetric handles along the vertex's local tangent when it has none yet; converting to Corner just drops both handles. */
  setSelectedVertexSmooth(smooth: boolean) {
    const obj = this.penPathObject()
    if (!obj || !obj.pathVertices || this.selectedVertexIndex === null) return
    const before = this.snapshot()
    const index = this.selectedVertexIndex
    this.doc = {
      ...this.doc,
      objects: this.doc.objects.map((o) => {
        if (o.id !== obj.id || !o.pathVertices) return o
        const vertices = o.pathVertices.map((v, i) => {
          if (i !== index) return v
          if (!smooth) return { ...v, smooth: false, handleIn: undefined, handleOut: undefined }
          const prev = o.pathVertices![(i - 1 + o.pathVertices!.length) % o.pathVertices!.length]
          const next = o.pathVertices![(i + 1) % o.pathVertices!.length]
          const dx = (next.x - prev.x) / 4
          const dy = (next.y - prev.y) / 4
          return { ...v, smooth: true, handleIn: v.handleIn ?? { x: v.x - dx, y: v.y - dy }, handleOut: v.handleOut ?? { x: v.x + dx, y: v.y + dy } }
        })
        return { ...o, pathVertices: vertices }
      }),
    }
    this.commit(before)
    this.notify()
    this.scheduleRender()
  }

  // -------------------------------------------------------------- V3C Offset
  /**
   * Section 13 — creates a new parallel copy of every selected compatible
   * shape (line, rectangle/square, circle, polygon, or a straight-edged
   * Boolean-result path), offset by `distanceMm` (negative = inward/
   * shrink). The sources are left untouched; the new offset copies become
   * the selection. Practical for wall thickness, panel/groove/border
   * spacing — not a general CAD offset engine (see `offsetPolygon`'s docs
   * for the polygon case's known limits).
   */
  offsetSelected(distanceMm: number) {
    const targets = this.doc.objects.filter((o) => this.selection.includes(o.id) && !o.locked)
    if (targets.length === 0 || distanceMm === 0) return
    const before = this.snapshot()
    const copies: CanvasObject[] = []
    for (const o of targets) {
      if (o.type === 'line' && o.points && o.points.length >= 2) {
        const [p1, p2] = o.points
        const dx = p2.x - p1.x
        const dy = p2.y - p1.y
        const len = Math.hypot(dx, dy) || 1
        const nx = (-dy / len) * distanceMm
        const ny = (dx / len) * distanceMm
        copies.push({ ...o, id: generateId('obj'), points: [{ x: p1.x + nx, y: p1.y + ny }, { x: p2.x + nx, y: p2.y + ny }] })
      } else if (o.type === 'rectangle' || o.type === 'square' || o.type === 'circle') {
        const newWidth = Math.max(o.width + 2 * distanceMm, MIN_SIZE)
        const newHeight = Math.max(o.height + 2 * distanceMm, MIN_SIZE)
        copies.push({ ...o, id: generateId('obj'), x: o.x - distanceMm, y: o.y - distanceMm, width: newWidth, height: newHeight })
      } else if (o.type === 'polygon' && o.points && o.points.length >= 3) {
        const offsetPts = offsetPolygon(o.points, distanceMm)
        if (offsetPts) copies.push({ ...o, id: generateId('obj'), points: offsetPts })
      } else if (o.type === 'path' && o.pathSubpaths) {
        const offsetSubs = o.pathSubpaths.map((loop) => offsetPolygon(loop, distanceMm)).filter((l): l is Point[] => l !== null)
        if (offsetSubs.length > 0) copies.push({ ...o, id: generateId('obj'), pathSubpaths: offsetSubs })
      }
    }
    if (copies.length === 0) return
    this.doc = { ...this.doc, objects: [...this.doc.objects, ...copies] }
    this.selection = copies.map((c) => c.id)
    this.commit(before)
    this.notify()
    this.scheduleRender()
  }

  // -------------------------------------------------------- V3C Trim/Extend
  /**
   * Sections 14/15 — Trim and Extend are scoped to straight, UNROTATED
   * 'line' objects (matching the spec's own "two intersecting lines"
   * example) rather than every geometry type; trimming/extending against
   * curved or rotated edges is a materially harder problem and explicitly
   * out of scope for a "keep it lightweight, predictable" tool. Both are
   * driven by a single click with the Trim/Extend tool active.
   */
  private pointerDownTrim(worldPt: Point) {
    const target = this.hitTest(worldPt)
    if (!target || target.type !== 'line' || target.rotation !== 0 || !target.points || target.points.length < 2 || target.locked) return
    const p1 = { x: target.x + target.points[0].x, y: target.y + target.points[0].y }
    const p2 = { x: target.x + target.points[1].x, y: target.y + target.points[1].y }

    let best: Point | null = null
    let bestDist = Infinity
    for (const other of this.doc.objects) {
      if (other.id === target.id || other.type !== 'line' || !other.visible || !other.points || other.points.length < 2) continue
      const op1 = { x: other.x + other.points[0].x, y: other.y + other.points[0].y }
      const op2 = { x: other.x + other.points[1].x, y: other.y + other.points[1].y }
      const hit = segmentIntersection(p1, p2, op1, op2)
      if (!hit) continue
      const d = distance(worldPt, hit)
      if (d < bestDist) {
        bestDist = d
        best = hit
      }
    }
    if (!best) return

    const trimToward1 = distance(worldPt, p1) < distance(worldPt, p2)
    const newP1 = trimToward1 ? best : p1
    const newP2 = trimToward1 ? p2 : best
    if (distance(newP1, newP2) < 1) return
    const before = this.snapshot()
    const bounds = boundsOfPoints([newP1, newP2])
    this.doc = {
      ...this.doc,
      objects: this.doc.objects.map((o) =>
        o.id === target.id
          ? { ...o, x: bounds.x, y: bounds.y, width: Math.max(bounds.width, 1), height: Math.max(bounds.height, 1), points: [{ x: newP1.x - bounds.x, y: newP1.y - bounds.y }, { x: newP2.x - bounds.x, y: newP2.y - bounds.y }] }
          : o,
      ),
    }
    this.commit(before)
    this.notify()
    this.scheduleRender()
  }

  private pointerDownExtend(worldPt: Point) {
    const target = this.hitTest(worldPt)
    if (!target || target.type !== 'line' || target.rotation !== 0 || !target.points || target.points.length < 2 || target.locked) return
    const p1 = { x: target.x + target.points[0].x, y: target.y + target.points[0].y }
    const p2 = { x: target.x + target.points[1].x, y: target.y + target.points[1].y }
    const extendFrom1 = distance(worldPt, p1) < distance(worldPt, p2)
    const origin = extendFrom1 ? p2 : p1 // the end that stays put — the ray fires FROM here THROUGH the end being extended
    const movingEnd = extendFrom1 ? p1 : p2
    const dir = { x: movingEnd.x - origin.x, y: movingEnd.y - origin.y }
    const len = Math.hypot(dir.x, dir.y) || 1
    const dirUnit = { x: dir.x / len, y: dir.y / len }

    let best: Point | null = null
    let bestT = Infinity
    for (const other of this.doc.objects) {
      if (other.id === target.id || other.type !== 'line' || !other.visible || !other.points || other.points.length < 2) continue
      const op1 = { x: other.x + other.points[0].x, y: other.y + other.points[0].y }
      const op2 = { x: other.x + other.points[1].x, y: other.y + other.points[1].y }
      const hit = rayIntersectsSegment(origin, dirUnit, op1, op2)
      if (!hit) continue
      const t = distance(origin, hit)
      if (t > len + 1 && t < bestT) {
        bestT = t
        best = hit
      }
    }
    if (!best) return
    const before = this.snapshot()
    const newP1 = extendFrom1 ? best : p1
    const newP2 = extendFrom1 ? p2 : best
    const bounds = boundsOfPoints([newP1, newP2])
    this.doc = {
      ...this.doc,
      objects: this.doc.objects.map((o) =>
        o.id === target.id
          ? { ...o, x: bounds.x, y: bounds.y, width: Math.max(bounds.width, 1), height: Math.max(bounds.height, 1), points: [{ x: newP1.x - bounds.x, y: newP1.y - bounds.y }, { x: newP2.x - bounds.x, y: newP2.y - bounds.y }] }
          : o,
      ),
    }
    this.commit(before)
    this.notify()
    this.scheduleRender()
  }

  // ------------------------------------------------------------- V3C Boolean
  /**
   * Section 9 — Union/Subtract/Intersect/Exclude on exactly 2 compatible
   * selected shapes (rectangle/square/circle/polygon/path). Rasterizes both
   * shapes and vectorizes the composited result back into a single new
   * 'path' object (see lib/booleanOps.ts for why); the two sources are
   * removed and the result becomes the new selection.
   */
  booleanSelected(op: BooleanOp) {
    const targets = this.doc.objects.filter((o) => this.selection.includes(o.id) && !o.locked && BOOLEAN_COMPATIBLE_TYPES.includes(o.type))
    if (targets.length !== 2) return
    const [a, b] = targets
    const bounds = CanvasEngine.boundsOfObjects(targets)
    const padded = { x: bounds.x - 10, y: bounds.y - 10, width: bounds.width + 20, height: bounds.height + 20 }

    const paint = (o: CanvasObject) => (ctx: CanvasRenderingContext2D) => {
      const center = objectCenter(o)
      ctx.save()
      ctx.translate(center.x, center.y)
      ctx.rotate(degToRadLocal(o.rotation))
      const hw = o.width / 2
      const hh = o.height / 2
      const local = (p: Point) => ({ x: p.x - hw, y: p.y - hh })
      this.buildObjectFillPath(ctx, o, hw, hh, local)
      ctx.fill('evenodd')
      ctx.restore()
    }

    const subpaths = computeBoolean(paint(a), paint(b), padded, op)
    const before = this.snapshot()
    if (subpaths.length === 0) {
      // Nothing survived (e.g. Subtract with no overlap, or Intersect of shapes that don't touch) — just remove the sources.
      this.doc = { ...this.doc, objects: this.doc.objects.filter((o) => o.id !== a.id && o.id !== b.id) }
      this.selection = []
      this.commit(before)
      this.notify()
      this.scheduleRender()
      return
    }
    const resultBounds = boundsOfPoints(subpaths.flat())
    const result = this.baseObject('path', resultBounds.x, resultBounds.y, Math.max(resultBounds.width, 1), Math.max(resultBounds.height, 1))
    result.pathSubpaths = subpaths.map((loop) => loop.map((p) => ({ x: p.x - resultBounds.x, y: p.y - resultBounds.y })))
    result.fill = a.fill
    result.fillType = a.fillType
    result.materialId = a.materialId
    result.stroke = a.stroke
    result.strokeWidth = a.strokeWidth
    result.strokeEnabled = a.strokeEnabled
    result.opacity = a.opacity
    result.layerId = a.layerId

    this.doc = { ...this.doc, objects: [...this.doc.objects.filter((o) => o.id !== a.id && o.id !== b.id), result] }
    this.selection = [result.id]
    this.commit(before)
    this.notify()
    this.scheduleRender()
  }

  /** Builds just the fill path (no stroke/paint) for a shape in already-translated/rotated local space — shared by drawObject and the Boolean-op rasterizer so both agree on exactly the same geometry. */
  private buildObjectFillPath(ctx: CanvasRenderingContext2D, o: CanvasObject, hw: number, hh: number, local: (p: Point) => Point) {
    switch (o.type) {
      case 'rectangle':
      case 'square':
        ctx.beginPath()
        if (o.cornerRadii) {
          const maxR = Math.min(hw, hh)
          ctx.roundRect(-hw, -hh, o.width, o.height, [
            clamp(o.cornerRadii.topLeft ?? 0, 0, maxR),
            clamp(o.cornerRadii.topRight ?? 0, 0, maxR),
            clamp(o.cornerRadii.bottomRight ?? 0, 0, maxR),
            clamp(o.cornerRadii.bottomLeft ?? 0, 0, maxR),
          ])
        } else if (o.cornerRadius && o.cornerRadius > 0) {
          ctx.roundRect(-hw, -hh, o.width, o.height, Math.min(o.cornerRadius, hw, hh))
        } else {
          ctx.rect(-hw, -hh, o.width, o.height)
        }
        break
      case 'circle':
        ctx.beginPath()
        ctx.ellipse(0, 0, Math.max(hw, 0.01), Math.max(hh, 0.01), 0, 0, Math.PI * 2)
        break
      case 'polygon': {
        ctx.beginPath()
        if (o.points && o.points.length >= 2) {
          const pts = o.points.map(local)
          ctx.moveTo(pts[0].x, pts[0].y)
          for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y)
          ctx.closePath()
        }
        break
      }
      case 'path':
        this.buildPathGeometry(ctx, o, local)
        break
      default:
        ctx.beginPath()
        ctx.rect(-hw, -hh, o.width, o.height)
    }
  }

  /** Closes the path currently being edited (an open Pen path only). */
  closeEditingPath() {
    const obj = this.penPathObject()
    if (!obj || obj.pathClosed) return
    const before = this.snapshot()
    this.doc = { ...this.doc, objects: this.doc.objects.map((o) => (o.id === obj.id ? { ...o, pathClosed: true } : o)) }
    this.commit(before)
    this.notify()
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
      case 'path': {
        const center = objectCenter(o)
        const local = rotatePoint(worldPt, center, -o.rotation)
        if (o.pathSubpaths) {
          const absLoops = o.pathSubpaths.map((loop) => loop.map((p) => ({ x: o.x + p.x, y: o.y + p.y })))
          if (pointInMultiPolygon(local, absLoops)) return true
          return absLoops.some((loop) => distanceToPolyline(local, loop, true) <= padding)
        }
        if (!o.pathVertices || o.pathVertices.length < 2) return false
        const flat: Point[] = []
        const segmentCount = o.pathClosed ? o.pathVertices.length : o.pathVertices.length - 1
        for (let i = 0; i < segmentCount; i++) {
          const a = o.pathVertices[i]
          const b = o.pathVertices[(i + 1) % o.pathVertices.length]
          const c1 = a.handleOut ?? a
          const c2 = b.handleIn ?? b
          flat.push(...flattenCubicBezier(a, c1, c2, b, 8))
        }
        const abs = flat.map((p) => ({ x: o.x + p.x, y: o.y + p.y }))
        if (o.pathClosed && pointInPolygon(local, abs)) return true
        return distanceToPolyline(local, abs, o.pathClosed ?? false) <= padding + o.strokeWidth
      }
      default:
        return pointInRotatedRect(worldPt, o, padding)
    }
  }

  // -------------------------------------------------------------- pointer
  private maybeSnap(pt: Point): Point {
    return this.doc.settings.snapToGrid ? snapPoint(pt, this.doc.settings.gridSize) : pt
  }

  private isTwoPointTool(tool: CanvasToolId): tool is 'rectangle' | 'square' | 'circle' | 'line' | 'arc' | 'semicircle' {
    return tool === 'rectangle' || tool === 'square' || tool === 'circle' || tool === 'line' || tool === 'arc' || tool === 'semicircle'
  }

  private isTwoPointObjectType(type: CanvasObjectType | 'semicircle'): boolean {
    return type === 'rectangle' || type === 'square' || type === 'circle' || type === 'line' || type === 'arc' || type === 'semicircle'
  }

  pointerDown(screenPt: Point, opts: { shiftKey?: boolean } = {}) {
    const worldRaw = this.screenToWorld(screenPt)
    const world = this.maybeSnap(worldRaw)

    if (this.spacePanOverride || this.tool === 'pan') {
      this.drag = { kind: 'pan', startWorld: screenPt, currentWorld: screenPt, before: [], initial: new Map() }
      return
    }

    if (this.pendingLeaderTextId) {
      const textId = this.pendingLeaderTextId
      this.pendingLeaderTextId = null
      const before = this.snapshot()
      this.doc = { ...this.doc, objects: this.doc.objects.map((o) => (o.id === textId ? { ...o, calloutTarget: { x: worldRaw.x, y: worldRaw.y } } : o)) }
      this.commit(before)
      this.notify()
      this.scheduleRender()
      return
    }

    // V3C Pen tool path-edit mode — takes priority over the normal
    // select/pen dispatch below while a path is being edited, but only
    // consumes the click when it actually hits a handle or (with Pen
    // active) lands on the path itself to insert a new anchor. Anything
    // else falls through to the ordinary tool logic, which naturally exits
    // edit mode by clicking elsewhere.
    if (this.editingPathId && (this.tool === 'select' || this.tool === 'pen')) {
      if (this.pointerDownPathEdit(screenPt, worldRaw)) return
    }

    if (this.tool === 'pen') {
      this.pointerDownPen(screenPt, worldRaw)
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

    if (this.tool === 'trim') {
      this.pointerDownTrim(worldRaw)
      return
    }

    if (this.tool === 'extend') {
      this.pointerDownExtend(worldRaw)
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
    if (this.penDrag) {
      this.pointerMovePenDrag(screenPt)
      return
    }

    if (this.penDraft) {
      const worldRaw = this.screenToWorld(screenPt)
      this.penHoverPoint = worldRaw
      if (this.penActiveVertexIndex !== null && this.penDownScreen && distance(screenPt, this.penDownScreen) > CLICK_DRAG_THRESHOLD) {
        const vertex = this.penDraft[this.penActiveVertexIndex]
        vertex.handleOut = { x: worldRaw.x, y: worldRaw.y }
        vertex.handleIn = { x: 2 * vertex.x - worldRaw.x, y: 2 * vertex.y - worldRaw.y }
        vertex.smooth = true
      }
      this.scheduleRender()
      return
    }

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
    if (this.penDrag) {
      this.commit(this.penDragBefore ?? this.snapshot())
      this.penDrag = null
      this.penDragBefore = null
      this.notify()
      this.scheduleRender()
      return
    }
    if (this.penActiveVertexIndex !== null) {
      this.penActiveVertexIndex = null
      return
    }

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
    } else if (spec.type === 'semicircle') {
      const diameter = Math.max(spec.diameter, MIN_SIZE)
      const radius = diameter / 2
      obj = this.baseObject('arc', atWorld.x - radius, atWorld.y - radius, diameter, radius)
      obj.points = [
        { x: 0, y: radius },
        { x: diameter, y: radius },
      ]
      obj.arcBulge = 1
      obj.closed = true
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
    } else if (draft.type === 'semicircle') {
      // V3C dedicated Semicircle tool — drag defines the diameter directly
      // (like Line), rather than a bounding box (like Circle); the bulge is
      // fixed at exactly 1 (a true 180° half-circle). The bounding box is
      // computed by sampling the actual rendered arc rather than derived
      // algebraically, so it can't drift out of sync with drawObject's arc
      // rendering if that ever changes.
      const p1 = { x: 0, y: 0 }
      const p2 = { x: draft.current.x - draft.start.x, y: draft.current.y - draft.start.y }
      if (distance(p1, p2) < MIN_SIZE && !force) return
      const arc = arcFromBulge(p1, p2, 1)
      const samplePts = [p1, p2]
      if (arc) {
        const sweep = arc.ccw ? -Math.PI : Math.PI
        for (let i = 0; i <= 16; i++) {
          const t = arc.startAngle + (sweep * i) / 16
          samplePts.push({ x: arc.center.x + Math.cos(t) * arc.radius, y: arc.center.y + Math.sin(t) * arc.radius })
        }
      }
      const bounds = boundsOfPoints(samplePts)
      obj = this.baseObject('arc', draft.start.x + bounds.x, draft.start.y + bounds.y, Math.max(bounds.width, 1), Math.max(bounds.height, 1))
      obj.points = [{ x: p1.x - bounds.x, y: p1.y - bounds.y }, { x: p2.x - bounds.x, y: p2.y - bounds.y }]
      obj.arcBulge = 1
      obj.closed = true
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
    this.drawCallouts(ctx)
    this.drawDraft(ctx)

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    this.drawSelectionOverlay(ctx)
    if (this.doc.settings.showDimensions ?? true) this.drawLiveDimensions(ctx)
    this.drawDraftLabel(ctx)
    this.drawMeasure(ctx)
    this.drawAlignmentGuides(ctx)
    this.drawMarquee(ctx)
    this.drawLasso(ctx)
    this.drawPenDraft(ctx)
    this.drawPathEditOverlay(ctx)
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
    this.drawCenteredScreenPill(ctx, formatLength(distance(a, b), unit), midScreen, MEASURE_COLOR, '#ffffff')

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
      this.drawCenteredScreenPill(ctx, formatLength(dxWorld, unit), { x: (sa.x + corner.x) / 2, y: corner.y }, 'rgba(47, 111, 237, 0.75)', '#ffffff')
      this.drawCenteredScreenPill(ctx, formatLength(dyWorld, unit), { x: corner.x, y: (corner.y + sb.y) / 2 }, 'rgba(47, 111, 237, 0.75)', '#ffffff')
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
      text = formatLengthPair(w, h, unit)
    } else if (draft.type === 'square') {
      const size = Math.max(Math.abs(draft.current.x - draft.start.x), Math.abs(draft.current.y - draft.start.y))
      text = formatLength(size, unit)
    } else if (draft.type === 'circle') {
      const size = Math.max(Math.abs(draft.current.x - draft.start.x), Math.abs(draft.current.y - draft.start.y))
      text = prefixedLength('Ø', size, unit)
    } else if (draft.type === 'line') {
      text = formatLength(distance(draft.start, draft.current), unit)
    } else if (draft.type === 'semicircle') {
      text = prefixedLength('Ø', distance(draft.start, draft.current), unit)
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
        text = o.type === 'square' ? formatLength(o.width, unit) : formatLengthPair(o.width, o.height, unit)
        anchorWorld = rotatePoint({ x: o.x + o.width, y: o.y + o.height }, objectCenter(o), o.rotation)
      } else if (o.type === 'circle') {
        text = prefixedLength('Ø', o.width, unit)
        anchorWorld = rotatePoint({ x: o.x + o.width, y: o.y + o.height }, objectCenter(o), o.rotation)
      } else if (o.type === 'line' && o.points && o.points.length >= 2) {
        const [p1, p2] = o.points
        text = formatLength(distance(p1, p2), unit)
        anchorWorld = { x: o.x + Math.max(p1.x, p2.x), y: o.y + Math.max(p1.y, p2.y) }
      } else if (o.type === 'arc' && o.points && o.points.length >= 2) {
        const [p1, p2] = o.points
        const arc = arcFromBulge(p1, p2, o.arcBulge ?? 0.5)
        if (arc) {
          text = prefixedLength('R', arc.radius, unit)
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

  /** V3C text leader/callout lines — drawn in world space, a thin line from each text box's edge to its target point. */
  private drawCallouts(ctx: CanvasRenderingContext2D) {
    for (const o of this.doc.objects) {
      if (o.type !== 'text' || !o.calloutTarget || !o.visible) continue
      const center = objectCenter(o)
      const edgePoint = rotatePoint({ x: o.calloutTarget.x < center.x ? o.x : o.x + o.width, y: center.y }, center, o.rotation)
      ctx.save()
      ctx.strokeStyle = o.stroke
      ctx.lineWidth = 1
      ctx.setLineDash([4, 3])
      ctx.beginPath()
      ctx.moveTo(edgePoint.x, edgePoint.y)
      ctx.lineTo(o.calloutTarget.x, o.calloutTarget.y)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = o.stroke
      ctx.beginPath()
      ctx.arc(o.calloutTarget.x, o.calloutTarget.y, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
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
        if (o.cornerRadii) {
          const maxR = Math.min(hw, hh)
          const radii: [number, number, number, number] = [
            clamp(o.cornerRadii.topLeft ?? 0, 0, maxR),
            clamp(o.cornerRadii.topRight ?? 0, 0, maxR),
            clamp(o.cornerRadii.bottomRight ?? 0, 0, maxR),
            clamp(o.cornerRadii.bottomLeft ?? 0, 0, maxR),
          ]
          ctx.roundRect(-hw, -hh, o.width, o.height, radii)
        } else if (o.cornerRadius && o.cornerRadius > 0) {
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
        // V3C — a closed arc (Semicircle, or any arc the designer closes)
        // fills the pie/chord area bounded by the curve and the p1-p2
        // chord, useful for arches, niches and rounded details.
        if (o.closed) {
          ctx.closePath()
          this.paintClosedFill(ctx, o, hw, hh)
        }
        if (o.strokeEnabled) ctx.stroke()
        break
      }
      case 'path': {
        this.buildPathGeometry(ctx, o, local)
        if (o.pathSubpaths) {
          this.paintClosedFill(ctx, o, hw, hh, 'evenodd')
          if (o.strokeEnabled) ctx.stroke()
        } else if (o.pathClosed) {
          this.paintClosedFill(ctx, o, hw, hh)
          if (o.strokeEnabled) ctx.stroke()
        } else if (o.strokeEnabled) {
          ctx.stroke()
        }
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
        const label = o.dimensionLabel ?? formatLength(o.dimensionValue ?? distance(p1, p2), this.doc.settings.unit)
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
        const fontSize = o.fontSize ?? 32
        const bold = o.fontWeight === 'bold'
        if (o.textBackground && o.textBackground !== 'none') {
          ctx.fillStyle = o.textBackground
          ctx.fillRect(-hw, -hh, o.width, o.height)
        }
        ctx.fillStyle = o.fill
        ctx.font = `${bold ? '700' : '400'} ${fontSize}px Manrope, sans-serif`
        ctx.textAlign = o.textAlign ?? 'left'
        ctx.textBaseline = 'top'
        const tx = o.textAlign === 'center' ? 0 : o.textAlign === 'right' ? hw : -hw
        const lines = o.textBoxWidth ? wrapText(ctx, o.text ?? '', fontSize, o.textBoxWidth, bold) : [o.text ?? '']
        const lineHeight = fontSize * 1.3
        lines.forEach((line, i) => ctx.fillText(line, tx, -hh + i * lineHeight))
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
   * Builds the Path2D-equivalent geometry for a 'path' object onto `ctx`
   * (caller then fills/strokes it) — either the Pen tool's Bézier vertices,
   * or a Boolean-op result's straight-edged subpath loops. `local` converts
   * an object-local point into the already-translated/rotated draw space.
   */
  private buildPathGeometry(ctx: CanvasRenderingContext2D, o: CanvasObject, local: (p: Point) => Point) {
    ctx.beginPath()
    if (o.pathSubpaths) {
      for (const subpath of o.pathSubpaths) {
        if (subpath.length < 2) continue
        const pts = subpath.map(local)
        ctx.moveTo(pts[0].x, pts[0].y)
        for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y)
        ctx.closePath()
      }
      return
    }
    const vertices = o.pathVertices
    if (!vertices || vertices.length < 2) return
    const pts = vertices.map((v) => ({
      anchor: local(v),
      handleIn: v.handleIn ? local(v.handleIn) : local(v),
      handleOut: v.handleOut ? local(v.handleOut) : local(v),
    }))
    ctx.moveTo(pts[0].anchor.x, pts[0].anchor.y)
    const segmentCount = o.pathClosed ? pts.length : pts.length - 1
    for (let i = 0; i < segmentCount; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % pts.length]
      ctx.bezierCurveTo(a.handleOut.x, a.handleOut.y, b.handleIn.x, b.handleIn.y, b.anchor.x, b.anchor.y)
    }
    if (o.pathClosed) ctx.closePath()
  }

  /**
   * Paints the fill for a closed shape whose path is already on `ctx`
   * (rect/ellipse/polygon, not yet stroked). Colour fills are unchanged from
   * V1; texture/image fills are painted live every frame from the material
   * catalogue / cached image — the object itself never gets rasterized, it
   * just gets a different paint each render.
   */
  private paintClosedFill(ctx: CanvasRenderingContext2D, o: CanvasObject, hw: number, hh: number, fillRule: CanvasFillRule = 'nonzero') {
    if (o.fillType === 'color') {
      if (o.fill !== 'none') {
        ctx.fillStyle = o.fill
        ctx.fill(fillRule)
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
        ctx.fill(fillRule)
        ctx.restore()
        return
      }
      // Material removed from the catalogue since this was saved — fall back to its stored flat colour.
      if (o.fill !== 'none') {
        ctx.fillStyle = o.fill
        ctx.fill(fillRule)
      }
      return
    }

    if (o.fillType === 'image' && o.imageData) {
      const img = getCachedImage(o.imageData)
      if (!img) {
        // Still decoding — paint a neutral placeholder and repaint once it's ready.
        ctx.fillStyle = o.fill !== 'none' ? o.fill : '#d8d3c8'
        ctx.fill(fillRule)
        onImageReady(o.imageData, () => this.scheduleRender())
        return
      }
      ctx.save()
      ctx.clip(fillRule)
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
      ctx.fill(fillRule)
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
    } else if (draft.type === 'line' || draft.type === 'arc' || draft.type === 'dimension' || draft.type === 'semicircle') {
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

  /** In-progress Pen path: placed anchors/handles, curve segments so far, and a rubber-band preview to the cursor. */
  private drawPenDraft(ctx: CanvasRenderingContext2D) {
    if (!this.penDraft || this.penDraft.length === 0) return
    const PEN_COLOR = '#2f6fed'
    const screenPts = this.penDraft.map((v) => ({
      anchor: this.worldToScreen(v),
      handleIn: v.handleIn ? this.worldToScreen(v.handleIn) : undefined,
      handleOut: v.handleOut ? this.worldToScreen(v.handleOut) : undefined,
    }))

    ctx.save()
    ctx.strokeStyle = PEN_COLOR
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(screenPts[0].anchor.x, screenPts[0].anchor.y)
    for (let i = 1; i < screenPts.length; i++) {
      const a = screenPts[i - 1]
      const b = screenPts[i]
      ctx.bezierCurveTo(a.handleOut?.x ?? a.anchor.x, a.handleOut?.y ?? a.anchor.y, b.handleIn?.x ?? b.anchor.x, b.handleIn?.y ?? b.anchor.y, b.anchor.x, b.anchor.y)
    }
    ctx.stroke()

    // Rubber-band preview to the live cursor position.
    if (this.penHoverPoint) {
      const hoverScreen = this.worldToScreen(this.penHoverPoint)
      const last = screenPts[screenPts.length - 1]
      ctx.setLineDash([5, 4])
      ctx.beginPath()
      ctx.moveTo(last.anchor.x, last.anchor.y)
      ctx.lineTo(hoverScreen.x, hoverScreen.y)
      ctx.stroke()
      ctx.setLineDash([])
    }

    for (const p of screenPts) {
      if (p.handleOut) this.drawPenHandleLine(ctx, p.anchor, p.handleOut, PEN_COLOR)
      if (p.handleIn) this.drawPenHandleLine(ctx, p.anchor, p.handleIn, PEN_COLOR)
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = PEN_COLOR
      ctx.beginPath()
      ctx.rect(p.anchor.x - 4, p.anchor.y - 4, 8, 8)
      ctx.fill()
      ctx.stroke()
    }
    ctx.restore()
  }

  private drawPenHandleLine(ctx: CanvasRenderingContext2D, anchor: Point, handle: Point, color: string) {
    ctx.save()
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(anchor.x, anchor.y)
    ctx.lineTo(handle.x, handle.y)
    ctx.stroke()
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(handle.x, handle.y, 3.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  /** Vertex-edit-mode overlay for a 'path' object double-clicked with Select — anchors, handles, and their connector lines. */
  private drawPathEditOverlay(ctx: CanvasRenderingContext2D) {
    const obj = this.penPathObject()
    if (!obj || !obj.pathVertices) return
    const EDIT_COLOR = '#2f6fed'
    ctx.save()
    for (let i = 0; i < obj.pathVertices.length; i++) {
      const v = obj.pathVertices[i]
      const anchorScreen = this.worldToScreen({ x: obj.x + v.x, y: obj.y + v.y })
      if (v.handleOut) {
        const hs = this.worldToScreen({ x: obj.x + v.handleOut.x, y: obj.y + v.handleOut.y })
        this.drawPenHandleLine(ctx, anchorScreen, hs, EDIT_COLOR)
      }
      if (v.handleIn) {
        const hs = this.worldToScreen({ x: obj.x + v.handleIn.x, y: obj.y + v.handleIn.y })
        this.drawPenHandleLine(ctx, anchorScreen, hs, EDIT_COLOR)
      }
      const selected = i === this.selectedVertexIndex
      ctx.fillStyle = selected ? EDIT_COLOR : '#ffffff'
      ctx.strokeStyle = EDIT_COLOR
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.rect(anchorScreen.x - 5, anchorScreen.y - 5, 10, 10)
      ctx.fill()
      ctx.stroke()
    }
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

/** "Ø2400 mm" / "R1200 mm" style label — `formatLengthValue` is already fully self-contained for ft+in (e.g. `7'10.49"`), so the unit suffix is only appended for the simple units. */
function prefixedLength(prefix: string, mm: number, unit: CanvasUnit): string {
  if (unit === 'ftin') return `${prefix}${formatLengthValue(mm, unit)}`
  return `${prefix}${formatLengthValue(mm, unit)} ${unitSuffix(unit)}`
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
