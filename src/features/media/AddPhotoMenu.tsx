import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { IconButton } from '@/components/ui'

export interface AddPhotoMenuOption {
  key: string
  label: string
  description: string
  icon: ReactNode
  onSelect: () => void
}

interface AddPhotoMenuProps {
  options: AddPhotoMenuOption[]
  triggerLabel: string
}

// A small action-sheet popover behind the "+" button — e.g. "Camera / Photo
// Library" for Site Photos, or "Upload from device / Upload from Google
// Drive" for References. Purely presentational: each option carries its own
// onSelect, so the caller owns what actually happens (opening a file input,
// launching the Drive picker, etc).
export function AddPhotoMenu({ options, triggerLabel }: AddPhotoMenuProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <IconButton
        label={triggerLabel}
        variant="filled"
        size="lg"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <Plus className="h-5 w-5" />
      </IconButton>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-64 overflow-hidden rounded-[--radius-lg] border border-ink-100 bg-white py-1.5 shadow-[--shadow-float]"
        >
          {options.map((option) => (
            <button
              key={option.key}
              role="menuitem"
              onClick={() => {
                setOpen(false)
                option.onSelect()
              }}
              className={cn(
                'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-sand-100',
              )}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[--radius-md] bg-brass-500/12 text-brass-600">
                {option.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink-900">{option.label}</span>
                <span className="block truncate text-xs text-ink-500">{option.description}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
