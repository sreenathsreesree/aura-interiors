import {
  Square,
  Ruler,
  PaintBucket,
  Grid3x3,
  Layers,
  PanelTop,
  DoorClosed,
  CookingPot,
  PanelsTopLeft,
  Blinds,
  Lightbulb,
  Zap,
  Calculator,
  type LucideIcon,
} from 'lucide-react'

// Mirrors data/roomIcons.tsx's pattern: a static string -> LucideIcon map so
// registry.ts can name an icon without importing lucide-react itself.
const CALCULATOR_ICONS: Record<string, LucideIcon> = {
  Square,
  Ruler,
  PaintBucket,
  Grid3x3,
  Layers,
  PanelTop,
  DoorClosed,
  CookingPot,
  PanelsTopLeft,
  Blinds,
  Lightbulb,
  Zap,
  Calculator,
}

export function getCalculatorIcon(icon: string): LucideIcon {
  return CALCULATOR_ICONS[icon] ?? Calculator
}
