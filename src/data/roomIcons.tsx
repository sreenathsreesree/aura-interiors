import {
  Sofa,
  BedDouble,
  ChefHat,
  UtensilsCrossed,
  Bath,
  BookOpen,
  DoorOpen,
  Flame,
  Trees,
  WashingMachine,
  type LucideIcon,
} from 'lucide-react'

export const ROOM_TYPE_ICONS: Record<string, LucideIcon> = {
  sofa: Sofa,
  bed: BedDouble,
  kitchen: ChefHat,
  dining: UtensilsCrossed,
  bath: Bath,
  desk: BookOpen,
  door: DoorOpen,
  temple: Flame,
  balcony: Trees,
  utility: WashingMachine,
}

export function getRoomIcon(icon: string): LucideIcon {
  return ROOM_TYPE_ICONS[icon] ?? Sofa
}
