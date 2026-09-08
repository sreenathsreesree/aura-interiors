// Row <-> app-domain-type conversions, used by both cloud bootstrap (pull)
// and the sync queue (push). Deliberately dumb field mapping only — no
// pricing/BOQ/quotation math happens here; those numbers are computed by
// lib/pricing.ts / lib/quotation.ts from the same fields these mappers move
// around unchanged.

import type {
  CatalogueItem,
  Client,
  DriveReference,
  LocalReference,
  PricingConfig,
  Project,
  ProjectReference,
  Quotation,
  QuotationItem,
  Room,
  RoomDimensions,
  RoomItem,
  RoomRequirement,
  SitePhoto,
} from '@/types'
import type { CanvasDocument } from '@/types/canvas'
import type {
  CanvasDocumentRow,
  CatalogueItemRow,
  ClientRow,
  DriveReferenceRow,
  LocalReferenceRow,
  ProjectRow,
  QuotationItemRow,
  QuotationRow,
  RequirementRow,
  RoomItemRow,
  RoomRow,
  SitePhotoRow,
} from '../types'

// ---------------------------------------------------------------- Clients

export function clientToRow(client: Client, workspaceId: string): ClientRow {
  return {
    id: client.id,
    workspace_id: workspaceId,
    name: client.name,
    phone: client.phone,
    email: client.email,
    address: client.address,
    city: client.city,
    status: client.status,
    avatar_color: client.avatarColor,
    notes: client.notes ?? null,
    created_at: client.createdAt,
    updated_at: new Date().toISOString(),
  }
}

export function rowToClient(row: ClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    city: row.city,
    status: row.status as Client['status'],
    avatarColor: row.avatar_color,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  }
}

// ---------------------------------------------------------------- Projects

export function projectToRow(project: Project, workspaceId: string): ProjectRow {
  return {
    id: project.id,
    workspace_id: workspaceId,
    client_id: project.clientId,
    name: project.name,
    type: project.type,
    status: project.status,
    address: project.address,
    budget_estimate: project.budgetEstimate,
    target_date: project.targetDate ?? null,
    cover_color: project.coverColor,
    pricing: project.pricing as unknown as Record<string, unknown>,
    created_at: project.createdAt,
    updated_at: project.updatedAt,
  }
}

export function rowToProject(row: ProjectRow, roomIds: string[]): Project {
  return {
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    type: row.type as Project['type'],
    status: row.status as Project['status'],
    address: row.address,
    budgetEstimate: Number(row.budget_estimate),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    targetDate: row.target_date ?? undefined,
    coverColor: row.cover_color,
    roomIds,
    pricing: row.pricing as unknown as PricingConfig,
  }
}

// ---------------------------------------------------------------- Rooms + requirements + items

