import type { Material } from '@/types/materials'

// Procedurally generates a small, seamless-enough tile canvas per material —
// used both as the CanvasPattern source for an actual fill (lib/canvasEngine
// tiles + transforms it) and, at CSS-scaled-down size, as the material's own
// browser thumbnail. Nothing here is random per render: each material's
// pattern is seeded from its own id, so it looks identical every time it's
// drawn, cached, reloaded, or thumbnailed.

const TILE_SIZE = 128

function hashSeed(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Deterministic PRNG (mulberry32) — same material id always produces the same texture. */
function makeRng(seed: number) {
  let a = seed
  return function rng() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function withAlpha(hex: string, alpha: number): string {
  if (!/^#([0-9a-f]{6})$/i.test(hex)) return hex
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function drawWood(ctx: CanvasRenderingContext2D, base: string, accent: string, rng: () => number) {
  ctx.fillStyle = base
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE)
  for (let y = -10; y < TILE_SIZE + 10; y += 7 + rng() * 5) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    for (let x = 0; x <= TILE_SIZE; x += 16) {
      ctx.lineTo(x, y + Math.sin((x / TILE_SIZE) * Math.PI * 2 + y) * 4)
    }
    ctx.strokeStyle = withAlpha(accent, 0.18 + rng() * 0.2)
    ctx.lineWidth = 1 + rng() * 1.5
    ctx.stroke()
  }
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.ellipse(rng() * TILE_SIZE, rng() * TILE_SIZE, 3 + rng() * 3, 6 + rng() * 5, rng() * Math.PI, 0, Math.PI * 2)
    ctx.fillStyle = withAlpha(accent, 0.25)
    ctx.fill()
  }
}

function drawLaminate(ctx: CanvasRenderingContext2D, base: string, accent: string, rng: () => number) {
  ctx.fillStyle = base
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE)
  const grad = ctx.createLinearGradient(0, 0, TILE_SIZE, TILE_SIZE)
  grad.addColorStop(0, withAlpha('#ffffff', 0.1))
  grad.addColorStop(0.5, withAlpha('#ffffff', 0))
  grad.addColorStop(1, withAlpha('#000000', 0.05))
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE)
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = withAlpha(accent, 0.04 + rng() * 0.05)
    ctx.fillRect(rng() * TILE_SIZE, rng() * TILE_SIZE, 1, 1)
  }
}

function drawMarble(ctx: CanvasRenderingContext2D, base: string, accent: string, rng: () => number) {
  ctx.fillStyle = base
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE)
  for (let i = 0; i < 5; i++) {
    const startX = rng() * TILE_SIZE
    const startY = rng() * TILE_SIZE
    ctx.beginPath()
    ctx.moveTo(startX, startY)
    ctx.bezierCurveTo(
      rng() * TILE_SIZE,
      rng() * TILE_SIZE,
      rng() * TILE_SIZE,
      rng() * TILE_SIZE,
      rng() * TILE_SIZE,
      rng() * TILE_SIZE,
    )
    ctx.strokeStyle = withAlpha(accent, 0.2 + rng() * 0.25)
    ctx.lineWidth = 0.6 + rng() * 1.8
    ctx.stroke()
  }
}

function drawSpeckle(ctx: CanvasRenderingContext2D, base: string, accent: string, rng: () => number, count: number) {
  ctx.fillStyle = base
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE)
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = withAlpha(accent, 0.15 + rng() * 0.5)
    const size = 0.6 + rng() * 2.2
    ctx.fillRect(rng() * TILE_SIZE, rng() * TILE_SIZE, size, size)
  }
}

function drawGlass(ctx: CanvasRenderingContext2D, base: string, accent: string) {
  const grad = ctx.createLinearGradient(0, 0, TILE_SIZE, TILE_SIZE)
  grad.addColorStop(0, withAlpha(base, 0.55))
  grad.addColorStop(1, withAlpha(accent, 0.35))
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE)
  ctx.strokeStyle = withAlpha('#ffffff', 0.5)
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.moveTo(-10, TILE_SIZE * 0.25)
  ctx.lineTo(TILE_SIZE * 0.75, -10)
  ctx.moveTo(TILE_SIZE * 0.4, TILE_SIZE + 10)
  ctx.lineTo(TILE_SIZE + 10, TILE_SIZE * 0.6)
  ctx.stroke()
}

