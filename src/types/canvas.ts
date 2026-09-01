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

export type CanvasToolId =
  | 'select'
  | 'pan'
  | 'rectangle'
  | 'square'
  | 'circle'
  | 'line'
  | 'arc'
  | 'polygon'
  | 'freeDraw'
  | 'text'
  | 'dimension'
  | 'fill'
  | 'eyedropper'

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

/** color | texture | image — only 'color' is actually implemented in V1. */
export type FillType = 'color' | 'texture' | 'image'

export interface Point {
  x: number
  y: number
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
  /** Polygon only: true once the user has closed the shape. */
  closed?: boolean

  // Text
  text?: string
  fontSize?: number
  textAlign?: 'left' | 'center' | 'right'

  // Dimension — structured data, not permanently drawn text.
  dimensionValue?: number // mm, real-world length
  dimensionLabel?: string // optional manual override

  // Texture/image fill — foundation only (AURA CANVAS V2 fills these in).
  textureId?: string
  imageId?: string
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
export type CanvasUnit = 'mm' | 'cm' | 'm'

export interface CanvasSettings {
  gridSize: number // mm
  showGrid: boolean
  snapToGrid: boolean
  ortho: boolean
  unit: CanvasUnit
  viewMode: CanvasViewMode
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

export const CLOSED_SHAPE_TYPES: CanvasObjectType[] = ['rectangle', 'square', 'circle', 'polygon']
