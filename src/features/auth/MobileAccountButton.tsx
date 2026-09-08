import { useNavigate } from 'react-router-dom'
import { LogOut, User } from 'lucide-react'
import { IconButton } from '@/components/ui'
import { useAuthStore } from '@/store/useAuthStore'
import { SyncStatusIndicator } from './SyncStatusIndicator'

// Compact equivalent of AccountMenu for the phone-width top bar, where
// there's no room for a full dropdown — a tap either opens sign in or
// (with a quick confirm, matching the app's existing confirm-before-leaving
// pattern) signs out.
export function MobileAccountButton() {
  const navigate = useNavigate()
  const cloudEnabled = useAuthStore((s) => s.cloudEnabled)
  const status = useAuthStore((s) => s.status)
  const signOut = useAuthStore((s) => s.signOut)

  if (!cloudEnabled) return null

  if (status !== 'signed-in') {
    return (
      <IconButton label="Sign in" variant="ghost" size="sm" onClick={() => navigate('/login')}>
        <User className="h-5 w-5" />
      </IconButton>
    )
  }

  return (
    <span className="flex items-center gap-2">
      <SyncStatusIndicator />
      <IconButton
        label="Sign out"
        variant="ghost"
        size="sm"
        onClick={() => {
          if (window.confirm('Sign out of AURA? Your cloud data stays exactly as it is.')) void signOut()
        }}
      >
        <LogOut className="h-5 w-5" />
      </IconButton>
    </span>
  )
}
