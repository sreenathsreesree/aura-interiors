import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { IconButton } from './IconButton'

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  widthClassName?: string
}

// A panel that behaves as a bottom sheet on mobile and a centered dialog on
// larger (tablet) viewports — the same component serves both breakpoints.
export function Sheet({ open, onClose, title, subtitle, children, footer, widthClassName }: SheetProps) {
  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-ink-950/45 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative z-10 flex max-h-[92vh] w-full flex-col rounded-t-[--radius-2xl] bg-white shadow-[--shadow-float] sm:max-h-[85vh] sm:max-w-lg sm:rounded-[--radius-xl]',
          widthClassName,
        )}
      >
        <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-ink-200 sm:hidden" />
        <div className="flex shrink-0 items-start justify-between gap-4 px-6 pb-4 pt-4 sm:pt-6">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
          </div>
          <IconButton label="Close" variant="ghost" onClick={onClose} className="mt-0.5">
            <X className="h-5 w-5" />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-4">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-ink-100 px-6 py-4">{footer}</div>
        )}
      </div>
    </div>
  )
}
