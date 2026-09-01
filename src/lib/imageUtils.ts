// Custom Image Fill (AURA CANVAS V2) — client-side downscale before storage.
//
// A photo straight off a phone camera can be several megabytes and thousands
// of pixels wide. We never want that going into localStorage (quota) or being
// decoded at full size on every frame (perf) just to fill a small canvas
// shape. So every image is downscaled + re-encoded once, right at import
// time, and only the small result is ever stored on the object or rendered.

const MAX_DIMENSION = 480
const JPEG_QUALITY = 0.82

/** Reads a File (from an <input type="file">) into a small, storable data URI. */
export function fileToDownscaledDataUrl(
  file: File,
  maxDim: number = MAX_DIMENSION,
  quality: number = JPEG_QUALITY,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      try {
        resolve(downscaleImageElement(img, maxDim, quality))
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Failed to downscale image'))
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not read the selected image'))
    }
    img.src = objectUrl
  })
}

function downscaleImageElement(img: HTMLImageElement, maxDim: number, quality: number): string {
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
  const width = Math.max(1, Math.round(img.naturalWidth * scale))
  const height = Math.max(1, Math.round(img.naturalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.drawImage(img, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', quality)
}

// Decoded-image cache keyed by data URI, so an image reused across many
// objects (or redrawn every animation frame) is only ever decoded once.
const imageElementCache = new Map<string, HTMLImageElement>()

/**
 * Synchronously returns a cached, already-loaded HTMLImageElement for a data
 * URI if one exists; otherwise kicks off a decode and returns undefined
 * (callers should just skip drawing this frame — the engine repaints once
 * the image is ready).
 */
export function getCachedImage(dataUrl: string): HTMLImageElement | undefined {
  const cached = imageElementCache.get(dataUrl)
  if (cached && cached.complete && cached.naturalWidth > 0) return cached
  if (cached) return undefined

  const img = new Image()
  imageElementCache.set(dataUrl, img)
  img.src = dataUrl
  return undefined
}

/** Lets the engine trigger a repaint once a requested image finishes decoding. */
export function onImageReady(dataUrl: string, callback: () => void): void {
  const img = imageElementCache.get(dataUrl)
  if (!img) return
  if (img.complete && img.naturalWidth > 0) {
    callback()
    return
  }
  img.addEventListener('load', callback, { once: true })
}
