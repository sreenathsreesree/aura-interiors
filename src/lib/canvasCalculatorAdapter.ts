// AURA CANVAS -> CALCULATOR INTEGRATION — the one place a Canvas object's
// geometry becomes a calculator's own input shape. Neither Canvas nor
// Interior Tools components hard-code the other's field names; they both
// go through this adapter (per the milestone's "reusable adapter/service"
// requirement) so future calculators or Canvas object types can be added
// here without scattering `if (calculatorId === 'paint')`-style logic
// through Canvas UI, or Canvas-shape logic through calculator components.
//
// Pure functions only, no React, no Canvas engine — reads a CanvasObject's
// own stored fields exactly as PropertyPanel already does for its Width/
// Height/Length displays, so a measurement here always matches what the
// designer sees selected on the canvas.

import type { CanvasObject } from '@/types/canvas'
import type { CalculatorId } from '@/features/tools/types'

export type CanvasMeasurementKind = 'rectangle' | 'length' | 'circle'

export interface CanvasMeasurement {
  kind: CanvasMeasurementKind
  objectId: string
  /**
   * Rectangle: the object's own width (mm). Length (line/dimension): the
   * segment's true length (mm). Circle: circumference (mm) — a real,
   * measured quantity (never invented) useful for trim/edging Running Feet.
   */
  lengthMm: number
  /** Rectangle only — the object's own height (mm). */
  widthMm?: number
  /** Circle only. */
  diameterMm?: number
  /** Rectangle and circle. */
  areaMm2?: number
}

const RECTANGLE_TYPES = new Set(['rectangle', 'square'])

/**
 * Extracts a usable real-world measurement from a Canvas object, or null
 * when this object type has no measurement a calculator can use (text,
 * free-draw, pen paths, polygons, etc. are deliberately out of scope for
 * this milestone — see the integration spec's explicit type list).
 */
export function extractCanvasMeasurement(object: CanvasObject): CanvasMeasurement | null {
  if (RECTANGLE_TYPES.has(object.type)) {
    const lengthMm = Math.max(0, object.width)
    const widthMm = Math.max(0, object.height)
    if (lengthMm <= 0 || widthMm <= 0) return null
    return { kind: 'rectangle', objectId: object.id, lengthMm, widthMm, areaMm2: lengthMm * widthMm }
  }
  if (object.type === 'dimension') {
    const lengthMm = Math.max(0, object.dimensionValue ?? 0)
    if (lengthMm <= 0) return null
    return { kind: 'length', objectId: object.id, lengthMm }
  }
  if (object.type === 'line' && object.points && object.points.length >= 2) {
    // A line's stored width/height are the dx/dy of its two points (see
    // CanvasEngine's line-creation code) — real length is their hypotenuse,
    // unaffected by the object's own `rotation` (which only changes how it
    // renders, never the stored width/height).
    const lengthMm = Math.hypot(object.width, object.height)
    if (lengthMm <= 0) return null
    return { kind: 'length', objectId: object.id, lengthMm }
  }
  if (object.type === 'circle') {
    // width/height are equal (a diameter-sized bounding box) for every
    // circle this app creates; averaging is a harmless safeguard if one was
    // ever resized non-uniformly, not an invented measurement.
    const diameterMm = Math.max(0, (object.width + object.height) / 2)
    if (diameterMm <= 0) return null
    const radiusMm = diameterMm / 2
    return { kind: 'circle', objectId: object.id, lengthMm: Math.PI * diameterMm, diameterMm, areaMm2: Math.PI * radiusMm * radiusMm }
  }
  return null
}

/** Which of the 5 active calculators can meaningfully use each measurement kind. */
export const CANVAS_COMPATIBLE_CALCULATORS: Record<CanvasMeasurementKind, CalculatorId[]> = {
  rectangle: ['area', 'paint', 'flooring', 'false-ceiling'],
  // A circle's circumference is a real length (edging/trim), but none of
  // the 5 active calculators compute true circular area — routing a circle
  // into the rectangular Area Calculator's Length x Width would silently
  // report the bounding square's area, not the circle's, so that pairing
  // is deliberately left out rather than producing a wrong number.
  length: ['running-feet'],
  circle: ['running-feet'],
}

export function getCompatibleCalculatorIds(measurement: CanvasMeasurement): CalculatorId[] {
  return CANVAS_COMPATIBLE_CALCULATORS[measurement.kind]
}

/**
 * Maps a measurement onto one calculator's own Inputs field names. Returns
 * null when the pairing isn't supported (kept in sync with
 * CANVAS_COMPATIBLE_CALCULATORS above).
 */
export function buildCalculatorPrefillInputs(calculatorId: CalculatorId, measurement: CanvasMeasurement): Record<string, number> | null {
  switch (calculatorId) {
    case 'area':
      return measurement.kind === 'rectangle' ? { lengthMm: measurement.lengthMm, widthMm: measurement.widthMm ?? 0 } : null
    case 'paint':
      return measurement.kind === 'rectangle' ? { wallLengthMm: measurement.lengthMm, wallHeightMm: measurement.widthMm ?? 0 } : null
    case 'flooring':
      return measurement.kind === 'rectangle' ? { roomLengthMm: measurement.lengthMm, roomWidthMm: measurement.widthMm ?? 0 } : null
    case 'false-ceiling':
      return measurement.kind === 'rectangle' ? { lengthMm: measurement.lengthMm, widthMm: measurement.widthMm ?? 0 } : null
    case 'running-feet':
      return measurement.kind === 'length' || measurement.kind === 'circle' ? { lengthMm: measurement.lengthMm } : null
    default:
      return null
  }
}
