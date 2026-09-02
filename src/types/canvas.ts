// AURA CANVAS — domain model for the 2D drawing engine.
//
// Internal document coordinates are millimetres. This makes a dimension
// object's measured length a direct read of world-space distance (no extra
// scale factor to thread through), and keeps the door open for real
// interior dimensions (1200mm, 2400mm, 450mm) without any unit juggling —
// only the *display* label (CanvasSettings.unit) formats mm into cm/m/ft.
//
// One flat object shape (rather than a discriminated union per type) is a
// deliberate simplification for this phase: every tool/renderer branches on
// `type`, but doesn't need constant type-narrowing ceremony. Fields that
// only some types use (points, text, dimensionValue, texture placeholders)
// are optional.

import type { CanvasUnit } from '@/lib/units'
export type { CanvasUnit } from '@/lib/units'

export type CanvasToolId =
  | 'select'
  | 'pan'
  | 'rectangle'
  | 'square'
  | 'circle'
  | 'line'
  | 'arc'
  | 'semicircle'
  | 'polygon'
  | 'freeDraw'
  | 'pen'
  | 'text'
  | 'dimension'
  | 'fill'
  | 'eyedropper'
  | 'measure'
  | 'lasso'
  | 'trim'
  | 'extend'

/** Object types buildable in this phase. */
export type DrawableObjectType =
  | 'rectangle'
  | 'square'
  | 'circle'
  | 'line'
  | 'arc'
  | 'polygon'
  | 'freeDraw'
  | 'text'
  | 'dimension'
  | 'path'

/**
 * Reserved for later Canvas phases (V2 materials, V3 interior components).
 * Included now purely so the object model doesn't need a breaking change
 * when those land — nothing in this phase creates or renders these yet.
 */
export type ReservedObjectType =
  | 'wall'
  | 'door'
  | 'window'
  | 'cabinet'
  | 'wardrobe'
  | 'kitchenUnit'
  | 'tvUnit'
  | 'shelf'
  | 'countertop'
  | 'partition'

export type CanvasObjectType = DrawableObjectType | ReservedObjectType

/** color | texture | image — V1 shipped 'color' only; V2 adds texture + image. */
export type FillType = 'color' | 'texture' | 'image'

/** How a custom image fill is fitted inside its shape (texture fills always tile). */
export type FillFit = 'tile' | 'cover' | 'contain'

export interface Point {
  x: number
  y: number
}

/** AURA CANVAS V3C — one anchor of a Pen tool path, in the object's local space. */
export interface PathVertex {
  x: number
  y: number
  /** Incoming Bézier control point (local space). Absent = a straight corner on the incoming side. */
  handleIn?: Point
  /** Outgoing Bézier control point (local space). Absent = a straight corner on the outgoing side. */
  handleOut?: Point
  /** Editing convenience: dragging one handle mirrors the other through the anchor. Purely a UX flag — rendering only ever looks at handleIn/handleOut. */
  smooth?: boolean
}

export interface CanvasObject {
  id: string
  type: CanvasObjectType
  /** Bounding-box top-left, before rotation, in document mm. */
  x: number
  y: number
  width: number
  height: number
  /** Degrees, clockwise, around the bounding-box centre. */
  rotation: number

  fillType: FillType
  fill: string
  opacity: number

  strokeEnabled: boolean
  stroke: string
  strokeWidth: number

  layerId: string
  /** Objects sharing a groupId move/select together (minimal grouping). */
  groupId?: string
  locked: boolean
  visible: boolean

  /**
   * Local-space vertices (0,0 = x,y, i.e. relative to the bounding box),
   * used by line / arc / polygon / freeDraw. Rectangles/circles/text derive
   * their shape purely from x/y/width/height and don't need this.
   */
  points?: Point[]
  /** Arc only: signed bulge (tan(includedAngle/4)) between points[0] and points[1]. */
  arcBulge?: number
  /** Polygon/arc only: true once the user has closed the shape (arc: also fills the pie/chord area, e.g. a Semicircle). */
  closed?: boolean
  /** Rectangle/square only (AURA CANVAS V3A): uniform corner radius in mm, clamped to half the smaller side when rendered. Superseded by `cornerRadii` when present (V3C). */
  cornerRadius?: number
  /** Rectangle/square only (AURA CANVAS V3C): independent per-corner radius in mm. Falls back to `cornerRadius` (then 0) for any missing corner, so older documents keep rendering unchanged. */
  cornerRadii?: { topLeft?: number; topRight?: number; bottomRight?: number; bottomLeft?: number }

