// First-cloud-login migration.
//
// The existing app has two kinds of "local data": business data
// (clients/projects/rooms/quotations), which today lives only in memory
// (useAppStore has no persistence — see store/useAppStore.ts) and Canvas /
// Project Media, which DO persist to localStorage. "Existing AURA data" for
// migration purposes is simply "whatever is currently loaded" — for a
// brand-new browser session that's the shipped sample dataset; for a studio
// that's been using AURA locally, it's whatever they've actually built.
// Either way this module never guesses or filters — it snapshots exactly
// what's in front of the user right now and lets them decide.
//
// IMPORTANT: call summarizeLocalData()/migrateLocalDataToCloud() BEFORE
// switching the local-storage namespace to the signed-in user (see
// useAuthStore.ts) — both read through the *current* (pre-switch,
// un-namespaced) local storage, which is where "existing local data" lives
// before any cloud account has ever signed in on this browser.

import { useAppStore } from '@/store/useAppStore'
import { listAllLocalCanvasDocuments } from '@/lib/canvasStorage'
import { loadProjectMedia } from '@/lib/projectMediaStorage'
import type { LocalReference } from '@/types'
import { clientsRepo, catalogueItemsRepo, projectsRepo, quotationItemsRepo, quotationsRepo, requirementsRepo, roomItemsRepo, roomsRepo } from '../repositories/entities'
import { upsertCanvasDocument } from '../repositories/canvasDocuments'
import { sitePhotoStoragePath, upsertSitePhotoMetadata, uploadSitePhotoObject } from '../repositories/sitePhotos'
import { driveReferencesRepo, localReferencesRepo } from '../repositories/references'
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
import { IdRemap, newUuid } from './ids'

export interface LocalDataSummary {
  clientCount: number
  projectCount: number
  roomCount: number
  quotationCount: number
  canvasDocumentCount: number
  sitePhotoCount: number
  referenceCount: number
  hasAnything: boolean
}

export function summarizeLocalData(): LocalDataSummary {
  const state = useAppStore.getState()
  const media = loadProjectMedia()
  const clientCount = state.clients.length
  const projectCount = state.projects.length
  const roomCount = state.rooms.length
  const quotationCount = state.quotations.length
  const canvasDocumentCount = listAllLocalCanvasDocuments().length
  const sitePhotoCount = media.sitePhotos.length
  const referenceCount = media.references.length
  return {
    clientCount,
    projectCount,
    roomCount,
    quotationCount,
    canvasDocumentCount,
    sitePhotoCount,
    referenceCount,
    hasAnything: clientCount + projectCount + roomCount + canvasDocumentCount + sitePhotoCount + referenceCount > 0,
  }
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}

function extensionForMime(mimeType: string): string {
  const map: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }
  return map[mimeType] ?? 'jpg'
}

