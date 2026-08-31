// Core domain types for Aura Interiors.
// Kept intentionally simple for V1 — pricing/BOQ/quotation engines build on top of these.

export type ClientStatus = 'active' | 'lead' | 'archived'

export interface Client {
  id: string
  name: string
  phone: string
  email: string
  address: string
  city: string
  status: ClientStatus
  avatarColor: string
  createdAt: string
  notes?: string
}

export type ProjectStatus =
  | 'draft'
  | 'in-progress'
  | 'quotation-sent'
  | 'approved'
  | 'completed'

export type ProjectType =
  | 'full-home'
  | 'apartment'
  | 'kitchen'
  | 'office'
  | 'single-room'
  | 'renovation'

export interface Project {
  id: string
  clientId: string
  name: string
  type: ProjectType
  status: ProjectStatus
  address: string
  budgetEstimate: number
  createdAt: string
  updatedAt: string
  targetDate?: string
  coverColor: string
  roomIds: string[]
  pricing: PricingConfig
}

export type RoomType =
  | 'living-room'
  | 'master-bedroom'
  | 'bedroom'
  | 'kitchen'
  | 'dining-room'
  | 'bathroom'
  | 'kids-room'
  | 'study'
  | 'foyer'
  | 'balcony'
  | 'utility'
  | 'pooja-room'

export interface RoomDimensions {
  lengthFt: number
  widthFt: number
  heightFt: number
}

export type MeasurementUnit = 'sqft' | 'rft' | 'nos' | 'lump-sum'

// A master catalogue entry — the studio's standard rate card. Project items
// reference a catalogue item by id but keep their own copy of everything
// (see RoomItem) so historical BOQs stay stable even if the catalogue changes.
export interface CatalogueItem {
  id: string
  name: string
  category: string
  subCategory?: string
  description?: string
  unit: MeasurementUnit
  defaultRate: number
  material?: string
  finish?: string
  brand?: string
  isActive: boolean
}

export interface RoomItem {
  id: string
  /** Links back to the catalogue entry this was added from; undefined for a fully custom item. */
  catalogueItemId?: string
  name: string
  category: string
  description?: string
  unit: MeasurementUnit
  quantity: number
  /** The catalogue's rate at the time this item was added — for comparison only, never edited here. */
  masterRate: number
  /** The rate actually billed for this project; defaults to masterRate but can be overridden per item. */
  rate: number
}

export type DiscountType = 'none' | 'percentage' | 'fixed'

// Configurable pricing rules for a project. Applied uniformly wherever a
// subtotal needs to become a billable total — see src/lib/pricing.ts.
export interface PricingConfig {
  markupPercent: number
  discountType: DiscountType
  discountValue: number
  taxRatePercent: number
}

export interface RoomRequirement {
  id: string
  label: string
  isChecked: boolean
}

export interface Room {
  id: string
  projectId: string
  type: RoomType
  name: string
  dimensions: RoomDimensions
  requirements: RoomRequirement[]
  items: RoomItem[]
  notes?: string
  isComplete: boolean
}

export interface RoomTypeOption {
  type: RoomType
  label: string
  icon: string
  defaultRequirements: string[]
}
