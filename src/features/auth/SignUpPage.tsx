import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Input } from '@/components/ui'
import { useAuthStore } from '@/store/useAuthStore'
import { AuthLayout } from './AuthLayout'

export function SignUpPage() {
  const navigate = useNavigate()
  const signUp = useAuthStore((s) => s.signUp)
  const authError = useAuthStore((s) => s.authError)
  const clearAuthError = useAuthStore((s) => s.clearAuthError)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmEmailSent, setConfirmEmailSent] = useState(false)
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
      await signUp(email, password, fullName.trim() || undefined)
      setConfirmEmailSent(true)
    } catch {
      // authError is already set by the store.
    } finally {
      setSubmitting(false)
    }
  }

  if (confirmEmailSent) {
    return (
      <AuthLayout title="Check your email" subtitle="We've sent a confirmation link to finish setting up your account.">
        <Button fullWidth variant="outline" onClick={() => navigate('/login')}>
          Back to sign in
        </Button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="A default studio workspace is created automatically."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brass-600 hover:text-brass-700">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Full name" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          hint="At least 8 characters."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Input
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        {(mismatchError || authError) && <p className="text-sm text-danger-600">{mismatchError ?? authError}</p>}
        <Button type="submit" fullWidth disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  )
}
