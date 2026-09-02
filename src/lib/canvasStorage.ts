import { generateId } from '@/lib/id'
import { createDemoCanvasObjects } from '@/lib/canvasDemo'
import type { CanvasDocument, CanvasLayer } from '@/types/canvas'
import { DEFAULT_LAYERS } from '@/types/canvas'

const STORAGE_PREFIX = 'aura-canvas:'

function storageKey(roomId: string): string {
  return `${STORAGE_PREFIX}${roomId}`
}

export function loadRoomCanvas(roomId: string): CanvasDocument | null {
  try {
    const raw = window.localStorage.getItem(storageKey(roomId))
    if (!raw) return null
    return JSON.parse(raw) as CanvasDocument
  } catch {
    return null
  }
}

export function saveRoomCanvas(doc: CanvasDocument): void {
  try {
    window.localStorage.setItem(storageKey(doc.roomId), JSON.stringify(doc))
  } catch {
    // Storage can fail (private browsing, quota) — saving is best-effort for this phase.
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
    objects: createDemoCanvasObjects(roomLengthFt, roomWidthFt, layers),
    layers,
    activeLayerId: layers.find((l) => l.name === 'Furniture')?.id ?? layers[0].id,
    settings: {
      gridSize: 100,
      showGrid: true,
      snapToGrid: true,
      ortho: false,
      unit: 'mm',
      viewMode: 'plan',
      showDimensions: true,
    },
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
  return loadRoomCanvas(roomId) ?? createFreshCanvasDocument(projectId, roomId, roomLengthFt, roomWidthFt)
}
