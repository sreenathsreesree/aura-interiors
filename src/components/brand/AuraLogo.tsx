import { cn } from '@/lib/cn'

interface AuraLogoProps {
  variant?: 'full' | 'mark'
  tone?: 'dark' | 'light'
  className?: string
}

// Simple architectural monogram: an "A" formed from two strokes and a
// horizontal bar, echoing a drafting/elevation mark rather than a literal letter.
export function AuraLogo({ variant = 'full', tone = 'dark', className }: AuraLogoProps) {
  const strokeColor = tone === 'dark' ? '#221f1b' : '#fbf9f6'
  const textColor = tone === 'dark' ? 'text-ink-900' : 'text-sand-50'

  const mark = (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
      <path
        d="M15 4L25 26"
        stroke="#b5893f"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M15 4L5 26"
        stroke={strokeColor}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path d="M9.5 18H20.5" stroke={strokeColor} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )

  if (variant === 'mark') {
    return <span className={cn('inline-flex', className)}>{mark}</span>
  }

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      {mark}
      <span className={cn('font-display text-xl font-semibold leading-none tracking-tight', textColor)}>
        Aura <span className="italic font-medium text-brass-500">Interiors</span>
      </span>
    </span>
  )
}
