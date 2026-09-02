import type { CanvasObject, Point } from '@/types/canvas'

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export function rotatePoint(pt: Point, center: Point, degrees: number): Point {
  if (degrees === 0) return pt
  const rad = degToRad(degrees)
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = pt.x - center.x
  const dy = pt.y - center.y
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  }
}

export function objectCenter(obj: Pick<CanvasObject, 'x' | 'y' | 'width' | 'height'>): Point {
  return { x: obj.x + obj.width / 2, y: obj.y + obj.height / 2 }
}

/** The four bbox corners rotated around the object's centre, in document space. */
export function rotatedCorners(obj: Pick<CanvasObject, 'x' | 'y' | 'width' | 'height' | 'rotation'>): Point[] {
  const center = objectCenter(obj)
  const corners: Point[] = [
    { x: obj.x, y: obj.y },
    { x: obj.x + obj.width, y: obj.y },
    { x: obj.x + obj.width, y: obj.y + obj.height },
    { x: obj.x, y: obj.y + obj.height },
  ]
  return corners.map((c) => rotatePoint(c, center, obj.rotation))
}

export function boundsOfPoints(points: Point[]): { x: number; y: number; width: number; height: number } {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/** Point-in-rectangle test that accounts for the object's own rotation. */
export function pointInRotatedRect(
  pt: Point,
  obj: Pick<CanvasObject, 'x' | 'y' | 'width' | 'height' | 'rotation'>,
  padding = 0,
): boolean {
  const center = objectCenter(obj)
  const local = rotatePoint(pt, center, -obj.rotation)
  return (
    local.x >= obj.x - padding &&
    local.x <= obj.x + obj.width + padding &&
    local.y >= obj.y - padding &&
    local.y <= obj.y + obj.height + padding
  )
}

export function pointInCircle(pt: Point, obj: Pick<CanvasObject, 'x' | 'y' | 'width' | 'height'>, padding = 0): boolean {
  const center = objectCenter(obj)
  const radius = Math.max(obj.width, obj.height) / 2
  const dx = pt.x - center.x
  const dy = pt.y - center.y
  return Math.sqrt(dx * dx + dy * dy) <= radius + padding
}

export function distanceToSegment(pt: Point, a: Point, b: Point): number {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const lengthSq = abx * abx + aby * aby
  if (lengthSq === 0) return Math.hypot(pt.x - a.x, pt.y - a.y)
  let t = ((pt.x - a.x) * abx + (pt.y - a.y) * aby) / lengthSq
  t = Math.max(0, Math.min(1, t))
  const projX = a.x + t * abx
  const projY = a.y + t * aby
  return Math.hypot(pt.x - projX, pt.y - projY)
}

export function distanceToPolyline(pt: Point, points: Point[], closed = false): number {
  if (points.length === 0) return Infinity
  if (points.length === 1) return Math.hypot(pt.x - points[0].x, pt.y - points[0].y)
  let min = Infinity
  for (let i = 0; i < points.length - 1; i++) {
    min = Math.min(min, distanceToSegment(pt, points[i], points[i + 1]))
  }
  if (closed) {
    min = Math.min(min, distanceToSegment(pt, points[points.length - 1], points[0]))
  }
  return min
}

/** Standard ray-casting point-in-polygon test (local/world-agnostic — points and pt must share a frame). */
export function pointInPolygon(pt: Point, points: Point[]): boolean {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x
    const yi = points[i].y
    const xj = points[j].x
    const yj = points[j].y
    const intersects = yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

export function snapValue(value: number, gridSize: number): number {
  if (gridSize <= 0) return value
  return Math.round(value / gridSize) * gridSize
}

export function snapPoint(pt: Point, gridSize: number): Point {
  return { x: snapValue(pt.x, gridSize), y: snapValue(pt.y, gridSize) }
}

/** Constrains `pt` so the segment from `origin` is horizontal, vertical, or 45°. */
export function orthoConstrain(origin: Point, pt: Point): Point {
  const dx = pt.x - origin.x
  const dy = pt.y - origin.y
  const angle = Math.atan2(dy, dx)
  const step = Math.PI / 4
  const snappedAngle = Math.round(angle / step) * step
  const length = Math.hypot(dx, dy)
  return {
    x: origin.x + Math.cos(snappedAngle) * length,
    y: origin.y + Math.sin(snappedAngle) * length,
  }
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/**
 * AURA CANVAS V3A — smart snap/alignment candidates for an object: its
 * axis-aligned bounding-box edges and centre, in world (document) space.
 * Used to snap a moving object's edges/centre to another object's, and to
 * draw the matching alignment guide line. Deliberately collapses the many
 * spec-listed concepts (edges/endpoints/centers/midpoints) onto these six
 * values — for an axis-aligned bbox, "midpoint of the left edge" and "left
 * edge" are the same x, so this covers the practically useful cases without
 * a separate per-edge-midpoint model.
 */
export function objectSnapPoints(obj: Pick<CanvasObject, 'x' | 'y' | 'width' | 'height' | 'rotation'>): { xs: number[]; ys: number[] } {
  const corners = rotatedCorners(obj)
  const xs = corners.map((c) => c.x)
  const ys = corners.map((c) => c.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const center = objectCenter(obj)
  return { xs: [minX, maxX, center.x], ys: [minY, maxY, center.y] }
}

/**
 * Converts a 2-point + bulge arc (DXF-style: bulge = tan(includedAngle/4))
 * into an SVG/Canvas-friendly {center, radius, startAngle, endAngle, ccw}.
 * bulge 0 degrades to a straight segment.
 */
export function arcFromBulge(p1: Point, p2: Point, bulge: number) {
  const chord = distance(p1, p2)
  if (chord === 0 || Math.abs(bulge) < 1e-6) return null
  const includedAngle = 4 * Math.atan(bulge)
  const radius = chord / (2 * Math.sin(includedAngle / 2))
  const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
  const dirX = (p2.x - p1.x) / chord
  const dirY = (p2.y - p1.y) / chord
  // perpendicular offset from chord midpoint to the arc's centre
  const sagitta = radius - Math.sqrt(Math.max(radius * radius - (chord / 2) ** 2, 0))
  const offset = radius - sagitta
  const sign = bulge > 0 ? 1 : -1
  const perpX = -dirY * sign
  const perpY = dirX * sign
  const center = { x: mid.x + perpX * offset, y: mid.y + perpY * offset }
  const startAngle = Math.atan2(p1.y - center.y, p1.x - center.x)
  const endAngle = Math.atan2(p2.y - center.y, p2.x - center.x)
  return { center, radius: Math.abs(radius), startAngle, endAngle, ccw: bulge < 0 }
}
