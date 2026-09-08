// Plain generic-CRUD repositories for every flat business table. See
// generic.ts for what these actually do (thin upsert/delete/list wrappers).

import { makeRepository } from './generic'
import { supabase } from '../client'
import type {
  CatalogueItemRow,
  ClientRow,
  ProjectRow,
  QuotationItemRow,
  QuotationRow,
  RequirementRow,
  RoomItemRow,
  RoomRow,
} from '../types'

export const clientsRepo = makeRepository<ClientRow>('clients')
export const projectsRepo = makeRepository<ProjectRow>('projects')
export const roomsRepo = makeRepository<RoomRow>('rooms')
export const requirementsRepo = makeRepository<RequirementRow>('requirements')
export const catalogueItemsRepo = makeRepository<CatalogueItemRow>('catalogue_items')
export const roomItemsRepo = makeRepository<RoomItemRow>('room_items')
export const quotationsRepo = makeRepository<QuotationRow>('quotations')
export const quotationItemsRepo = makeRepository<QuotationItemRow>('quotation_items')

// A Room's requirements/items are pushed as "replace everything for this
// room" (delete-by-parent, then insert the current set) rather than a
// per-row diff — simple and correct for the row counts a design studio room
// actually has, and it means removing a requirement/item locally is
// reflected in one push instead of needing its own tracked delete.
export async function deleteRequirementsByRoom(roomId: string): Promise<void> {
  const { error } = await supabase.from('requirements').delete().eq('room_id', roomId)
  if (error) throw error
}

export async function deleteRoomItemsByRoom(roomId: string): Promise<void> {
  const { error } = await supabase.from('room_items').delete().eq('room_id', roomId)
  if (error) throw error
}

/** Same replace-everything approach as room requirements/items, applied to a quotation's line items. */
export async function deleteQuotationItemsByQuotation(quotationId: string): Promise<void> {
  const { error } = await supabase.from('quotation_items').delete().eq('quotation_id', quotationId)
  if (error) throw error
}
