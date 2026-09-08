// Runs once right after sign-in (once a workspace is resolved): pulls every
// row belonging to that workspace and hydrates the existing local stores
// with it — useAppStore for business data, the Canvas/Project-Media
// localStorage caches (already namespaced per-user by this point, see
// localNamespace.ts) for everything else. This is the "cross-device sync:
// Device B signs in, receives Device A's changes" half of the milestone.
//
// Deliberately whole-collection reads (not paginated/incremental) — this
// milestone's data volumes are small (a design studio's clients/projects,
// not a multi-tenant SaaS at scale), and keeping this a single straight
// pull keeps the bootstrap logic easy to reason about.

import type { Client, LocalReference, Project, ProjectReference, Quotation, Room, SitePhoto } from '@/types'
import { useAppStore } from '@/store/useAppStore'
import { saveRoomCanvas } from '@/lib/canvasStorage'
import { clientsRepo, catalogueItemsRepo, projectsRepo, quotationItemsRepo, quotationsRepo, requirementsRepo, roomItemsRepo, roomsRepo } from '../repositories/entities'
import { listCanvasDocumentsByWorkspace } from '../repositories/canvasDocuments'
import { getSitePhotoSignedUrl, listSitePhotosByWorkspace } from '../repositories/sitePhotos'
import { driveReferencesRepo, localReferencesRepo } from '../repositories/references'
import {
  rowToCanvasDocument,
  rowToCatalogueItem,
  rowToClient,
  rowToDriveReference,
  rowToLocalReference,
  rowToProject,
  rowToQuotation,
  rowToQuotationItem,
  rowToRequirement,
  rowToRoom,
  rowToRoomItem,
  rowToSitePhoto,
} from './mappers'

export async function bootstrapFromCloud(workspaceId: string): Promise<void> {
  const [
    clientRows,
    projectRows,
    roomRows,
    requirementRows,
    roomItemRows,
    catalogueRows,
    quotationRows,
    quotationItemRows,
  ] = await Promise.all([
    clientsRepo.listByWorkspace(workspaceId),
    projectsRepo.listByWorkspace(workspaceId),
    roomsRepo.listByWorkspace(workspaceId),
    requirementsRepo.listByWorkspace(workspaceId),
    roomItemsRepo.listByWorkspace(workspaceId),
    catalogueItemsRepo.listByWorkspace(workspaceId),
    quotationsRepo.listByWorkspace(workspaceId),
    quotationItemsRepo.listByWorkspace(workspaceId),
  ])

  const clients: Client[] = clientRows.map(rowToClient)

  const rooms: Room[] = roomRows.map((roomRow) => {
    const requirements = requirementRows
      .filter((r) => r.room_id === roomRow.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(rowToRequirement)
    const items = roomItemRows.filter((i) => i.room_id === roomRow.id).map(rowToRoomItem)
    return rowToRoom(roomRow, requirements, items)
  })

  const projects: Project[] = projectRows.map((projectRow) => {
    const roomIds = rooms.filter((r) => r.projectId === projectRow.id).map((r) => r.id)
    return rowToProject(projectRow, roomIds)
  })

  const quotations: Quotation[] = quotationRows.map((quotationRow) => {
    const items = quotationItemRows
      .filter((i) => i.quotation_id === quotationRow.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(rowToQuotationItem)
    return rowToQuotation(quotationRow, items)
  })

  const catalogueItems = catalogueRows.map(rowToCatalogueItem)

  // Cloud data becomes the source of truth for business data once signed
  // in — this is a whole-collection replace, not a merge, which is the
  // "simple deterministic strategy" the milestone explicitly allows,
  // applied here to the read side (writes are addressed by the migration
  // flow separately, see migrateLocalData.ts).
  useAppStore.getState().hydrateFromCloud({ clients, projects, rooms, quotations, catalogueItems })

  // Canvas documents: write straight into the (already namespaced) local
  // cache so every existing page keeps reading through
  // lib/canvasStorage.ts's normal loadRoomCanvas()/getOrCreateRoomView()
  // path completely unchanged.
  const canvasRows = await listCanvasDocumentsByWorkspace(workspaceId)
  for (const row of canvasRows) {
    saveRoomCanvas(rowToCanvasDocument(row))
  }

  // Project Media: Site Photos need a signed URL per photo (private
  // bucket); Drive references need no network call at all (metadata only);
  // local references reuse the same signed-URL path as Site Photos.
  const [sitePhotoRows, driveRows, localRefRows] = await Promise.all([
    listSitePhotosByWorkspace(workspaceId),
    driveReferencesRepo.listByWorkspace(workspaceId),
    localReferencesRepo.listByWorkspace(workspaceId),
  ])

  const sitePhotos: SitePhoto[] = (
    await Promise.all(
      sitePhotoRows.map(async (row) => {
        const url = await getSitePhotoSignedUrl(row.storage_path)
        if (!url) return null
        return rowToSitePhoto(row, url)
      }),
    )
  ).filter((p): p is SitePhoto => p !== null)

  const localRefs: ProjectReference[] = (
    await Promise.all(
      localRefRows.map(async (row) => {
        const url = await getSitePhotoSignedUrl(row.storage_path)
        if (!url) return null
        return rowToLocalReference(row, url)
      }),
    )
  ).filter((r): r is LocalReference => r !== null)

  const driveRefs: ProjectReference[] = driveRows.map(rowToDriveReference)

  useAppStore.getState().hydrateProjectMediaFromCloud(sitePhotos, [...localRefs, ...driveRefs])
}
