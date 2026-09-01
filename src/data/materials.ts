import type { Material } from '@/types/materials'

// Realistic sample catalogue — one reasonable "starter library" per category,
// not a full studio material database (that's a later phase). Pattern
// materials only need a base + accent colour; lib/materialPatterns.ts turns
// those into an actual generated, tileable texture per category.

export const MATERIAL_CATALOGUE: Material[] = [
  // Colours — flat fills, browsable from the same Material Panel as textures.
  { id: 'mat-colour-ink', name: 'Charcoal Ink', category: 'colour', type: 'colour', baseColor: '#221f1b' },
  { id: 'mat-colour-espresso', name: 'Espresso Brown', category: 'colour', type: 'colour', baseColor: '#453e36' },
  { id: 'mat-colour-sand', name: 'Warm Sand', category: 'colour', type: 'colour', baseColor: '#d6cbb8' },
  { id: 'mat-colour-ivory', name: 'Ivory White', category: 'colour', type: 'colour', baseColor: '#f6f1ea' },
  { id: 'mat-colour-brass', name: 'Brushed Brass', category: 'colour', type: 'colour', baseColor: '#b5893f' },
  { id: 'mat-colour-terracotta', name: 'Terracotta', category: 'colour', type: 'colour', baseColor: '#b6613f' },
  { id: 'mat-colour-sage', name: 'Soft Sage', category: 'colour', type: 'colour', baseColor: '#8ea083' },
  { id: 'mat-colour-slate', name: 'Slate Blue', category: 'colour', type: 'colour', baseColor: '#5c8ba3' },

  // Wood
  { id: 'mat-wood-oak', name: 'Natural Oak', category: 'wood', type: 'pattern', baseColor: '#c9a26a', accentColor: '#9c7444' },
  { id: 'mat-wood-walnut', name: 'Walnut Dark', category: 'wood', type: 'pattern', baseColor: '#5a3d29', accentColor: '#3a2416' },
  { id: 'mat-wood-teak', name: 'Teak Classic', category: 'wood', type: 'pattern', baseColor: '#a9793f', accentColor: '#7a5228' },
  { id: 'mat-wood-ash', name: 'Ash Grey', category: 'wood', type: 'pattern', baseColor: '#c9c2b4', accentColor: '#a89e8c' },

  // Laminate
  { id: 'mat-laminate-white', name: 'White Laminate', category: 'laminate', type: 'pattern', baseColor: '#f5f3ee', accentColor: '#e2ddd1' },
  { id: 'mat-laminate-grey', name: 'Grey Matte Laminate', category: 'laminate', type: 'pattern', baseColor: '#c7c5c0', accentColor: '#a9a7a1' },
  { id: 'mat-laminate-woodlook', name: 'Wood-Look Laminate', category: 'laminate', type: 'pattern', baseColor: '#b98a5c', accentColor: '#8f6640' },

  // Marble
  { id: 'mat-marble-carrara', name: 'Carrara White', category: 'marble', type: 'pattern', baseColor: '#f2f0ec', accentColor: '#a8a29a' },
  { id: 'mat-marble-marquina', name: 'Black Marquina', category: 'marble', type: 'pattern', baseColor: '#26241f', accentColor: '#e8e3d8' },
  { id: 'mat-marble-emperador', name: 'Emperador Brown', category: 'marble', type: 'pattern', baseColor: '#5c4130', accentColor: '#c9a97a' },

  // Granite
  { id: 'mat-granite-steelgrey', name: 'Steel Grey Granite', category: 'granite', type: 'pattern', baseColor: '#6b6d6b', accentColor: '#232423' },
  { id: 'mat-granite-blackgalaxy', name: 'Black Galaxy', category: 'granite', type: 'pattern', baseColor: '#181818', accentColor: '#c9a15f' },

  // Stone
  { id: 'mat-stone-sandstone', name: 'Sandstone Beige', category: 'stone', type: 'pattern', baseColor: '#cbb894', accentColor: '#a08a63' },
  { id: 'mat-stone-slate', name: 'Slate Grey Stone', category: 'stone', type: 'pattern', baseColor: '#575d5c', accentColor: '#383d3c' },

  // Glass
  { id: 'mat-glass-clear', name: 'Clear Glass', category: 'glass', type: 'pattern', baseColor: '#dbe8ea', accentColor: '#ffffff' },
  { id: 'mat-glass-frosted', name: 'Frosted Glass', category: 'glass', type: 'pattern', baseColor: '#e9edee', accentColor: '#ffffff' },
  { id: 'mat-glass-tinted', name: 'Tinted Blue Glass', category: 'glass', type: 'pattern', baseColor: '#5c8ba3', accentColor: '#dbe8ea' },

  // Fabric
  { id: 'mat-fabric-linen', name: 'Linen Natural', category: 'fabric', type: 'pattern', baseColor: '#e6ddc9', accentColor: '#c9bd9f' },
  { id: 'mat-fabric-velvet', name: 'Velvet Charcoal', category: 'fabric', type: 'pattern', baseColor: '#332f2c', accentColor: '#4d4842' },
  { id: 'mat-fabric-cotton', name: 'Cotton Weave Blue', category: 'fabric', type: 'pattern', baseColor: '#7fa0ae', accentColor: '#5c8ba3' },

  // Wallpaper
  { id: 'mat-wallpaper-floral', name: 'Floral Sage', category: 'wallpaper', type: 'pattern', baseColor: '#eef0e8', accentColor: '#8ea083' },
  { id: 'mat-wallpaper-geo', name: 'Geometric Brass', category: 'wallpaper', type: 'pattern', baseColor: '#f6f1ea', accentColor: '#b5893f' },
  { id: 'mat-wallpaper-stripe', name: 'Stripe Terracotta', category: 'wallpaper', type: 'pattern', baseColor: '#f6f1ea', accentColor: '#b6613f' },

  // Flooring
  { id: 'mat-flooring-oakplank', name: 'Oak Plank Flooring', category: 'flooring', type: 'pattern', baseColor: '#c9a26a', accentColor: '#8f6640' },
  { id: 'mat-flooring-herringbone', name: 'Herringbone Parquet', category: 'flooring', type: 'pattern', baseColor: '#a9793f', accentColor: '#7a5228' },
  { id: 'mat-flooring-greytile', name: 'Grey Tile Flooring', category: 'flooring', type: 'pattern', baseColor: '#d3d2cc', accentColor: '#a9a7a1' },

  // Other
  { id: 'mat-other-cork', name: 'Cork', category: 'other', type: 'pattern', baseColor: '#c69a63', accentColor: '#9c7444' },
  { id: 'mat-other-rattan', name: 'Rattan / Cane', category: 'other', type: 'pattern', baseColor: '#cba36c', accentColor: '#9c7444' },
]

export function getMaterialById(id: string): Material | undefined {
  return MATERIAL_CATALOGUE.find((m) => m.id === id)
}

export function materialsByCategory(category: string): Material[] {
  return MATERIAL_CATALOGUE.filter((m) => m.category === category)
}
