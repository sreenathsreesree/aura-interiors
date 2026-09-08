// Site Photos live in the private "site-photos" Supabase Storage bucket
// (created by migrations/0001_init.sql) at
// "<workspace_id>/<project_id>/<generated-filename>" — the RLS policy on
// storage.objects checks that first path segment against the caller's
// workspace membership, so the path itself is part of the access-control
// design, not just an organizational convention.
//
// The bucket is private: there is no public URL. Viewing a photo always
// goes through a short-lived signed URL created by an authenticated call.

import { supabase } from '../client'
import type { SitePhotoRow } from '../types'

const BUCKET = 'site-photos'
const SIGNED_URL_TTL_SECONDS = 60 * 60 // 1 hour — long enough for a viewing session, never public/permanent.

export function sitePhotoStoragePath(workspaceId: string, projectId: string, filename: string): string {
  return `${workspaceId}/${projectId}/${filename}`
}

export async function uploadSitePhotoObject(path: string, blob: Blob, mimeType: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: mimeType,
    upsert: false,
  })
  if (error) throw error
}

export async function deleteSitePhotoObject(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw error
}

export async function getSitePhotoSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  if (error) return null
  return data?.signedUrl ?? null
}

export async function upsertSitePhotoMetadata(row: SitePhotoRow): Promise<void> {
  const { error } = await supabase.from('site_photos').upsert(row as never)
  if (error) throw error
}

export async function deleteSitePhotoMetadata(id: string): Promise<void> {
  const { error } = await supabase.from('site_photos').delete().eq('id', id)
  if (error) throw error
}

export async function listSitePhotosByWorkspace(workspaceId: string): Promise<SitePhotoRow[]> {
  const { data, error } = await supabase.from('site_photos').select('*').eq('workspace_id', workspaceId)
  if (error) throw error
  return (data ?? []) as unknown as SitePhotoRow[]
}

/** Looked up fresh (rather than cached client-side) so deletion always finds the real object to remove, even after a reload. */
export async function getSitePhotoStoragePath(id: string): Promise<string | null> {
  const { data, error } = await supabase.from('site_photos').select('storage_path').eq('id', id).maybeSingle()
  if (error) throw error
  return (data as { storage_path: string } | null)?.storage_path ?? null
}
