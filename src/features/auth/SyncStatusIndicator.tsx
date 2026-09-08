import { Check, CloudOff, Loader2, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useSyncStatusStore } from '@/supabase/sync/syncStatus'

const CONFIG = {
  synced: { label: 'Synced', icon: Check, className: 'text-success-500' },
  saving: { label: 'Saving…', icon: Loader2, className: 'text-brass-600' },
  offline: { label: 'Offline — will sync', icon: CloudOff, className: 'text-ink-400' },
  error: { label: 'Sync error — retrying', icon: TriangleAlert, className: 'text-danger-500' },
} as const

/** Hidden entirely when cloud sync isn't in play (local-only mode, or signed out) — never noisy for the common case. */
export function SyncStatusIndicator({ className }: { className?: string }) {
  const status = useSyncStatusStore((s) => s.status)
  if (status === 'disabled') return null

  const { label, icon: Icon, className: toneClassName } = CONFIG[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', toneClassName, className)}>
      <Icon className={cn('h-3.5 w-3.5', status === 'saving' && 'animate-spin')} />
      {label}
    </span>
  )
}