export function roomToRow(room: Room, workspaceId: string): RoomRow {
  return {
    id: room.id,
    workspace_id: workspaceId,
    project_id: room.projectId,
    type: room.type,
    name: room.name,
    dimensions: room.dimensions as unknown as Record<string, unknown>,
    notes: room.notes ?? null,
    is_complete: room.isComplete,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

export function rowToRoom(
  row: RoomRow,
  requirements: RoomRequirement[],
  items: RoomItem[],
): Room {
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type as Room['type'],
    name: row.name,
    dimensions: row.dimensions as unknown as RoomDimensions,
    requirements,
    items,
    notes: row.notes ?? undefined,
    isComplete: row.is_complete,
  }
}

export function requirementToRow(
  requirement: RoomRequirement,
  roomId: string,
  workspaceId: string,
  sortOrder: number,
): RequirementRow {
  return {
    id: requirement.id,
    workspace_id: workspaceId,
    room_id: roomId,
    label: requirement.label,
    is_checked: requirement.isChecked,
    sort_order: sortOrder,
    created_at: new Date().toISOString(),
  }
}

export function rowToRequirement(row: RequirementRow): RoomRequirement {
  return { id: row.id, label: row.label, isChecked: row.is_checked }
}

export function roomItemToRow(item: RoomItem, roomId: string, workspaceId: string): RoomItemRow {
  return {
    id: item.id,
    workspace_id: workspaceId,
    room_id: roomId,
    catalogue_item_id: item.catalogueItemId ?? null,
    name: item.name,
    category: item.category,
    description: item.description ?? null,
    unit: item.unit,
    quantity: item.quantity,
    master_rate: item.masterRate,
    rate: item.rate,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

export function rowToRoomItem(row: RoomItemRow): RoomItem {
  return {
    id: row.id,
    catalogueItemId: row.catalogue_item_id ?? undefined,
    name: row.name,
    category: row.category,
    description: row.description ?? undefined,
    unit: row.unit as RoomItem['unit'],
    quantity: Number(row.quantity),
    masterRate: Number(row.master_rate),
    rate: Number(row.rate),
  }
}

// ---------------------------------------------------------------- Catalogue

export function catalogueItemToRow(item: CatalogueItem, workspaceId: string): CatalogueItemRow {
  return {
    id: item.id,
    workspace_id: workspaceId,
    name: item.name,
    category: item.category,
    sub_category: item.subCategory ?? null,
    description: item.description ?? null,
    unit: item.unit,
    default_rate: item.defaultRate,
    material: item.material ?? null,
    finish: item.finish ?? null,
    brand: item.brand ?? null,
    is_active: item.isActive,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

export function rowToCatalogueItem(row: CatalogueItemRow): CatalogueItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    subCategory: row.sub_category ?? undefined,
    description: row.description ?? undefined,
    unit: row.unit as CatalogueItem['unit'],
    defaultRate: Number(row.default_rate),
    material: row.material ?? undefined,
    finish: row.finish ?? undefined,
    brand: row.brand ?? undefined,
    isActive: row.is_active,
  }
}

// ---------------------------------------------------------------- Quotations

export function quotationToRow(quotation: Quotation, workspaceId: string): QuotationRow {
  return {
    id: quotation.id,
    workspace_id: workspaceId,
    project_id: quotation.projectId,
    client_id: quotation.clientId,
    quotation_number: quotation.quotationNumber,
    revision: quotation.revision,
    status: quotation.status,
    issue_date: quotation.issueDate,
    valid_until: quotation.validUntil,
    client_name: quotation.clientName,
    project_name: quotation.projectName,
    project_location: quotation.projectLocation,
    company: quotation.company as unknown as Record<string, unknown>,
    pricing: quotation.pricing as unknown as Record<string, unknown>,
    payment_milestones: quotation.paymentMilestones as unknown as unknown[],
    terms_and_conditions: quotation.termsAndConditions as unknown as unknown[],
    notes: quotation.notes,
    created_at: quotation.createdAt,
    updated_at: quotation.updatedAt,
  }
}

export function rowToQuotation(row: QuotationRow, items: QuotationItem[]): Quotation {
  return {
    id: row.id,
    projectId: row.project_id,
    clientId: row.client_id,
    quotationNumber: row.quotation_number,
    revision: row.revision,
    status: row.status as Quotation['status'],
    issueDate: row.issue_date,
    validUntil: row.valid_until,
    clientName: row.client_name,
    projectName: row.project_name,
    projectLocation: row.project_location,
    company: row.company as unknown as Quotation['company'],
    items,
    pricing: row.pricing as unknown as PricingConfig,
    paymentMilestones: row.payment_milestones as unknown as Quotation['paymentMilestones'],
    termsAndConditions: row.terms_and_conditions as unknown as string[],
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function quotationItemToRow(
  item: QuotationItem,
  quotationId: string,
  workspaceId: string,
  sortOrder: number,
): QuotationItemRow {
  return {
    id: item.id,
    workspace_id: workspaceId,
    quotation_id: quotationId,
    room_id: item.roomId,
    room_name: item.roomName,
    source_item_id: item.sourceItemId,
    category: item.category,
    name: item.name,
    description: item.description ?? null,
    quantity: item.quantity,
    unit: item.unit,
    rate: item.rate,
    source_rate: item.sourceRate,
    is_included: item.isIncluded,
    is_optional: item.isOptional,
    sort_order: sortOrder,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

export function rowToQuotationItem(row: QuotationItemRow): QuotationItem {
  return {
    id: row.id,
    roomId: row.room_id ?? '',
    roomName: row.room_name,
    sourceItemId: row.source_item_id ?? '',
    category: row.category,
    name: row.name,
    description: row.description ?? undefined,
    quantity: Number(row.quantity),
    unit: row.unit as QuotationItem['unit'],
    rate: Number(row.rate),
    sourceRate: Number(row.source_rate),
    isIncluded: row.is_included,
    isOptional: row.is_optional,
  }
}

// ---------------------------------------------------------------- Canvas

export function canvasDocumentToRow(doc: CanvasDocument, workspaceId: string): CanvasDocumentRow {
  return {
    id: doc.id,
    workspace_id: workspaceId,
    project_id: doc.projectId,
    room_id: doc.roomId,
    view_id: doc.viewId ?? 'plan',
    document: doc as unknown as Record<string, unknown>,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }
}

export function rowToCanvasDocument(row: CanvasDocumentRow): CanvasDocument {
  return row.document as unknown as CanvasDocument
}

// ---------------------------------------------------------------- Media

export function sitePhotoToRow(
  photo: SitePhoto,
  workspaceId: string,
  storagePath: string,
  filename: string,
  mimeType: string,
  fileSize?: number,
): SitePhotoRow {
  return {
    id: photo.id,
    workspace_id: workspaceId,
    project_id: photo.projectId,
    room_id: photo.roomId ?? null,
    storage_path: storagePath,
    filename,
    mime_type: mimeType,
    file_size: fileSize ?? null,
    caption: photo.caption ?? null,
    created_at: photo.createdAt,
    updated_at: photo.createdAt,
  }
}

export function rowToSitePhoto(row: SitePhotoRow, dataUrl: string): SitePhoto {
  return {
    id: row.id,
    projectId: row.project_id,
    roomId: row.room_id ?? undefined,
    dataUrl,
    caption: row.caption ?? undefined,
    createdAt: row.created_at,
  }
}

export function driveReferenceToRow(ref: DriveReference, workspaceId: string): DriveReferenceRow {
  return {
    id: ref.id,
    workspace_id: workspaceId,
    project_id: ref.projectId,
    room_id: null,
    drive_file_id: ref.driveFileId,
    name: ref.name,
    mime_type: ref.mimeType,
    thumbnail_link: ref.thumbnailLink ?? null,
    preview_link: ref.previewLink ?? null,
    web_view_link: ref.webViewLink ?? null,
    icon_link: ref.iconLink ?? null,
    created_at: ref.addedAt,
    updated_at: ref.addedAt,
  }
}

export function rowToDriveReference(row: DriveReferenceRow): DriveReference {
  return {
    id: row.id,
    projectId: row.project_id,
    source: 'drive',
    driveFileId: row.drive_file_id,
    name: row.name,
    mimeType: row.mime_type,
    thumbnailLink: row.thumbnail_link ?? undefined,
    previewLink: row.preview_link ?? undefined,
    webViewLink: row.web_view_link ?? undefined,
    iconLink: row.icon_link ?? undefined,
    addedAt: row.created_at,
  }
}

export function localReferenceToRow(
  ref: LocalReference,
  workspaceId: string,
  storagePath: string,
  mimeType: string,
): LocalReferenceRow {
  return {
    id: ref.id,
    workspace_id: workspaceId,
    project_id: ref.projectId,
    storage_path: storagePath,
    name: ref.name,
    mime_type: mimeType,
    created_at: ref.addedAt,
    updated_at: ref.addedAt,
  }
}

export function rowToLocalReference(row: LocalReferenceRow, dataUrl: string): LocalReference {
  return {
    id: row.id,
    projectId: row.project_id,
    source: 'local',
    dataUrl,
    name: row.name,
    addedAt: row.created_at,
  }
}

export function isLocalReference(ref: ProjectReference): ref is LocalReference {
  return ref.source === 'local'
}
