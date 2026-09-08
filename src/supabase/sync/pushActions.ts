// The push (local -> cloud) half of sync, called from useAppStore actions
// right after each local mutation. Every function here is a safe no-op when
// signed out or Supabase isn't configured, so call sites never need their
// own guard — this keeps useAppStore's actions readable (one extra line,
// not an `if` block) while the actual cloud/no-cloud decision lives in one
// place.

import type { CatalogueItem, Client, DriveReference, LocalReference, Project, Quotation, Room, SitePhoto } from '@/types'
import type { CanvasDocument } from '@/types/canvas'
import { isSupabaseConfigured } from '../client'
import { getActiveWorkspaceId } from '../activeWorkspace'
import { enqueueSync, flushSyncNow } from './syncQueue'
import { newUuid } from './ids'
import {
  catalogueItemsRepo,
  clientsRepo,
  deleteQuotationItemsByQuotation,
  deleteRequirementsByRoom,
  deleteRoomItemsByRoom,
  projectsRepo,
  quotationItemsRepo,
  quotationsRepo,
  requirementsRepo,
  roomItemsRepo,
  roomsRepo,
} from '../repositories/entities'
import { upsertCanvasDocument } from '../repositories/canvasDocuments'
import {
  deleteSitePhotoObject,
  getSitePhotoStoragePath,
  sitePhotoStoragePath,
  uploadSitePhotoObject,
  upsertSitePhotoMetadata,
  deleteSitePhotoMetadata,
} from '../repositories/sitePhotos'
import { driveReferencesRepo, getLocalReferenceStoragePath, localReferencesRepo } from '../repositories/references'
import {
  canvasDocumentToRow,
  catalogueItemToRow,
  clientToRow,
  driveReferenceToRow,
  localReferenceToRow,
  projectToRow,
  quotationItemToRow,
  quotationToRow,
  requirementToRow,
  roomItemToRow,
  roomToRow,
  sitePhotoToRow,
} from './mappers'

function ready(): string | null {
  if (!isSupabaseConfigured()) return null
  return getActiveWorkspaceId()
}

export function pushClient(client: Client): void {
  const workspaceId = ready()
  if (!workspaceId) return
  enqueueSync(`client:${client.id}`, () => clientsRepo.upsert(clientToRow(client, workspaceId)))
}

export function pushProject(project: Project): void {
  const workspaceId = ready()
  if (!workspaceId) return
  enqueueSync(`project:${project.id}`, () => projectsRepo.upsert(projectToRow(project, workspaceId)))
}

/** Pushes a Room plus a full replace of its requirements + items — see deleteRequirementsByRoom/deleteRoomItemsByRoom for why "replace" rather than diff. */
export function pushRoom(room: Room): void {
  const workspaceId = ready()
  if (!workspaceId) return
  enqueueSync(`room:${room.id}`, async () => {
    await roomsRepo.upsert(roomToRow(room, workspaceId))
    await deleteRequirementsByRoom(room.id)
    if (room.requirements.length > 0) {
      await requirementsRepo.upsertMany(
        room.requirements.map((req, i) => ({ ...requirementToRow(req, room.id, workspaceId, i), id: req.id })),
      )
    }
    await deleteRoomItemsByRoom(room.id)
    if (room.items.length > 0) {
      await roomItemsRepo.upsertMany(room.items.map((item) => roomItemToRow(item, room.id, workspaceId)))
    }
  })
}

export function deleteRoomCloud(roomId: string): void {
  const workspaceId = ready()
  if (!workspaceId) return
  flushSyncNow(`room:${roomId}`, () => roomsRepo.remove(roomId))
}

export function pushCatalogueItem(item: CatalogueItem): void {
  const workspaceId = ready()
  if (!workspaceId) return
  enqueueSync(`catalogue:${item.id}`, () => catalogueItemsRepo.upsert(catalogueItemToRow(item, workspaceId)))
}