  /**
   * Pen tool path (AURA CANVAS V3C, type 'path'). Cubic-bezier vertices in
   * local space (relative to x/y, like `points`) — a vertex with no handles
   * renders as a straight corner; `bezierCurveTo` degrades to a straight
   * line automatically when a control point equals its anchor, so corner
   * and curve segments share one code path.
   */
  pathVertices?: PathVertex[]
  pathClosed?: boolean
  /**
   * Boolean-operation result (AURA CANVAS V3C, type 'path'). One or more
   * straight-edged local-space loops, filled with the even-odd rule so a
   * nested loop automatically renders as a hole (e.g. Subtract). Mutually
   * exclusive with `pathVertices` on the same object — a boolean result is
   * always straight-edged, never re-curved.
   */
  pathSubpaths?: Point[][]

  // Text
  text?: string
  fontSize?: number
  textAlign?: 'left' | 'center' | 'right'
  /** V3C: bold weight for the text object's own rendering (not a global typography system). */
  fontWeight?: 'normal' | 'bold'
  /** V3C: manual wrap width in mm — when set, text greedily word-wraps to fit instead of rendering as one line. */
  textBoxWidth?: number
  /** V3C: optional solid background panel behind the text, drawn before the glyphs. 'none' (default) means no background. */
  textBackground?: string
  /** V3C: optional leader/callout line from the text box to a world-space point — lightweight room for the later annotation system, not a full callout editor. */
  calloutTarget?: Point

  // Dimension — structured data, not permanently drawn text.
  dimensionValue?: number // mm, real-world length
  dimensionLabel?: string // optional manual override

  // Texture/image fill (AURA CANVAS V2).
  /** Set when fillType is 'texture' (or a Colours-category material was applied via the Material Panel) — id into the material catalogue. */
  materialId?: string
  /** Set when fillType is 'image' — the custom image itself, as a downscaled data URI (so save/reload never depends on a blob URL or external file). */
  imageData?: string
  /** Custom image only; texture fills always tile. */
  fillFit?: FillFit
  textureScale?: number
  textureOffset?: Point
  textureRotation?: number
}

export interface CanvasLayer {
  id: string
  name: string
  visible: boolean
  locked: boolean
  order: number
}

export type CanvasViewMode = 'plan' | 'elevation'

export interface CanvasSettings {
  gridSize: number // mm
  showGrid: boolean
  snapToGrid: boolean
  ortho: boolean
  unit: CanvasUnit
  viewMode: CanvasViewMode
  /**
   * AURA CANVAS V3A — automatic live dimension annotations on selected
   * objects. Optional (rather than required) so documents saved before V3A
   * still load correctly; engine reads it as `?? true`.
   */
  showDimensions?: boolean
}

export interface CanvasDocument {
  id: string
  roomId: string
  projectId: string
  objects: CanvasObject[]
  layers: CanvasLayer[]
  activeLayerId: string
  settings: CanvasSettings
  createdAt: string
  updatedAt: string
}

export const DEFAULT_LAYERS: Omit<CanvasLayer, 'id'>[] = [
  { name: 'Architecture', visible: true, locked: false, order: 0 },
  { name: 'Walls', visible: true, locked: false, order: 1 },
  { name: 'Furniture', visible: true, locked: false, order: 2 },
  { name: 'Cabinetry', visible: true, locked: false, order: 3 },
  { name: 'Annotations', visible: true, locked: false, order: 4 },
  { name: 'Dimensions', visible: true, locked: false, order: 5 },
]

export const CLOSED_SHAPE_TYPES: CanvasObjectType[] = ['rectangle', 'square', 'circle', 'polygon', 'path']

/** Shapes a Boolean operation or Offset can meaningfully act on. */
export const BOOLEAN_COMPATIBLE_TYPES: CanvasObjectType[] = ['rectangle', 'square', 'circle', 'polygon', 'path']

/** AURA CANVAS V3A — the double-click/double-tap precision-creation popup's typed input, per tool. */
export type PreciseCreateSpec =
  | { type: 'rectangle'; width: number; height: number; cornerRadius: number; fill: string; stroke: string }
  | { type: 'circle'; diameter: number; fill: string; stroke: string }
  | { type: 'line'; length: number; angleDeg: number; stroke: string }
  | { type: 'semicircle'; diameter: number; fill: string; stroke: string }

/**
 * AURA CANVAS V3C — Copy Style / Paste Style clipboard. A snapshot of an
 * object's purely-visual properties (never geometry), applied to a
 * different object's existing shape rather than duplicating it.
 */
export interface CopiedStyle {
  fillType: FillType
  fill: string
  opacity: number
  strokeEnabled: boolean
  stroke: string
  strokeWidth: number
  materialId?: string
  imageData?: string
  fillFit?: FillFit
  textureScale?: number
  textureOffset?: Point
  textureRotation?: number
  cornerRadius?: number
  cornerRadii?: CanvasObject['cornerRadii']
}
