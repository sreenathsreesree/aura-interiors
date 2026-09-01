// AURA CANVAS V2 — material/texture catalogue model.
//
// A Material is a reusable, named fill definition a designer picks from the
// Material Panel. Applying one to an object just writes `materialId` (+
// fillType/fill) onto that CanvasObject — the object itself stays a normal
// editable vector shape (lib/canvasEngine.ts renders the material as a
// clipped, repeating pattern; nothing here touches the drawing engine).
//
// Fields below go further than V2 actually uses (supplier/brand/price/
// specifications/favourite/custom) — deliberately, per the phase brief, so
// a later studio material library / favourites / recents / custom-library
// phase can build on this shape without a breaking change.

export type MaterialCategory =
  | 'colour'
  | 'wood'
  | 'laminate'
  | 'marble'
  | 'granite'
  | 'stone'
  | 'glass'
  | 'fabric'
  | 'wallpaper'
  | 'flooring'
  | 'other'

/** 'colour' materials render as a flat fill; every other category renders as a generated, tileable pattern (lib/materialPatterns.ts). */
export type MaterialType = 'colour' | 'pattern'

export interface Material {
  id: string
  name: string
  category: MaterialCategory
  type: MaterialType
  /** Base colour — the fill itself when type is 'colour', or the dominant tone used to seed the pattern generator otherwise. */
  baseColor: string
  /** Secondary tone (grain/vein/weave colour) used by the pattern generator. Ignored for type 'colour'. */
  accentColor?: string
  /** Data-URI thumbnail is generated on demand and cached — never stored here. */
  thumbnail?: string

  // Reserved for later phases — not read or written anywhere in V2.
  supplier?: string
  brand?: string
  code?: string
  price?: number
  specifications?: string
  isFavorite?: boolean
  isCustom?: boolean
}

export const MATERIAL_CATEGORIES: { id: MaterialCategory; label: string }[] = [
  { id: 'colour', label: 'Colours' },
  { id: 'wood', label: 'Wood' },
  { id: 'laminate', label: 'Laminate' },
  { id: 'marble', label: 'Marble' },
  { id: 'granite', label: 'Granite' },
  { id: 'stone', label: 'Stone' },
  { id: 'glass', label: 'Glass' },
  { id: 'fabric', label: 'Fabric' },
  { id: 'wallpaper', label: 'Wallpaper' },
  { id: 'flooring', label: 'Flooring' },
  { id: 'other', label: 'Other' },
]
