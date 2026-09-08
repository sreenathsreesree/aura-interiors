import { useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'
import { MigrationPrompt } from './MigrationPrompt'

// Gates every route under AppLayout/FocusLayout. When Supabase isn't
// configured at all, `status` resolves straight to 'local-only' and this
// renders the Outlet unconditionally — the app behaves exactly as it did
// before this milestone, with no auth wall, for any environment (this one
// included) that hasn't been given real Supabase credentials.
export function AuthGuard() {
  const status = useAuthStore((s) => s.status)
  const pendingMigration = useAuthStore((s) => s.pendingMigration)
  const init = useAuthStore((s) => s.init)

  useEffect(() => {
    // Runs once — auth state changes after this are driven by the
    // onAuthStateChange subscription set up inside init(), not by
    // re-running init() itself.
    void init()
  }, [init])

  if (status === 'loading') {
    return <div className="flex min-h-dvh items-center justify-center bg-sand-100 text-sm text-ink-400">Loading…</div>
  }

  if (status === 'signed-out') {
    return <Navigate to="/login" replace />
  }

  if (pendingMigration) {
    return <MigrationPrompt />
  }

  return <Outlet />
}
