import type { RoomTypeOption } from '@/types'

// Catalog of selectable room types with sensible default requirement checklists.
// Used by the Room Builder when a designer adds a new room to a project.
export const ROOM_TYPE_OPTIONS: RoomTypeOption[] = [
  {
    type: 'living-room',
    label: 'Living Room',
    icon: 'sofa',
    defaultRequirements: [
      'TV unit / entertainment wall',
      'Seating & sofa arrangement',
      'False ceiling with cove lighting',
      'Wall paneling / accent wall',
      'Storage / display unit',
    ],
  },
  {
    type: 'master-bedroom',
    label: 'Master Bedroom',
    icon: 'bed',
    defaultRequirements: [
      'Wardrobe (sliding / hinged)',
      'Bed back panel',
      'Study or dresser unit',
      'False ceiling',
      'Wardrobe internal accessories',
    ],
  },
  {
    type: 'bedroom',
    label: 'Bedroom',
    icon: 'bed',
    defaultRequirements: [
      'Wardrobe',
      'Study table',
      'False ceiling',
      'Curtain track / pelmet',
    ],
  },
  {
    type: 'kids-room',
    label: "Kids' Room",
    icon: 'bed',
    defaultRequirements: [
      'Wardrobe with storage',
      'Study unit',
      'Bunk bed / loft bed',
      'Theme wall',
    ],
  },
  {
    type: 'kitchen',
    label: 'Kitchen',
    icon: 'kitchen',
    defaultRequirements: [
      'Base units & wall units',
      'Countertop',
      'Tall unit / pantry',
      'Chimney & hob provision',
      'Sink & fittings',
      'Backsplash / dado tiling',
    ],
  },
  {
    type: 'dining-room',
    label: 'Dining Room',
    icon: 'dining',
    defaultRequirements: [
      'Crockery unit',
      'Feature wall / lighting',
      'False ceiling',
    ],
  },
  {
    type: 'bathroom',
    label: 'Bathroom',
    icon: 'bath',
    defaultRequirements: [
      'Vanity unit',
      'Mirror & lighting',
      'Shower partition',
      'Tiling & waterproofing',
    ],
  },
  {
    type: 'study',
    label: 'Study / Home Office',
    icon: 'desk',
    defaultRequirements: [
      'Work desk & storage',
      'Bookshelf / display unit',
      'Task lighting',
    ],
  },
  {
    type: 'foyer',
    label: 'Foyer / Entrance',
    icon: 'door',
    defaultRequirements: ['Shoe rack unit', 'Feature wall', 'Console table'],
  },
  {
    type: 'pooja-room',
    label: 'Pooja Room',
    icon: 'temple',
    defaultRequirements: ['Mandir unit', 'Backlit jaali / panel', 'Flooring upgrade'],
  },
  {
    type: 'balcony',
    label: 'Balcony',
    icon: 'balcony',
    defaultRequirements: ['Decking / flooring', 'Railing / safety grill', 'Outdoor seating'],
  },
  {
    type: 'utility',
    label: 'Utility Area',
    icon: 'utility',
    defaultRequirements: ['Washer/dryer provision', 'Storage cabinet', 'Sink unit'],
  },
]

export function getRoomTypeOption(type: string): RoomTypeOption {
  return (
    ROOM_TYPE_OPTIONS.find((option) => option.type === type) ?? ROOM_TYPE_OPTIONS[0]
  )
}
