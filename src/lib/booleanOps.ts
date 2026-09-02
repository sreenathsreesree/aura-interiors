import type { Point } from '@/types/canvas'

export type BooleanOp = 'union' | 'subtract' | 'intersect' | 'exclude'

interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

const MAX_RASTER_PX = 900 // cap so a huge object never allocates a giant canvas

/**
 * Computes a Boolean operation between two shapes by rasterizing each to an
 * offscreen canvas, compositing with the browser's own alpha blending, then
 * vectorizing the result back into polygon loops (marching squares).
 *
 * Why raster instead of exact polygon clipping: this app's shapes include
 * curves (circles, arcs, Pen bézier paths) and the result of Subtract/
 * Exclude can have holes and disjoint pieces — handling all of that exactly
 * needs a real computational-geometry library. Compositing does it for
 * free via the canvas's own rasterizer, at the cost of the result being an
 * approximation at the chosen resolution rather than mathematically exact —
 * an intentional, documented trade-off for a "lightweight" implementation.
 *
 * `paintA`/`paintB` fill their shape's path (already positioned/rotated) in
 * the SAME coordinate space as `bounds` (world mm) — the caller reuses
 * whatever path-building logic already renders that object normally.
 * Returns closed polygon loops in that same world-mm space, or an empty
 * array if the operation produces nothing (e.g. Subtract with no overlap).
 */
export function computeBoolean(
  paintA: (ctx: CanvasRenderingContext2D) => void,
  paintB: (ctx: CanvasRenderingContext2D) => void,
  bounds: Bounds,
  op: BooleanOp,
): Point[][] {
  const w = Math.max(bounds.width, 1)
  const h = Math.max(bounds.height, 1)
  const scale = Math.min(4, MAX_RASTER_PX / Math.max(w, h), MAX_RASTER_PX)
  const pxW = Math.max(4, Math.round(w * scale))
  const pxH = Math.max(4, Math.round(h * scale))

  const canvas = document.createElement('canvas')
  canvas.width = pxW
  canvas.height = pxH
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return []

  ctx.setTransform(scale, 0, 0, scale, -bounds.x * scale, -bounds.y * scale)
  ctx.fillStyle = '#000'

  ctx.globalCompositeOperation = 'source-over'
  paintA(ctx)
  const compositeOp: GlobalCompositeOperation = op === 'union' ? 'source-over' : op === 'subtract' ? 'destination-out' : op === 'intersect' ? 'source-in' : 'xor'
  ctx.globalCompositeOperation = compositeOp
  paintB(ctx)
  ctx.globalCompositeOperation = 'source-over'

  const { data } = ctx.getImageData(0, 0, pxW, pxH)
  const alphaAt = (px: number, py: number): number => {
    if (px < 0 || py < 0 || px >= pxW || py >= pxH) return 0
    return data[(py * pxW + px) * 4 + 3]
  }
  const corner = (cx: number, cy: number): number => (alphaAt(cx, cy) > 127 ? 1 : 0)

  const loopsPx = traceMarchingSquares(pxW, pxH, corner)

  const toWorld = (p: Point): Point => ({ x: bounds.x + p.x / scale, y: bounds.y + p.y / scale })
  return loopsPx.map((loop) => simplifyLoop(loop.map(toWorld))).filter((loop) => loop.length >= 3)
}

type SegPoint = { x: number; y: number }
type Segment = [SegPoint, SegPoint]

function key(p: SegPoint): string {
  return `${p.x}|${p.y}`
}

