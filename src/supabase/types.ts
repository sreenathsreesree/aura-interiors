// Hand-written row types matching supabase/migrations/0001_init.sql.
//
// These would normally be generated with `supabase gen types typescript`
// against a live project; without real credentials in this environment
// there is no live project to generate against, so they're written by hand
// to match the migration exactly. Regenerate (or hand-update) this file if
// the schema changes — see docs/SUPABASE_SETUP.md.

export interface WorkspaceRow {
  id: string
  name: string
  owner_id: string
  created_at: string
  updated_at: string
}

export type WorkspaceRole = 'owner' | 'admin' | 'member'

export interface WorkspaceMemberRow {
  workspace_id: string
  user_id: string
  role: WorkspaceRole
  created_at: string
}

export interface ProfileRow {
  id: string
  full_name: string | null
  default_workspace_id: string | null
  created_at: string
  updated_at: string
}

export interface ClientRow {
  id: string
  workspace_id: string
  name: string
  phone: string
  email: string
  address: string
  city: string
  status: string
  avatar_color: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ProjectRow {
  id: string
  workspace_id: string
  client_id: string
  name: string
  type: string
  status: string
  address: string
  budget_estimate: number
  target_date: string | null
  cover_color: string
  pricing: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface RoomRow {
  id: string
  workspace_id: string
  project_id: string
  type: string
  name: string
  dimensions: Record<string, unknown>
  notes: string | null
  is_complete: boolean
  created_at: string
  updated_at: string
}

export interface RequirementRow {
  id: string
  workspace_id: string
  room_id: string
  label: string
  is_checked: boolean
  sort_order: number
  created_at: string
}

export interface CatalogueItemRow {
  id: string
  workspace_id: string
  name: string
  category: string
  sub_category: string | null
  description: string | null
  unit: string
  default_rate: number
  material: string | null
  finish: string | null
  brand: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface RoomItemRow {
  id: string
  workspace_id: string
  room_id: string
  catalogue_item_id: string | null
  name: string
  category: string
  description: string | null
  unit: string
  quantity: number
  master_rate: number
  rate: number
  created_at: string
  updated_at: string
}

export interface QuotationRow {
  id: string
  workspace_id: string
  project_id: string
  client_id: string
  quotation_number: string
  revision: number
  status: string
  issue_date: string
  valid_until: string
  client_name: string
  project_name: string
  project_location: string
  company: Record<string, unknown>
  pricing: Record<string, unknown>
  payment_milestones: unknown[]
  terms_and_conditions: unknown[]
  notes: string
  created_at: string
  updated_at: string
}

export interface QuotationItemRow {
  id: string
  workspace_id: string
  quotation_id: string
  room_id: string | null
  room_name: string
  source_item_id: string | null
  category: string
  name: string
  description: string | null
  quantity: number
  unit: string
  rate: number
  source_rate: number
  is_included: boolean
  is_optional: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CanvasDocumentRow {
  id: string
  workspace_id: string
  project_id: string
  room_id: string
  view_id: string
  document: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface SitePhotoRow {
  id: string
  workspace_id: string
  project_id: string
  room_id: string | null
  storage_path: string
  filename: string
  mime_type: string
  file_size: number | null
  caption: string | null
  created_at: string
  updated_at: string
}

export interface DriveReferenceRow {
  id: string
  workspace_id: string
  project_id: string
  room_id: string | null
  drive_file_id: string
  name: string
  mime_type: string
  thumbnail_link: string | null
  preview_link: string | null
  web_view_link: string | null
  icon_link: string | null
  created_at: string
  updated_at: string
}

export interface LocalReferenceRow {
  id: string
  workspace_id: string
  project_id: string
  storage_path: string
  name: string
  mime_type: string
  created_at: string
  updated_at: string
}

// Minimal Database shape — just enough structure for supabase-js's generic
// client typing (table name -> Row/Insert/Update) without hand-maintaining
// every Insert/Update variant; repositories cast Partial<Row> at the edges.
type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row> }

export interface Database {
  public: {
    Tables: {
      workspaces: Table<WorkspaceRow>
      workspace_members: Table<WorkspaceMemberRow>
      profiles: Table<ProfileRow>
      clients: Table<ClientRow>
      projects: Table<ProjectRow>
      rooms: Table<RoomRow>
      requirements: Table<RequirementRow>
      catalogue_items: Table<CatalogueItemRow>
      room_items: Table<RoomItemRow>
      quotations: Table<QuotationRow>
      quotation_items: Table<QuotationItemRow>
      canvas_documents: Table<CanvasDocumentRow>
      site_photos: Table<SitePhotoRow>
      drive_references: Table<DriveReferenceRow>
      local_references: Table<LocalReferenceRow>
    }
  }
}
