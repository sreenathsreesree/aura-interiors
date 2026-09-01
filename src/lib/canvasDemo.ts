import { generateId } from '@/lib/id'
import type { CanvasLayer, CanvasObject } from '@/types/canvas'

const FT_TO_MM = 304.8
const WALL_THICKNESS = 100

function layerId(layers: CanvasLayer[], name: string): string {
  return layers.find((l) => l.name === name)?.id ?? layers[0].id
}

function makeObject(partial: Partial<CanvasObject> & Pick<CanvasObject, 'type' | 'x' | 'y' | 'width' | 'height' | 'layerId'>): CanvasObject {
  return {
    id: generateId('obj'),
    rotation: 0,
    fillType: 'color',
    fill: '#d6cbb8',
    opacity: 1,
    strokeEnabled: true,
    stroke: '#453e36',
    strokeWidth: 2,
    locked: false,
    visible: true,
    ...partial,
  }
}

/**
 * Realistic-looking starter content so a first-time Canvas doesn't open
 * empty: the room's own outline (from its real Room Builder dimensions),
 * perimeter walls, a door, a window, a couple of cabinet blocks, and two
 * overall dimensions. Demo/sample data only — not a real drafting output.
 */
export function createDemoCanvasObjects(roomLengthFt: number, roomWidthFt: number, layers: CanvasLayer[]): CanvasObject[] {
  const length = Math.max(roomLengthFt, 8) * FT_TO_MM
  const width = Math.max(roomWidthFt, 8) * FT_TO_MM
  const objects: CanvasObject[] = []

  const archLayer = layerId(layers, 'Architecture')
  const wallLayer = layerId(layers, 'Walls')
  const cabinetLayer = layerId(layers, 'Cabinetry')
  const dimLayer = layerId(layers, 'Dimensions')

  // Room floor
  objects.push(
    makeObject({
      type: 'rectangle',
      x: 0,
      y: 0,
      width: length,
      height: width,
      layerId: archLayer,
      fill: '#f6f1ea',
      stroke: '#948676',
      strokeWidth: 1,
    }),
  )

  // Perimeter walls (four thin rectangles)
  objects.push(
    makeObject({ type: 'rectangle', x: -WALL_THICKNESS, y: -WALL_THICKNESS, width: length + WALL_THICKNESS * 2, height: WALL_THICKNESS, layerId: wallLayer, fill: '#5c5348', strokeEnabled: false }),
    makeObject({ type: 'rectangle', x: -WALL_THICKNESS, y: width, width: length + WALL_THICKNESS * 2, height: WALL_THICKNESS, layerId: wallLayer, fill: '#5c5348', strokeEnabled: false }),
    makeObject({ type: 'rectangle', x: -WALL_THICKNESS, y: -WALL_THICKNESS, width: WALL_THICKNESS, height: width + WALL_THICKNESS * 2, layerId: wallLayer, fill: '#5c5348', strokeEnabled: false }),
    makeObject({ type: 'rectangle', x: length, y: -WALL_THICKNESS, width: WALL_THICKNESS, height: width + WALL_THICKNESS * 2, layerId: wallLayer, fill: '#5c5348', strokeEnabled: false }),
  )

  // Door on the bottom wall, with a quarter-circle swing arc
  const doorWidth = 900
  const doorX = length * 0.15
  objects.push(
    makeObject({
      type: 'rectangle',
      x: doorX,
      y: width - 6,
      width: doorWidth,
      height: WALL_THICKNESS + 12,
      layerId: archLayer,
      fill: '#fbf9f6',
      stroke: '#b5893f',
      strokeWidth: 2,
    }),
  )
  const doorArc = makeObject({
    type: 'arc',
    x: doorX,
    y: width - doorWidth,
    width: doorWidth,
    height: doorWidth,
    layerId: archLayer,
    fill: 'none',
    stroke: '#b5893f',
    strokeWidth: 1.5,
    arcBulge: 0.414, // ~90° sweep
  })
  doorArc.points = [
    { x: 0, y: doorWidth },
    { x: doorWidth, y: doorWidth },
  ]
  objects.push(doorArc)

  // Window on the left wall
  const windowHeight = 1200
  objects.push(
    makeObject({
      type: 'rectangle',
      x: -WALL_THICKNESS,
      y: width * 0.3,
      width: WALL_THICKNESS,
      height: windowHeight,
      layerId: archLayer,
      fill: '#a9c6d8',
      stroke: '#5c5348',
      strokeWidth: 1,
    }),
  )

  // A few cabinet blocks along the top wall
  const cabinetDepth = 600
  const cabinetWidth = Math.min(900, length / 3.4)
  for (let i = 0; i < 3; i++) {
    objects.push(
      makeObject({
        type: 'rectangle',
        x: length * 0.55 + i * (cabinetWidth + 20),
        y: 0,
        width: cabinetWidth,
        height: cabinetDepth,
        layerId: cabinetLayer,
        fill: '#e0d3bd',
        stroke: '#785828',
        strokeWidth: 1.5,
      }),
    )
  }

  // Overall dimensions along two edges
  const lengthDim = makeObject({
    type: 'dimension',
    x: 0,
    y: width + 220,
    width: length,
    height: 1,
    layerId: dimLayer,
    stroke: '#221f1b',
    strokeWidth: 1.5,
  })
  lengthDim.points = [
    { x: 0, y: 0 },
    { x: length, y: 0 },
  ]
  lengthDim.dimensionValue = length
  objects.push(lengthDim)

  const widthDim = makeObject({
    type: 'dimension',
    x: length + 220,
    y: 0,
    width: 1,
    height: width,
    layerId: dimLayer,
    stroke: '#221f1b',
    strokeWidth: 1.5,
  })
  widthDim.points = [
    { x: 0, y: 0 },
    { x: 0, y: width },
  ]
  widthDim.dimensionValue = width
  objects.push(widthDim)

  return objects
}
