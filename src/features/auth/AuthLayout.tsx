import type { ReactNode } from 'react'
import { AuraLogo } from '@/components/brand/AuraLogo'
import { Card } from '@/components/ui'

interface AuthLayoutProps {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}

// Shared shell for Login/Sign up/Forgot password/Reset password — a single
// centered card, consistent with the rest of AURA's visual language rather
// than a bespoke "auth product" look.
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-sand-100 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <AuraLogo />
        </div>
        <Card padding="lg">
          <h1 className="font-display text-xl font-semibold text-ink-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </Card>
        {footer && <div className="mt-5 text-center text-sm text-ink-500">{footer}</div>}
      </div>
    </div>
  )
}
