import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input } from '@/components/ui'
import { useAuthStore } from '@/store/useAuthStore'
import { AuthLayout } from './AuthLayout'

// Reached via the link in the password-reset email, which Supabase Auth
// turns into a temporary recovery session (handled automatically by the
// client's detectSessionInUrl option — see supabase/client.ts). This page
// only needs to collect and submit the new password.
export function ResetPasswordPage() {
  const navigate = useNavigate()
  const updatePassword = useAuthStore((s) => s.updatePassword)
  const authError = useAuthStore((s) => s.authError)
  const clearAuthError = useAuthStore((s) => s.clearAuthError)

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [mismatchError, setMismatchError] = useState<string>()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    clearAuthError()
    setMismatchError(undefined)
    if (password !== confirmPassword) {
      setMismatchError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setMismatchError('Use at least 8 characters.')
      return
    }
    setSubmitting(true)
    try {
      await updatePassword(password)
      setDone(true)
    } catch {
      // authError is already set by the store.
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <AuthLayout title="Password updated" subtitle="You can now sign in with your new password.">
        <Button fullWidth onClick={() => navigate('/login')}>
          Continue to sign in
        </Button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Choose a new password" subtitle="Enter a new password for your account.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          hint="At least 8 characters."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Input
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        {(mismatchError || authError) && <p className="text-sm text-danger-600">{mismatchError ?? authError}</p>}
        <Button type="submit" fullWidth disabled={submitting}>
          {submitting ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </AuthLayout>
  )
}
