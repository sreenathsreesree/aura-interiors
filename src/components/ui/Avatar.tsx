import { cn } from '@/lib/cn'
import { initialsFromName } from '@/lib/format'

type AvatarColor = 'brass' | 'terracotta' | 'sage' | 'clay' | 'ink'

const colorClasses: Record<AvatarColor, string> = {
  brass: 'bg-brass-500 text-sand-50',
  terracotta: 'bg-terracotta-500 text-sand-50',
  sage: 'bg-sage-500 text-sand-50',
  clay: 'bg-clay-500 text-sand-50',
  ink: 'bg-ink-800 text-sand-100',
}

const sizeClasses = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-2xl',
}

interface AvatarProps {
  name: string
  color?: string
  size?: keyof typeof sizeClasses
  className?: string
}

export function Avatar({ name, color = 'ink', size = 'md', className }: AvatarProps) {
  const tone = (color in colorClasses ? color : 'ink') as AvatarColor
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-display font-semibold',
        colorClasses[tone],
        sizeClasses[size],
        className,
      )}
    >
      {initialsFromName(name)}
    </div>
  )
}
