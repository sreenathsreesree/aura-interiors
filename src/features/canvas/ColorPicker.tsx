import { cn } from '@/lib/cn'

export const PRESET_COLORS = [
  '#221f1b',
  '#453e36',
  '#75695a',
  '#948676',
  '#d6cbb8',
  '#f6f1ea',
  '#ffffff',
  '#b5893f',
  '#c9a15f',
  '#b6613f',
  '#c97b5c',
  '#71856a',
  '#8ea083',
  '#a34a3d',
  '#5c8ba3',
  '#a9c6d8',
]

interface Swatch {
  color: string
  onClick: () => void
  active?: boolean
}

function ColorSwatch({ color, onClick, active }: Swatch) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={color}
      className={cn(
        'h-7 w-7 shrink-0 rounded-full border-2 transition-transform active:scale-90',
        active ? 'border-brass-600 ring-2 ring-brass-300' : 'border-white shadow-[0_0_0_1px_rgba(0,0,0,0.12)]',
      )}
      style={{ background: color }}
    />
  )
}

interface ColorPickerContentProps {
  color: string
  opacity: number
  onChangeColor: (color: string) => void
  onChangeOpacity: (opacity: number) => void
  recentColors: string[]
}

export function ColorPickerContent({ color, opacity, onChangeColor, onChangeOpacity, recentColors }: ColorPickerContentProps) {
  return (
    <div className="flex w-64 flex-col gap-4">
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Palette</p>
        <div className="grid grid-cols-8 gap-2">
          {PRESET_COLORS.map((c) => (
            <ColorSwatch key={c} color={c} active={c.toLowerCase() === color.toLowerCase()} onClick={() => onChangeColor(c)} />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="color"
          value={/^#([0-9a-f]{6})$/i.test(color) ? color : '#c9a15f'}
          onChange={(e) => onChangeColor(e.target.value)}
          className="h-10 w-10 cursor-pointer rounded-md border border-ink-200 bg-transparent p-0.5"
        />
        <button
          type="button"
          onClick={() => onChangeColor('none')}
          className={cn(
            'h-9 flex-1 rounded-md border-2 text-xs font-semibold transition-colors',
            color === 'none' ? 'border-ink-900 bg-ink-900 text-sand-50' : 'border-ink-200 text-ink-600',
          )}
        >
          No Fill
        </button>
      </div>

      {recentColors.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Recent</p>
          <div className="flex flex-wrap gap-2">
            {recentColors.map((c, i) => (
              <ColorSwatch key={`${c}-${i}`} color={c} active={c.toLowerCase() === color.toLowerCase()} onClick={() => onChangeColor(c)} />
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-ink-500">
          <span>Opacity</span>
          <span className="tabular-nums">{Math.round(opacity * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={opacity}
          onChange={(e) => onChangeOpacity(Number(e.target.value))}
          className="w-full accent-brass-500"
        />
      </div>
    </div>
  )
}

interface ColorPickerPopoverProps extends ColorPickerContentProps {
  onClose: () => void
  title: string
}

/** Anchored popover — the caller must wrap the trigger + this in a `relative` element. */
export function ColorPickerPopover({ onClose, title, ...contentProps }: ColorPickerPopoverProps) {
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute left-full top-0 z-40 ml-2 rounded-[--radius-lg] border border-ink-100 bg-white p-4 shadow-[--shadow-float]">
        <p className="mb-3 font-display text-sm font-semibold text-ink-900">{title}</p>
        <ColorPickerContent {...contentProps} />
      </div>
    </>
  )
}