function traceMarchingSquares(pxW: number, pxH: number, corner: (x: number, y: number) => number): SegPoint[][] {
  const segments: Segment[] = []
  for (let y = 0; y < pxH; y++) {
    for (let x = 0; x < pxW; x++) {
      const tl = corner(x, y)
      const tr = corner(x + 1, y)
      const br = corner(x + 1, y + 1)
      const bl = corner(x, y + 1)
      const c = tl * 8 + tr * 4 + br * 2 + bl * 1
      if (c === 0 || c === 15) continue
      const T: SegPoint = { x: x + 0.5, y }
      const R: SegPoint = { x: x + 1, y: y + 0.5 }
      const B: SegPoint = { x: x + 0.5, y: y + 1 }
      const L: SegPoint = { x, y: y + 0.5 }
      const push = (a: SegPoint, b: SegPoint) => segments.push([a, b])
      switch (c) {
        case 1:
          push(L, B)
          break
        case 2:
          push(B, R)
          break
        case 3:
          push(L, R)
          break
        case 4:
          push(T, R)
          break
        case 5:
          push(T, L)
          push(R, B)
          break
        case 6:
          push(T, B)
          break
        case 7:
          push(T, L)
          break
        case 8:
          push(T, L)
          break
        case 9:
          push(T, B)
          break
        case 10:
          push(T, R)
          push(L, B)
          break
        case 11:
          push(T, R)
          break
        case 12:
          push(L, R)
          break
        case 13:
          push(B, R)
          break
        case 14:
          push(L, B)
          break
      }
    }
  }

  // Link segments sharing an endpoint into closed loops. Each interior
  // marching-squares point has exactly two segment-ends touching it (its
  // own small-scale ambiguity aside), so a simple adjacency walk suffices.
  const adjacency = new Map<string, SegPoint[]>()
  const addAdj = (from: SegPoint, to: SegPoint) => {
    const k = key(from)
    const list = adjacency.get(k)
    if (list) list.push(to)
    else adjacency.set(k, [to])
  }
  for (const [a, b] of segments) {
    addAdj(a, b)
    addAdj(b, a)
  }

  const visitedEdges = new Set<string>()
  const edgeKey = (a: SegPoint, b: SegPoint) => (key(a) < key(b) ? `${key(a)}~${key(b)}` : `${key(b)}~${key(a)}`)

  const loops: SegPoint[][] = []
  for (const [a0, b0] of segments) {
    if (visitedEdges.has(edgeKey(a0, b0))) continue
    const loop: SegPoint[] = [a0]
    let prev = a0
    let cur = b0
    visitedEdges.add(edgeKey(a0, b0))
    let guard = 0
    while (guard++ < 200000) {
      loop.push(cur)
      if (key(cur) === key(a0)) break
      const options = adjacency.get(key(cur)) ?? []
      const next = options.find((o) => !visitedEdges.has(edgeKey(cur, o)) && key(o) !== key(prev)) ?? options.find((o) => !visitedEdges.has(edgeKey(cur, o)))
      if (!next) break
      visitedEdges.add(edgeKey(cur, next))
      prev = cur
      cur = next
    }
    if (loop.length >= 4 && key(loop[0]) === key(loop[loop.length - 1])) loops.push(loop.slice(0, -1))
  }
  return loops
}

/** Collapses runs of near-collinear points so a traced contour doesn't carry thousands of redundant vertices. */
function simplifyLoop(points: Point[]): Point[] {
  if (points.length < 3) return points
  const out: Point[] = []
  for (let i = 0; i < points.length; i++) {
    const prev = out[out.length - 1] ?? points[points.length - 1]
    const cur = points[i]
    const next = points[(i + 1) % points.length]
    const dx1 = cur.x - prev.x
    const dy1 = cur.y - prev.y
    const dx2 = next.x - cur.x
    const dy2 = next.y - cur.y
    const cross = dx1 * dy2 - dy1 * dx2
    const len1 = Math.hypot(dx1, dy1)
    const len2 = Math.hypot(dx2, dy2)
    if (len1 > 1e-6 && len2 > 1e-6 && Math.abs(cross) / (len1 * len2) < 0.02) continue // near-collinear, skip
    out.push(cur)
  }
  return out.length >= 3 ? out : points
}
