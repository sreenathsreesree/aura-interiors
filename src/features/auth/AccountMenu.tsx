import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronUp, LogOut } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useAuthStore } from '@/store/useAuthStore'
import { SyncStatusIndicator } from './SyncStatusIndicator'

// Sidebar footer block: shows the signed-in account + sign out when a
// cloud account is active, a "Sign in" prompt when cloud is configured but
// unused, or nothing beyond the plain version label in local-only mode
// (Supabase not configured at all) — never adds an account affordance for
// a feature that isn't actually available.
export function AccountMenu() {
  const cloudEnabled = useAuthStore((s) => s.cloudEnabled)
  const status = useAuthStore((s) => s.status)
  const user = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  if (!cloudEnabled) {
    return (
      <div className="rounded-[--radius-md] bg-sand-100 px-4 py-3.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Aura Interiors</p>
        <p className="mt-0.5 text-xs text-ink-500">v1.0 — Foundation</p>
      </div>
    )
  }

  if (status !== 'signed-in' || !user) {
    return (
      <Link
        to="/login"
        className="flex items-center justify-center rounded-[--radius-md] border-2 border-ink-100 px-4 py-3 text-sm font-semibold text-ink-700 transition-colors hover:border-brass-400 hover:text-brass-600"
      >
        Sign in
      </Link>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      {open && (
        <div className="absolute bottom-[calc(100%+0.5rem)] left-0 right-0 overflow-hidden rounded-[--radius-md] border border-ink-100 bg-white py-1 shadow-[--shadow-float]">
          <button
            onClick={() => void signOut()}
            className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-semibold text-ink-700 transition-colors hover:bg-sand-100"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 rounded-[--radius-md] bg-sand-100 px-4 py-3.5 text-left transition-colors hover:bg-sand-200"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-ink-800">{user.email}</span>
          <SyncStatusIndicator className="mt-0.5" />
        </span>
        <ChevronUp className={cn('h-4 w-4 shrink-0 text-ink-400 transition-transform', open && 'rotate-180')} />
      </button>
    </div>
  )
}
