import { useState } from 'react'
import type { ReactNode } from 'react'
import { ImageOff, Trash2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { IconButton } from '@/components/ui'

interface MediaCardProps {
  imageSrc?: string
  title: string
  subtitle?: string
  badge?: ReactNode
  onClick?: () => void
  onDelete?: () => void
  deleteLabel?: string
}

// Thumbnail grid card shared by Site Photos and References. Handles a broken
// or missing image (a Drive thumbnail that expired or never loaded) with a
// distinct "Reference unavailable" state rather than a browser broken-image icon.
export function MediaCard({
  imageSrc,
  title,
  subtitle,
  badge,
  onClick,
  onDelete,
  deleteLabel = 'Delete',
}: MediaCardProps) {
  const [broken, setBroken] = useState(false)
  const showFallback = !imageSrc || broken

  return (
    <div className="group relative aspect-square overflow-hidden rounded-[--radius-lg] border border-ink-100 bg-sand-100">
      <button
        type="button"
        onClick={onClick}
        className="block h-full w-full text-left"
        disabled={!onClick}
      >
        {showFallback ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-ink-400">
            <ImageOff className="h-7 w-7" />
            <span className="px-3 text-center text-[11px] font-medium leading-tight text-ink-400">
              Reference unavailable
            </span>
          </div>
        ) : (
          <img
            src={imageSrc}
            alt={title}
            onError={() => setBroken(true)}
            className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-[1.03]"
          />
        )}

        {!showFallback && (subtitle || badge) && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-ink-950/70 to-transparent px-2.5 py-2">
            {subtitle && <span className="truncate text-[11px] font-medium text-sand-50">{subtitle}</span>}
            {badge}
          </div>
        )}
      </button>

      {onDelete && (
        <IconButton
          label={deleteLabel}
          variant="danger"
          size="sm"
          onClick={(event) => {
            event.stopPropagation()
            onDelete()
          }}
          className={cn(
            'absolute right-2 top-2 bg-white/90 opacity-0 shadow-[--shadow-soft] backdrop-blur transition-opacity group-hover:opacity-100 focus-visible:opacity-100 sm:opacity-0',
            'max-sm:opacity-100',
          )}
        >
          <Trash2 className="h-4 w-4" />
        </IconButton>
      )}
    </div>
  )
}