function drawFabric(ctx: CanvasRenderingContext2D, base: string, accent: string) {
  ctx.fillStyle = base
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE)
  ctx.strokeStyle = withAlpha(accent, 0.35)
  ctx.lineWidth = 1
  const step = 6
  for (let i = -TILE_SIZE; i < TILE_SIZE * 2; i += step) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i + TILE_SIZE, TILE_SIZE)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(i, TILE_SIZE)
    ctx.lineTo(i + TILE_SIZE, 0)
    ctx.stroke()
  }
}

function drawWallpaper(ctx: CanvasRenderingContext2D, base: string, accent: string) {
  ctx.fillStyle = base
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE)
  const step = 32
  for (let y = 0; y <= TILE_SIZE; y += step) {
    for (let x = 0; x <= TILE_SIZE; x += step) {
      ctx.save()
      ctx.translate(x + step / 2, y + step / 2)
      ctx.rotate(Math.PI / 4)
      ctx.fillStyle = withAlpha(accent, 0.5)
      ctx.fillRect(-5, -5, 10, 10)
      ctx.restore()
    }
  }
}

function drawFlooring(ctx: CanvasRenderingContext2D, base: string, accent: string, rng: () => number) {
  ctx.fillStyle = base
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE)
  const plankHeight = TILE_SIZE / 4
  for (let row = 0; row < 4; row++) {
    const offset = row % 2 === 0 ? 0 : TILE_SIZE / 2
    for (let col = -1; col < 3; col++) {
      const x = col * (TILE_SIZE / 2) + offset
      const tone = withAlpha('#000000', 0.03 + rng() * 0.05)
      ctx.fillStyle = tone
      ctx.fillRect(x + 1, row * plankHeight + 1, TILE_SIZE / 2 - 2, plankHeight - 2)
    }
  }
  ctx.strokeStyle = withAlpha(accent, 0.5)
  ctx.lineWidth = 1
  for (let row = 0; row <= 4; row++) {
    ctx.beginPath()
    ctx.moveTo(0, row * plankHeight)
    ctx.lineTo(TILE_SIZE, row * plankHeight)
    ctx.stroke()
  }
  for (let row = 0; row < 4; row++) {
    const offset = row % 2 === 0 ? 0 : TILE_SIZE / 2
    ctx.beginPath()
    ctx.moveTo(offset, row * plankHeight)
    ctx.lineTo(offset, (row + 1) * plankHeight)
    ctx.moveTo(offset + TILE_SIZE / 2, row * plankHeight)
    ctx.lineTo(offset + TILE_SIZE / 2, (row + 1) * plankHeight)
    ctx.stroke()
  }
}

const patternCache = new Map<string, HTMLCanvasElement>()

/** The material's tile canvas — generated once per material id, reused forever after. */
export function getMaterialPatternCanvas(material: Material): HTMLCanvasElement {
  const cached = patternCache.get(material.id)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = TILE_SIZE
  canvas.height = TILE_SIZE
  const ctx = canvas.getContext('2d')!
  const rng = makeRng(hashSeed(material.id))
  const base = material.baseColor
  const accent = material.accentColor ?? material.baseColor

  switch (material.category) {
    case 'colour':
      ctx.fillStyle = base
      ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE)
      break
    case 'wood':
      drawWood(ctx, base, accent, rng)
      break
    case 'laminate':
      drawLaminate(ctx, base, accent, rng)
      break
    case 'marble':
      drawMarble(ctx, base, accent, rng)
      break
    case 'granite':
      drawSpeckle(ctx, base, accent, rng, 900)
      break
    case 'stone':
      drawSpeckle(ctx, base, accent, rng, 260)
      break
    case 'glass':
      drawGlass(ctx, base, accent)
      break
    case 'fabric':
      drawFabric(ctx, base, accent)
      break
    case 'wallpaper':
      drawWallpaper(ctx, base, accent)
      break
    case 'flooring':
      drawFlooring(ctx, base, accent, rng)
      break
    default:
      drawSpeckle(ctx, base, accent, rng, 140)
  }

  patternCache.set(material.id, canvas)
  return canvas
}

const thumbnailCache = new Map<string, string>()

/** Data-URI thumbnail for the Material Panel grid — same generated tile, just read back as an image. */
export function getMaterialThumbnailDataUrl(material: Material): string {
  const cached = thumbnailCache.get(material.id)
  if (cached) return cached
  const url = getMaterialPatternCanvas(material).toDataURL('image/png')
  thumbnailCache.set(material.id, url)
  return url
}
