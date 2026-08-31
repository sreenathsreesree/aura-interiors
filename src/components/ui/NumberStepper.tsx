import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/cn'

interface NumberStepperProps {
  label: string
  value: number
  onChange: (value: number) => void
  step?: number
  min?: number
  suffix?: string
  className?: string
}

export function NumberStepper({
  label,
  value,
  onChange,
  step = 0.5,
  min = 0,
  suffix,
  className,
}: NumberStepperProps) {
  function clamp(next: number) {
    return Math.max(min, Math.round(next * 100) / 100)
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-sm font-semibold text-ink-700">{label}</span>
      <div className="flex h-14 items-stretch overflow-hidden rounded-[--radius-md] border-2 border-ink-100 bg-sand-50 focus-within:border-brass-500">
        <button
          type="button"
          onClick={() => onChange(clamp(value - step))}
          className="flex w-13 shrink-0 items-center justify-center text-ink-600 transition-colors hover:bg-ink-100 active:bg-ink-200"
          aria-label={`Decrease ${label}`}
        >
          <Minus className="h-5 w-5" />
        </button>
        <div className="flex flex-1 items-center justify-center gap-1">
          <input
            type="number"
            inputMode="decimal"
            value={value === 0 ? '' : value}
            placeholder="0"
            onChange={(e) => onChange(clamp(Number(e.target.value) || 0))}
            className="w-full min-w-0 bg-transparent text-center text-lg font-semibold text-ink-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          {suffix && <span className="pr-1 text-sm font-medium text-ink-400">{suffix}</span>}
        </div>
        <button
          type="button"
          onClick={() => onChange(clamp(value + step))}
          className="flex w-13 shrink-0 items-center justify-center text-ink-600 transition-colors hover:bg-ink-100 active:bg-ink-200"
          aria-label={`Increase ${label}`}
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
