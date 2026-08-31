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

export type ItemUnit = 'sqft' | 'rft' | 'nos' | 'lump-sum'

export interface RoomItem {
  id: string
  name: string
  category: string
  unit: ItemUnit
  quantity: number
  rate: number
  notes?: string
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
