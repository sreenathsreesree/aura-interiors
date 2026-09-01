import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

interface AnchoredPopoverProps {
  /** The trigger element this popover opens next to. */
  anchorRef: RefObject<HTMLElement | null>
  onClose: () => void
  children: ReactNode
  /** Which side of the anchor to prefer opening on — clamped to the viewport either way. */
  side?: 'right' | 'left'
}

/**
 * A popover portaled to document.body and positioned via `position: fixed`
 * from the anchor's live screen rect.
 *
 * Why not plain `absolute`: the left toolbar (and other tool chrome) uses
 * `overflow-y-auto` so its long button list can scroll — but per the CSS
 * overflow spec, setting overflow-y to anything but `visible` forces
 * overflow-x to compute as `auto` too, even though only vertical scrolling
 * was ever wanted. That silently clips any `absolute` popover that tries to
 * render outside the toolbar's own narrow column, making it invisible and
 * unclickable. Escaping via a portal + `fixed` positioning sidesteps that
 * clipping ancestor entirely.
 */
export function AnchoredPopover({ anchorRef, onClose, children, side = 'right' }: AnchoredPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    const anchor = anchorRef.current
    const panel = panelRef.current
    if (!anchor || !panel) return
    const rect = anchor.getBoundingClientRect()
    const panelWidth = panel.offsetWidth
    const panelHeight = panel.offsetHeight
    const margin = 8

    let left = side === 'right' ? rect.right + margin : rect.left - panelWidth - margin
    left = Math.min(Math.max(margin, left), window.innerWidth - panelWidth - margin)

    let top = rect.top
    top = Math.min(Math.max(margin, top), window.innerHeight - panelHeight - margin)

    setStyle({ top, left })
  }, [anchorRef, side])

  return createPortal(
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div
        ref={panelRef}
        className="fixed z-40 rounded-[--radius-lg] border border-ink-100 bg-white p-4 shadow-[--shadow-float]"
        style={{ top: style?.top ?? -9999, left: style?.left ?? -9999, visibility: style ? 'visible' : 'hidden' }}
      >
        {children}
      </div>
    </>,
    document.body,
  )
}