/** Pushes a Quotation plus a full replace of its line items (same reasoning as pushRoom). */
export function pushQuotation(quotation: Quotation): void {
  const workspaceId = ready()
  if (!workspaceId) return
  enqueueSync(`quotation:${quotation.id}`, async () => {
    await quotationsRepo.upsert(quotationToRow(quotation, workspaceId))
    await deleteQuotationItemsByQuotation(quotation.id)
    if (quotation.items.length > 0) {
      await quotationItemsRepo.upsertMany(
        quotation.items.map((item, i) => ({ ...quotationItemToRow(item, quotation.id, workspaceId, i), id: item.id })),
      )
    }
  })
}

/** Canvas save-points (Save button, view switch, leaving the room) — always an immediate push, never debounced further, since the caller already decided this was a meaningful save moment. */
export function pushCanvasDocumentNow(doc: CanvasDocument): void {
  const workspaceId = ready()
  if (!workspaceId) return
  flushSyncNow(`canvas:${doc.roomId}:${doc.viewId ?? 'plan'}`, () => upsertCanvasDocument(canvasDocumentToRow(doc, workspaceId)))
}

function extensionForMime(mimeType: string): string {
  const map: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }
  return map[mimeType] ?? 'jpg'
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}

/** Uploads a freshly-added Site Photo's cached data URI to Storage and records its metadata — the local dataUrl-based entry is already visible immediately; this is the background half. */
export function pushNewSitePhoto(photo: SitePhoto): void {
  const workspaceId = ready()
  if (!workspaceId) return
  enqueueSync(`site-photo:${photo.id}`, async () => {
    const blob = await dataUrlToBlob(photo.dataUrl)
    const mimeType = blob.type || 'image/jpeg'
    const filename = `${newUuid()}.${extensionForMime(mimeType)}`
    const path = sitePhotoStoragePath(workspaceId, photo.projectId, filename)
    await uploadSitePhotoObject(path, blob, mimeType)
    await upsertSitePhotoMetadata(sitePhotoToRow(photo, workspaceId, path, filename, mimeType, blob.size))
  })
}

/** Deletes a Site Photo's AURA storage object + metadata row. The storage path is looked up fresh (never cached client-side) so this works even if the photo hasn't finished its background upload's local bookkeeping. */
export function deleteSitePhotoCloud(photoId: string): void {
  const workspaceId = ready()
  if (!workspaceId) return
  flushSyncNow(`site-photo:${photoId}`, async () => {
    const path = await getSitePhotoStoragePath(photoId)
    if (path) await deleteSitePhotoObject(path)
    await deleteSitePhotoMetadata(photoId)
  })
}

export function pushNewLocalReference(reference: LocalReference): void {
  const workspaceId = ready()
  if (!workspaceId) return
  enqueueSync(`reference:${reference.id}`, async () => {
    const blob = await dataUrlToBlob(reference.dataUrl)
    const mimeType = blob.type || 'image/jpeg'
    const filename = `${newUuid()}.${extensionForMime(mimeType)}`
    const path = sitePhotoStoragePath(workspaceId, reference.projectId, filename)
    await uploadSitePhotoObject(path, blob, mimeType)
    await localReferencesRepo.upsert(localReferenceToRow(reference, workspaceId, path, mimeType))
  })
}

export function pushNewDriveReference(reference: DriveReference): void {
  const workspaceId = ready()
  if (!workspaceId) return
  enqueueSync(`reference:${reference.id}`, () => driveReferencesRepo.upsert(driveReferenceToRow(reference, workspaceId)))
}

/**
 * Removes a reference from AURA's cloud records. For a local reference this
 * also deletes its Storage object (AURA owns that copy). For a Drive
 * reference this ONLY deletes AURA's metadata row — the Drive API is never
 * called, so the original file in the user's Google Drive is never touched.
 */
export function deleteReferenceCloud(reference: LocalReference | DriveReference): void {
  const workspaceId = ready()
  if (!workspaceId) return
  if (reference.source === 'local') {
    flushSyncNow(`reference:${reference.id}`, async () => {
      const path = await getLocalReferenceStoragePath(reference.id)
      if (path) await deleteSitePhotoObject(path)
      await localReferencesRepo.remove(reference.id)
    })
  } else {
    flushSyncNow(`reference:${reference.id}`, () => driveReferencesRepo.remove(reference.id))
  }
}
