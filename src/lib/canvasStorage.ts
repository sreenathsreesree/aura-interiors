import { generateId } from '@/lib/id'
import { createDemoCanvasObjects } from '@/lib/canvasDemo'
import type { CanvasDocument, CanvasElevationInfo, CanvasLayer, CanvasSettings } from '@/types/canvas'
import { DEFAULT_LAYERS } from '@/types/canvas'
import type { Room } from '@/types'

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
  return viewId === 'plan' ? `${STORAGE_PREFIX}${roomId}` : `${STORAGE_PREFIX}${roomId}:${viewId}`
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
  const existing = loadRoomCanvas(roomId, viewId)
  if (existing) return existing
  const wallIndex = Number(viewId.replace('wall-', ''))
  const walls = computeRoomWalls(room)
  const elevation = walls.find((w) => w.wallIndex === wallIndex) ?? walls[0]
  const planDoc = loadRoomCanvas(roomId, 'plan')
  return createElevationDocument(projectId, roomId, elevation, planDoc?.settings)
}
