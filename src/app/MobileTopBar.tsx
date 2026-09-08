import { AuraLogo } from '@/components/brand/AuraLogo'
import { MobileAccountButton } from '@/features/auth/MobileAccountButton'

// Compact header for phones, replacing the Sidebar's branding block.
export function MobileTopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-ink-100 bg-white/95 px-4 backdrop-blur md:hidden">
      <AuraLogo />
      <MobileAccountButton />
    </header>
  )
}
