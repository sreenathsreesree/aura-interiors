import { AuraLogo } from '@/components/brand/AuraLogo'

// Compact header for phones, replacing the Sidebar's branding block.
export function MobileTopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center border-b border-ink-100 bg-white/95 px-4 backdrop-blur md:hidden">
      <AuraLogo />
    </header>
  )
}
