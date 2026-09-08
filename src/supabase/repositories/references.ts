// Reference metadata repositories.
//
// drive_references: Google Drive stays the source of truth — this table
// (and this file) never touches file bytes, and removing a row here must
// never call the Drive API to delete the original file (that call doesn't
// exist anywhere in this codebase).
//
// local_references: a locally-uploaded reference image, stored in the same
// private "site-photos" bucket as Site Photos (see sitePhotos.ts) under its
// own path prefix — reusing the bucket/RLS rather than standing up a second
// one for what is, storage-wise, an identical use case.

import { makeRepository } from './generic'
import { supabase } from '../client'
import type { DriveReferenceRow, LocalReferenceRow } from '../types'

export const driveReferencesRepo = makeRepository<DriveReferenceRow>('drive_references')
export const localReferencesRepo = makeRepository<LocalReferenceRow>('local_references')

/** Looked up fresh so deletion always finds the real Storage object, even after a reload — same reasoning as sitePhotos.getSitePhotoStoragePath. */
export async function getLocalReferenceStoragePath(id: string): Promise<string | null> {
  const { data, error } = await supabase.from('local_references').select('storage_path').eq('id', id).maybeSingle()
  if (error) throw error
  return (data as { storage_path: string } | null)?.storage_path ?? null
}
