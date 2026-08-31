import type { ItemUnit } from '@/types'

export interface CatalogItem {
  id: string
  name: string
  category: string
  unit: ItemUnit
  defaultRate: number
}

// Sample rate catalog for common interior work. In later sessions this feeds
// the pricing engine; for now it lets the Room Builder "Add Item" flow feel real.
export const ITEM_CATALOG: CatalogItem[] = [
  { id: 'cat-1', name: 'Modular Wardrobe (Sliding Shutter)', category: 'Wardrobe', unit: 'sqft', defaultRate: 1850 },
  { id: 'cat-2', name: 'Modular Wardrobe (Hinged Shutter)', category: 'Wardrobe', unit: 'sqft', defaultRate: 1650 },
  { id: 'cat-3', name: 'Wardrobe Loft Storage', category: 'Wardrobe', unit: 'sqft', defaultRate: 1200 },
  { id: 'cat-4', name: 'TV Unit with Storage', category: 'Living', unit: 'sqft', defaultRate: 1750 },
  { id: 'cat-5', name: 'Wall Paneling — Veneer Finish', category: 'Living', unit: 'sqft', defaultRate: 950 },
  { id: 'cat-6', name: 'False Ceiling — Gypsum with Cove', category: 'Ceiling', unit: 'sqft', defaultRate: 95 },
  { id: 'cat-7', name: 'Cove & Profile Lighting', category: 'Lighting', unit: 'rft', defaultRate: 220 },
  { id: 'cat-8', name: 'Base Unit — Kitchen', category: 'Kitchen', unit: 'rft', defaultRate: 2400 },
  { id: 'cat-9', name: 'Wall Unit — Kitchen', category: 'Kitchen', unit: 'rft', defaultRate: 1950 },
  { id: 'cat-10', name: 'Tall Unit / Pantry — Kitchen', category: 'Kitchen', unit: 'nos', defaultRate: 38000 },
  { id: 'cat-11', name: 'Quartz Countertop', category: 'Kitchen', unit: 'sqft', defaultRate: 480 },
  { id: 'cat-12', name: 'Kitchen Backsplash Tiling', category: 'Kitchen', unit: 'sqft', defaultRate: 210 },
  { id: 'cat-13', name: 'Bed Back Panel', category: 'Bedroom', unit: 'sqft', defaultRate: 1100 },
  { id: 'cat-14', name: 'Study / Dresser Unit', category: 'Bedroom', unit: 'sqft', defaultRate: 1450 },
  { id: 'cat-15', name: 'Crockery Unit', category: 'Dining', unit: 'sqft', defaultRate: 1600 },
  { id: 'cat-16', name: 'Vanity Unit with Countertop', category: 'Bathroom', unit: 'rft', defaultRate: 2800 },
  { id: 'cat-17', name: 'Mirror with Backlight', category: 'Bathroom', unit: 'nos', defaultRate: 6500 },
  { id: 'cat-18', name: 'Shoe Rack Unit', category: 'Foyer', unit: 'sqft', defaultRate: 1350 },
  { id: 'cat-19', name: 'Curtain Track & Pelmet', category: 'Soft Furnishing', unit: 'rft', defaultRate: 180 },
  { id: 'cat-20', name: 'Electrical Rewiring & Points', category: 'Electrical', unit: 'lump-sum', defaultRate: 45000 },
  { id: 'cat-21', name: 'Painting — Premium Emulsion', category: 'Paint', unit: 'sqft', defaultRate: 32 },
  { id: 'cat-22', name: 'Mandir Unit — Backlit Jaali', category: 'Pooja Room', unit: 'nos', defaultRate: 52000 },
  { id: 'cat-23', name: 'Bookshelf / Display Unit', category: 'Study', unit: 'sqft', defaultRate: 1400 },
  { id: 'cat-24', name: 'Loose Furniture — Dining Table Set', category: 'Furniture', unit: 'nos', defaultRate: 68000 },
]

export const ITEM_CATEGORIES = Array.from(new Set(ITEM_CATALOG.map((i) => i.category)))
