import { generateId } from '@/lib/id'
import { createDemoCanvasObjects } from '@/lib/canvasDemo'
import type { CanvasDocument, CanvasElevationInfo, CanvasLayer, CanvasSettings, PerspectiveSettings } from '@/types/canvas'
import { DEFAULT_LAYERS } from '@/types/canvas'
import type { Room } from '@/types'
import { namespacedKey } from '@/supabase/localNamespace'

/** FINAL PERSPECTIVE INTEGRATION — a dedicated layer for reference/underlay images, kept separate from every drawing layer so it's always trivial to hide without touching the actual design. Only added to a room's Perspective document, per the spec's "dedicated... where appropriate" — Plan/Elevation keep the exact same layer set as before. */
const PERSPECTIVE_REFERENCE_LAYER = 'Reference'

const STORAGE_PREFIX = 'aura-canvas:'
const FT_TO_MM = 304.8

/**
 * AURA CANVAS V3D — 'plan' keeps the exact pre-V3D key (`aura-canvas:{roomId}`)
 * so every room saved by V1-V3C keeps loading unchanged; a wall elevation is
 * purely additive, under its own suffixed key. This is what lets Plan and its
 * elevations share one Room without either overwriting the other's storage,
 * and without touching a single byte of the existing Plan format.
 */
function storageKey(roomId: string, viewId: string): string {
  const base = viewId === 'plan' ? `${STORAGE_PREFIX}${roomId}` : `${STORAGE_PREFIX}${roomId}:${viewId}`
  return namespacedKey(base)
}

/** Every Canvas localStorage key for a given room (all views) — used by cloud sync/migration to enumerate what exists locally without guessing view ids. */
export function listLocalCanvasKeysForRoom(roomId: string): string[] {
  const prefix = namespacedKey(`${STORAGE_PREFIX}${roomId}`)
  const keys: string[] = []
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i)
    if (key && (key === prefix || key.startsWith(`${prefix}:`))) keys.push(key)
  }
  return keys
}

/** Every Canvas document currently cached locally, regardless of room — used by cloud sync/migration. */
export function listAllLocalCanvasDocuments(): CanvasDocument[] {
  const prefix = namespacedKey(STORAGE_PREFIX)
  const docs: CanvasDocument[] = []
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i)
    if (!key || !key.startsWith(prefix)) continue
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) continue
      const doc = JSON.parse(raw) as CanvasDocument
      docs.push(doc.viewId ? doc : { ...doc, viewId: 'plan' })
    } catch {
      // Skip anything unreadable rather than failing the whole scan.
    }
  }
  return docs
}

export function loadRoomCanvas(roomId: string, viewId: string = 'plan'): CanvasDocument | null {
  try {
    const raw = window.localStorage.getItem(storageKey(roomId, viewId))
    if (!raw) return null
    const doc = JSON.parse(raw) as CanvasDocument
    return doc.viewId ? doc : { ...doc, viewId: 'plan' }
  } catch {
    return null
  }
}

export function saveRoomCanvas(doc: CanvasDocument): void {
  try {
    window.localStorage.setItem(storageKey(doc.roomId, doc.viewId ?? 'plan'), JSON.stringify(doc))
  } catch {
    // Storage can fail (private browsing, quota) — saving is best-effort for this phase.
  }
}

function defaultSettings(overrides?: Partial<CanvasSettings>): CanvasSettings {
  return {
    gridSize: 100,
    showGrid: true,
    snapToGrid: true,
    ortho: false,
    unit: 'mm',
    viewMode: 'plan',
    showDimensions: true,
    drawingMode: 'designer',
    ...overrides,
  }
}

export function createFreshCanvasDocument(
  projectId: string,
  roomId: string,
  roomLengthFt: number,
  roomWidthFt: number,
): CanvasDocument {
  const layers: CanvasLayer[] = DEFAULT_LAYERS.map((l) => ({ ...l, id: generateId('layer') }))
  const now = new Date().toISOString()
  return {
    id: generateId('canvas'),
    projectId,
    roomId,
    viewId: 'plan',
    objects: createDemoCanvasObjects(roomLengthFt, roomWidthFt, layers),
    layers,
    activeLayerId: layers.find((l) => l.name === 'Furniture')?.id ?? layers[0].id,
    settings: defaultSettings({ viewMode: 'plan' }),
    createdAt: now,
    updatedAt: now,
  }
}

/** Loads the saved canvas for a room, or creates a fresh demo one if none exists yet. */
export function getOrCreateRoomCanvas(
  projectId: string,
  roomId: string,
  roomLengthFt: number,
  roomWidthFt: number,
): CanvasDocument {
  return loadRoomCanvas(roomId, 'plan') ?? createFreshCanvasDocument(projectId, roomId, roomLengthFt, roomWidthFt)
}

// ---------------------------------------------------------------- V3D — wall elevations

/**
 * A rectangular room's four walls, alternating the room's length/width
 * sides, all sharing the room's own height — derived directly from the
 * Room Builder's stored dimensions rather than re-entered by hand (per the
 * V3D spec's "wall dimensions should derive from room/wall data rather
 * than manually duplicated values"). Extensible: a future non-rectangular
 * room could return more than 4 entries without changing any caller.
 */
export function computeRoomWalls(room: Pick<Room, 'dimensions'>): CanvasElevationInfo[] {
  const lengthMm = Math.max(room.dimensions.lengthFt, 4) * FT_TO_MM
  const widthMm = Math.max(room.dimensions.widthFt, 4) * FT_TO_MM
  const heightMm = Math.max(room.dimensions.heightFt, 6) * FT_TO_MM
  const spans = [widthMm, lengthMm, widthMm, lengthMm]
  return spans.map((wallWidthMm, i) => ({
    wallIndex: i + 1,
    wallLabel: `Wall ${i + 1}`,
    wallWidthMm,
    wallHeightMm: heightMm,
  }))
}

