import { useEffect } from 'react'
import { ChevronLeft, ChevronRight, ImageOff, X } from 'lucide-react'
import { IconButton } from '@/components/ui'

export interface MediaLightboxItem {
  id: string
  /** Undefined/empty means the image can't be shown (e.g. an unreachable Drive reference). */
  src?: string
  title: string
  subtitle?: string
}

interface MediaLightboxProps {
  items: MediaLightboxItem[]
  index: number
  onClose: () => void
  onIndexChange: (index: number) => void
}

// A simple full-screen viewer: fit-to-screen image, close, next/previous.
// Not an image editor — no crop/zoom/rotate, per spec.
export function MediaLightbox({ items, index, onClose, onIndexChange }: MediaLightboxProps) {
  const item = items[index]
  const hasMultiple = items.length > 1

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft' && hasMultiple) {
        onIndexChange((index - 1 + items.length) % items.length)
      }
      if (event.key === 'ArrowRight' && hasMultiple) {
        onIndexChange((index + 1) % items.length)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [hasMultiple, index, items.length, onClose, onIndexChange])

  if (!item) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
      className="fixed inset-0 z-50 flex flex-col bg-ink-950/95"
    >
      <div className="flex shrink-0 items-start justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="min-w-0 text-sand-50">
          <p className="truncate text-sm font-semibold">{item.title}</p>
          {item.subtitle && <p className="truncate text-xs text-sand-200/70">{item.subtitle}</p>}
        </div>
        <IconButton label="Close" variant="ghost" onClick={onClose} className="text-sand-50 hover:bg-white/10">
          <X className="h-5 w-5" />
        </IconButton>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-4 pb-6 sm:px-8">
        {hasMultiple && (
          <IconButton
            label="Previous image"
            variant="ghost"
            size="lg"
            onClick={() => onIndexChange((index - 1 + items.length) % items.length)}
            className="absolute left-2 text-sand-50 hover:bg-white/10 sm:left-4"
          >
            <ChevronLeft className="h-6 w-6" />
          </IconButton>
        )}

        {item.src ? (
          <img
            src={item.src}
            alt={item.title}
            className="max-h-[80vh] max-w-full rounded-[--radius-md] object-contain shadow-[--shadow-float]"
          />
        ) : (
          <div className="flex h-64 w-full max-w-md flex-col items-center justify-center gap-3 rounded-[--radius-lg] border-2 border-dashed border-sand-50/20 text-sand-200/80">
            <ImageOff className="h-10 w-10" />
            <p className="text-sm font-medium">Reference unavailable</p>
          </div>
        )}

        {hasMultiple && (
          <IconButton
            label="Next image"
            variant="ghost"
            size="lg"
            onClick={() => onIndexChange((index + 1) % items.length)}
            className="absolute right-2 text-sand-50 hover:bg-white/10 sm:right-4"
          >
            <ChevronRight className="h-6 w-6" />
          </IconButton>
        )}
      </div>

      {hasMultiple && (
        <div className="shrink-0 pb-5 text-center text-xs font-medium text-sand-200/70">
          {index + 1} / {items.length}
        </div>
      )}
    </div>
  )
}
