// A single generic CRUD shape shared by every simple, flat table (clients,
// projects, rooms, requirements, catalogue_items, room_items, quotations,
// quotation_items). Tables with real special-casing (canvas_documents'
// upsert-by-view, site_photos'/local_references' Storage upload+delete) get
// their own small repository file instead of being forced through this.
//
// Kept intentionally dumb: no business logic, no pricing/BOQ math, no
// merge/conflict decisions — those stay in lib/pricing.ts, lib/quotation.ts,
// and src/supabase/sync/*. This layer only moves rows in and out.

import { supabase } from '../client'

export interface WorkspaceScopedRow {
  id: string
  workspace_id: string
}

export function makeRepository<Row extends WorkspaceScopedRow>(table: string) {
  return {
    async listByWorkspace(workspaceId: string): Promise<Row[]> {
      const { data, error } = await supabase.from(table).select('*').eq('workspace_id', workspaceId)
      if (error) throw error
      return (data ?? []) as unknown as Row[]
    },

    async upsert(row: Row): Promise<void> {
      const { error } = await supabase.from(table).upsert(row as never)
      if (error) throw error
    },

    async upsertMany(rows: Row[]): Promise<void> {
      if (rows.length === 0) return
      const { error } = await supabase.from(table).upsert(rows as never[])
      if (error) throw error
    },

    async remove(id: string): Promise<void> {
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) throw error
    },
  }
}