function createElevationDocument(
  projectId: string,
  roomId: string,
  elevation: CanvasElevationInfo,
  seedSettings?: CanvasSettings,
): CanvasDocument {
  const layers: CanvasLayer[] = DEFAULT_LAYERS.map((l) => ({ ...l, id: generateId('layer') }))
  const archLayer = layers.find((l) => l.name === 'Architecture')?.id ?? layers[0].id
  const now = new Date().toISOString()
  return {
    id: generateId('canvas'),
    projectId,
    roomId,
    viewId: `wall-${elevation.wallIndex}`,
    elevation,
    objects: [
      {
        id: generateId('obj'),
        type: 'rectangle',
        x: 0,
        y: 0,
        width: elevation.wallWidthMm,
        height: elevation.wallHeightMm,
        rotation: 0,
        fillType: 'color',
        fill: '#f6f1ea',
        opacity: 1,
        strokeEnabled: true,
        stroke: '#948676',
        strokeWidth: 1,
        layerId: archLayer,
        locked: false,
        visible: true,
      },
    ],
    layers,
    activeLayerId: layers.find((l) => l.name === 'Annotations')?.id ?? layers[0].id,
    // Seeded from the room's Plan document (when available) so a wall
    // elevation opens with the same unit/grid/mode the designer is already
    // using, rather than always resetting to factory defaults — see V3D
    // section 4 ("use the project's selected measurement units"). After
    // creation each view's settings evolve independently, same as every
    // other per-document setting in this app.
    settings: defaultSettings({ ...seedSettings, viewMode: 'elevation' }),
    createdAt: now,
    updatedAt: now,
  }
}

/** Loads a room's saved wall-elevation document, or creates a fresh one seeded from the room's own dimensions (and, when available, the Plan document's current display settings). */
export function getOrCreateRoomView(
  projectId: string,
  roomId: string,
  viewId: string,
  room: Pick<Room, 'dimensions'>,
): CanvasDocument {
  if (viewId === 'plan') {
    return getOrCreateRoomCanvas(projectId, roomId, room.dimensions.lengthFt, room.dimensions.widthFt)
  }
  if (viewId === 'perspective') {
    const existingPerspective = loadRoomCanvas(roomId, 'perspective')
    if (existingPerspective) return existingPerspective
    const planDoc = loadRoomCanvas(roomId, 'plan')
    return createPerspectiveDocument(projectId, roomId, planDoc?.settings)
  }
  const existing = loadRoomCanvas(roomId, viewId)
  if (existing) return existing
  const wallIndex = Number(viewId.replace('wall-', ''))
  const walls = computeRoomWalls(room)
  const elevation = walls.find((w) => w.wallIndex === wallIndex) ?? walls[0]
  const planDoc = loadRoomCanvas(roomId, 'plan')
  return createElevationDocument(projectId, roomId, elevation, planDoc?.settings)
}

// ---------------------------------------------------------------- FINAL PERSPECTIVE INTEGRATION

/**
 * A generic room-scale reference frame (4m wide x 3m tall — roughly a
 * typical interior wall's proportions) rather than anything derived from a
 * specific wall: Perspective is a free-standing construction workspace, not
 * tied to one wall's real dimensions the way an elevation is (spec section
 * 17 — "Perspective is a dedicated reference/drawing workspace", not an
 * automatic conversion of Plan/Elevation geometry).
 */
const PERSPECTIVE_FRAME_WIDTH_MM = 4000
const PERSPECTIVE_FRAME_HEIGHT_MM = 3000

function defaultPerspectiveSettings(): PerspectiveSettings {
  const horizonY = PERSPECTIVE_FRAME_HEIGHT_MM / 2
  return {
    type: '1-point',
    horizonY,
    vp1: { x: PERSPECTIVE_FRAME_WIDTH_MM / 2, y: horizonY },
    showGuides: true,
    guideDensity: 12,
    perspectiveSnap: true,
    viewpointX: 0,
    strength: 0.5,
  }
}

function createPerspectiveDocument(projectId: string, roomId: string, seedSettings?: CanvasSettings): CanvasDocument {
  const layers: CanvasLayer[] = [...DEFAULT_LAYERS, { name: PERSPECTIVE_REFERENCE_LAYER, visible: true, locked: false, order: DEFAULT_LAYERS.length }].map((l) => ({
    ...l,
    id: generateId('layer'),
  }))
  const archLayer = layers.find((l) => l.name === 'Architecture')?.id ?? layers[0].id
  const now = new Date().toISOString()
  return {
    id: generateId('canvas'),
    projectId,
    roomId,
    viewId: 'perspective',
    perspective: defaultPerspectiveSettings(),
    objects: [
      {
        id: generateId('obj'),
        type: 'rectangle',
        x: 0,
        y: 0,
        width: PERSPECTIVE_FRAME_WIDTH_MM,
        height: PERSPECTIVE_FRAME_HEIGHT_MM,
        rotation: 0,
        fillType: 'color',
        fill: '#f6f1ea',
        opacity: 1,
        strokeEnabled: true,
        stroke: '#948676',
        strokeWidth: 1,
        layerId: archLayer,
        locked: false,
        visible: true,
      },
    ],
    layers,
    activeLayerId: layers.find((l) => l.name === 'Furniture')?.id ?? layers[0].id,
    settings: defaultSettings({ ...seedSettings, viewMode: 'perspective' }),
    createdAt: now,
    updatedAt: now,
  }
}
