import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface ToolButtonProps {
  icon: ReactNode
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  className?: string
}

/** Icon-only, dark-chrome tool button shared by the Canvas top bar, left toolbar and bottom bar. */
export function ToolButton({ icon, label, active, disabled, onClick, className }: ToolButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-[--radius-md] transition-colors active:scale-95 disabled:cursor-not-allowed disabled:opacity-30',
        active ? 'bg-brass-500 text-ink-950' : 'text-sand-200 hover:bg-white/10',
        className,
      )}
    >
      {icon}
    </button>
  )
}
