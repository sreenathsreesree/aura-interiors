import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

interface Step {
  label: string
}

interface ProgressStepsProps {
  steps: Step[]
  currentIndex: number
  className?: string
}

export function ProgressSteps({ steps, currentIndex, className }: ProgressStepsProps) {
  return (
    <div className={cn('flex w-full items-center', className)}>
      {steps.map((step, index) => {
        const isComplete = index < currentIndex
        const isCurrent = index === currentIndex
        return (
          <div key={step.label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors sm:h-9 sm:w-9',
                  isComplete && 'bg-sage-500 text-white',
                  isCurrent && 'bg-ink-900 text-sand-50',
                  !isComplete && !isCurrent && 'bg-ink-100 text-ink-400',
                )}
              >
                {isComplete ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span
                className={cn(
                  'hidden text-center text-xs font-medium sm:block',
                  isCurrent ? 'text-ink-900' : 'text-ink-400',
                )}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'mx-2 h-0.5 flex-1 rounded-full transition-colors',
                  isComplete ? 'bg-sage-500' : 'bg-ink-100',
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
