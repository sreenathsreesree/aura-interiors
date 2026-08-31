import { forwardRef, useId } from 'react'
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string
  hint?: string
  suffix?: ReactNode
  prefix?: ReactNode
  containerClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, suffix, prefix, className, containerClassName, id, ...props }, ref) => {
    const generatedId = useId()
    const inputId = id ?? generatedId
    return (
      <label htmlFor={inputId} className={cn('block', containerClassName)}>
        {label && (
          <span className="mb-1.5 block text-sm font-semibold text-ink-700">{label}</span>
        )}
        <div className="relative flex items-center">
          {prefix && (
            <span className="pointer-events-none absolute left-4 text-ink-500">{prefix}</span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'h-13 w-full rounded-[--radius-md] border-2 border-ink-100 bg-sand-50 px-4 text-base text-ink-900 placeholder:text-ink-400 outline-none transition-colors focus:border-brass-500 focus:bg-white',
              prefix && 'pl-10',
              suffix && 'pr-14',
              className,
            )}
            {...props}
          />
          {suffix && (
            <span className="pointer-events-none absolute right-4 text-sm font-medium text-ink-500">
              {suffix}
            </span>
          )}
        </div>
        {hint && <span className="mt-1.5 block text-xs text-ink-500">{hint}</span>}
      </label>
    )
  },
)
Input.displayName = 'Input'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, className, id, ...props }, ref) => {
    const generatedId = useId()
    const inputId = id ?? generatedId
    return (
      <label htmlFor={inputId} className="block">
        {label && (
          <span className="mb-1.5 block text-sm font-semibold text-ink-700">{label}</span>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            'min-h-24 w-full rounded-[--radius-md] border-2 border-ink-100 bg-sand-50 px-4 py-3 text-base text-ink-900 placeholder:text-ink-400 outline-none transition-colors focus:border-brass-500 focus:bg-white',
            className,
          )}
          {...props}
        />
        {hint && <span className="mt-1.5 block text-xs text-ink-500">{hint}</span>}
      </label>
    )
  },
)
Textarea.displayName = 'Textarea'
