// Canvas documents are keyed by (room_id, view_id) — see the `unique
// (room_id, view_id)` constraint in migrations/0001_init.sql — so saving is
// always an upsert against that pair, never a plain insert. The document
// itself is stored exactly as the engine already serializes it to
// localStorage (see lib/canvasStorage.ts); this repository never inspects
// or reshapes its contents.

import { supabase } from '../client'
import type { CanvasDocumentRow } from '../types'

export async function upsertCanvasDocument(row: CanvasDocumentRow): Promise<void> {
  const { error } = await supabase.from('canvas_documents').upsert(row as never, { onConflict: 'room_id,view_id' })
  if (error) throw error
}

export async function listCanvasDocumentsByWorkspace(workspaceId: string): Promise<CanvasDocumentRow[]> {
  const { data, error } = await supabase.from('canvas_documents').select('*').eq('workspace_id', workspaceId)
  if (error) throw error
  return (data ?? []) as unknown as CanvasDocumentRow[]
}

export async function getCanvasDocument(roomId: string, viewId: string): Promise<CanvasDocumentRow | null> {
  const { data, error } = await supabase
    .from('canvas_documents')
    .select('*')
    .eq('room_id', roomId)
    .eq('view_id', viewId)
    .maybeSingle()
  if (error) throw error
  return (data as CanvasDocumentRow | null) ?? null
}