/** Pushes the current local snapshot to the given (freshly-created, empty) workspace, minting fresh cloud UUIDs and remapping every cross-reference consistently. */
export async function migrateLocalDataToCloud(workspaceId: string): Promise<void> {
  const state = useAppStore.getState()
  const media = loadProjectMedia()
  const localCanvasDocs = listAllLocalCanvasDocuments()

  const clientIds = new IdRemap()
  const projectIds = new IdRemap()
  const roomIds = new IdRemap()
  const catalogueIds = new IdRemap()
  const quotationIds = new IdRemap()

  // Clients
  await clientsRepo.upsertMany(
    state.clients.map((client) => ({ ...clientToRow(client, workspaceId), id: clientIds.get(client.id) })),
  )

  // Catalogue (independent of projects)
  await catalogueItemsRepo.upsertMany(
    state.catalogueItems.map((item) => ({ ...catalogueItemToRow(item, workspaceId), id: catalogueIds.get(item.id) })),
  )

  // Projects
  await projectsRepo.upsertMany(
    state.projects.map((project) => ({
      ...projectToRow(project, workspaceId),
      id: projectIds.get(project.id),
      client_id: clientIds.get(project.clientId),
    })),
  )

  // Rooms
  await roomsRepo.upsertMany(
    state.rooms.map((room) => ({
      ...roomToRow(room, workspaceId),
      id: roomIds.get(room.id),
      project_id: projectIds.get(room.projectId),
    })),
  )

  // Requirements + room items (per room)
  const requirementRows = state.rooms.flatMap((room) =>
    room.requirements.map((req, i) => ({ ...requirementToRow(req, roomIds.get(room.id), workspaceId, i), id: newUuid() })),
  )
  if (requirementRows.length > 0) await requirementsRepo.upsertMany(requirementRows)

  const roomItemIds = new IdRemap()
  const roomItemRows = state.rooms.flatMap((room) =>
    room.items.map((item) => {
      const row = roomItemToRow(item, roomIds.get(room.id), workspaceId)
      return {
        ...row,
        id: roomItemIds.get(item.id),
        catalogue_item_id: item.catalogueItemId ? catalogueIds.get(item.catalogueItemId) : null,
      }
    }),
  )
  if (roomItemRows.length > 0) await roomItemsRepo.upsertMany(roomItemRows)

  // Quotations + items
  await quotationsRepo.upsertMany(
    state.quotations.map((quotation) => ({
      ...quotationToRow(quotation, workspaceId),
      id: quotationIds.get(quotation.id),
      project_id: projectIds.get(quotation.projectId),
      client_id: clientIds.get(quotation.clientId),
    })),
  )

  const quotationItemRows = state.quotations.flatMap((quotation) =>
    quotation.items.map((item, i) => {
      const row = quotationItemToRow(item, quotationIds.get(quotation.id), workspaceId, i)
      return {
        ...row,
        id: newUuid(),
        room_id: roomIds.getIfSeen(item.roomId) ?? null,
        source_item_id: roomItemIds.getIfSeen(item.sourceItemId) ?? null,
      }
    }),
  )
  if (quotationItemRows.length > 0) await quotationItemsRepo.upsertMany(quotationItemRows)

  // Canvas documents — only for rooms that exist in this snapshot (a stray
  // cached document for an already-deleted room is skipped rather than
  // pushed with a dangling reference).
  for (const doc of localCanvasDocs) {
    const cloudRoomId = roomIds.getIfSeen(doc.roomId)
    const cloudProjectId = projectIds.getIfSeen(doc.projectId)
    if (!cloudRoomId || !cloudProjectId) continue
    const row = canvasDocumentToRow(doc, workspaceId)
    await upsertCanvasDocument({ ...row, id: newUuid(), room_id: cloudRoomId, project_id: cloudProjectId })
  }

  // Site Photos — upload each cached data URI as a real Storage object.
  for (const photo of media.sitePhotos) {
    const cloudProjectId = projectIds.getIfSeen(photo.projectId)
    if (!cloudProjectId) continue
    const blob = await dataUrlToBlob(photo.dataUrl)
    const mimeType = blob.type || 'image/jpeg'
    const filename = `${newUuid()}.${extensionForMime(mimeType)}`
    const path = sitePhotoStoragePath(workspaceId, cloudProjectId, filename)
    await uploadSitePhotoObject(path, blob, mimeType)
    const row = sitePhotoToRow(photo, workspaceId, path, filename, mimeType, blob.size)
    await upsertSitePhotoMetadata({
      ...row,
      id: newUuid(),
      project_id: cloudProjectId,
      room_id: photo.roomId ? (roomIds.getIfSeen(photo.roomId) ?? null) : null,
    })
  }

  // References — local ones upload like Site Photos; Drive ones are
  // metadata-only (the image itself is never touched).
  for (const reference of media.references) {
    const cloudProjectId = projectIds.getIfSeen(reference.projectId)
    if (!cloudProjectId) continue
    if (reference.source === 'local') {
      await migrateLocalReference(reference, workspaceId, cloudProjectId)
    } else {
      await driveReferencesRepo.upsert({
        ...driveReferenceToRow(reference, workspaceId),
        id: newUuid(),
        project_id: cloudProjectId,
      })
    }
  }
}

async function migrateLocalReference(
  reference: LocalReference,
  workspaceId: string,
  cloudProjectId: string,
): Promise<void> {
  const blob = await dataUrlToBlob(reference.dataUrl)
  const mimeType = blob.type || 'image/jpeg'
  const filename = `${newUuid()}.${extensionForMime(mimeType)}`
  const path = sitePhotoStoragePath(workspaceId, cloudProjectId, filename)
  await uploadSitePhotoObject(path, blob, mimeType)
  await localReferencesRepo.upsert({
    ...localReferenceToRow(reference, workspaceId, path, mimeType),
    id: newUuid(),
    project_id: cloudProjectId,
  })
}
