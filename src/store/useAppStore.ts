import { create } from 'zustand'
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
  RoomItem,
  RoomRequirement,
  RoomType,
  SitePhoto,
} from '@/types'
import { SAMPLE_CLIENTS, SAMPLE_PROJECTS, SAMPLE_ROOMS } from '@/data/sampleData'
import { CATALOGUE_ITEMS } from '@/data/catalogue'
import { AURA_COMPANY_PROFILE } from '@/data/company'
import { DEFAULT_PAYMENT_MILESTONES, DEFAULT_TERMS_AND_CONDITIONS } from '@/data/quotationDefaults'
import { getRoomTypeOption } from '@/data/roomTypes'
import { buildProjectBoqLines } from '@/lib/pricing'
import { generateQuotationNumber } from '@/lib/quotation'
import { generateId } from '@/lib/id'
import { loadProjectMedia, saveProjectMedia } from '@/lib/projectMediaStorage'
import {
  deleteReferenceCloud,
  deleteRoomCloud,
  deleteSitePhotoCloud,
  pushCatalogueItem,
  pushClient,
  pushNewDriveReference,
  pushNewLocalReference,
  pushNewSitePhoto,
  pushProject,
  pushQuotation,
  pushRoom,
} from '@/supabase/sync/pushActions'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

// Small helpers so every room/quotation-mutating action can push its
// current (post-mutation) shape with one line, instead of repeating a
// get().rooms.find(...) + pushRoom(...) pair at each call site.
function syncRoomById(get: () => AppState, roomId: string): void {
  const room = get().rooms.find((r) => r.id === roomId)
  if (room) pushRoom(room)
}

function syncQuotationById(get: () => AppState, quotationId: string): void {
  const quotation = get().quotations.find((q) => q.id === quotationId)
  if (quotation) pushQuotation(quotation)
}

// Read once, synchronously, at module load — mirrors how Canvas documents are
// read synchronously on mount (see lib/canvasStorage.ts usage).
const initialProjectMedia = loadProjectMedia()

interface AppState {
  clients: Client[]
  projects: Project[]
  rooms: Room[]
  catalogueItems: CatalogueItem[]

  // Clients
  addClient: (client: Omit<Client, 'id' | 'createdAt'>) => Client

  // Projects
  addProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'roomIds'>) => Project
  updateProjectPricing: (projectId: string, updates: Partial<PricingConfig>) => void

  // Rooms
  addRoom: (projectId: string, type: RoomType, name?: string) => Room
  removeRoom: (roomId: string) => void
  updateRoomDimensions: (roomId: string, dimensions: Partial<Room['dimensions']>) => void
  toggleRequirement: (roomId: string, requirementId: string) => void
  addRequirement: (roomId: string, label: string) => void
  addItem: (roomId: string, item: Omit<RoomItem, 'id'>) => void
  updateItem: (roomId: string, itemId: string, updates: Partial<Omit<RoomItem, 'id'>>) => void
  removeItem: (roomId: string, itemId: string) => void
  markRoomComplete: (roomId: string, isComplete: boolean) => void

  // Catalogue
  addCatalogueItem: (item: Omit<CatalogueItem, 'id'>) => CatalogueItem
  updateCatalogueItem: (itemId: string, updates: Partial<Omit<CatalogueItem, 'id'>>) => void
  setCatalogueItemActive: (itemId: string, isActive: boolean) => void

  // Quotations
  quotations: Quotation[]
  createQuotationFromBoq: (projectId: string) => Quotation | undefined
  updateQuotation: (
    quotationId: string,
    updates: Partial<Omit<Quotation, 'id' | 'projectId' | 'clientId' | 'items' | 'createdAt'>>,
  ) => void
  updateQuotationItem: (
    quotationId: string,
    itemId: string,
    updates: Partial<Omit<QuotationItem, 'id'>>,
  ) => void
  setQuotationRoomIncluded: (quotationId: string, roomId: string, isIncluded: boolean) => void
  moveQuotationItem: (quotationId: string, itemId: string, direction: 'up' | 'down') => void

  // Project Media (Site Photos + References — see lib/projectMediaStorage.ts)
  sitePhotos: SitePhoto[]
  references: ProjectReference[]
  addSitePhotos: (
    projectId: string,
    photos: { dataUrl: string; roomId?: string; caption?: string }[],
  ) => void
  deleteSitePhoto: (photoId: string) => void
  addLocalReferences: (projectId: string, refs: { dataUrl: string; name: string }[]) => void
  addDriveReferences: (
    projectId: string,
    refs: Omit<DriveReference, 'id' | 'projectId' | 'source' | 'addedAt'>[],
  ) => void
  deleteReference: (referenceId: string) => void

  // Cloud sync (see src/supabase/sync) — pull-side hydration only; the push
  // side happens inline inside the actions above via src/supabase/sync/pushActions.ts.
  hydrateFromCloud: (data: {
    clients: Client[]
    projects: Project[]
    rooms: Room[]
    quotations: Quotation[]
    catalogueItems: CatalogueItem[]
  }) => void
  hydrateProjectMediaFromCloud: (sitePhotos: SitePhoto[], references: ProjectReference[]) => void
  resetToLocalDefaults: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  clients: SAMPLE_CLIENTS,
  projects: SAMPLE_PROJECTS,
  rooms: SAMPLE_ROOMS,
  quotations: [],
  catalogueItems: CATALOGUE_ITEMS,
  sitePhotos: initialProjectMedia.sitePhotos,
  references: initialProjectMedia.references,

  addClient: (client) => {
    const newClient: Client = {
      ...client,
      id: generateId('cl'),
      createdAt: new Date().toISOString().slice(0, 10),
    }
    set((state) => ({ clients: [newClient, ...state.clients] }))
    pushClient(newClient)
    return newClient
  },

  addProject: (project) => {
    const now = new Date().toISOString().slice(0, 10)
    const newProject: Project = {
      ...project,
      id: generateId('pr'),
      createdAt: now,
      updatedAt: now,
      roomIds: [],
    }
    set((state) => ({ projects: [newProject, ...state.projects] }))
    pushProject(newProject)
    return newProject
  },

  updateProjectPricing: (projectId, updates) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId ? { ...p, pricing: { ...p.pricing, ...updates } } : p,
      ),
    }))
    const updated = get().projects.find((p) => p.id === projectId)
    if (updated) pushProject(updated)
  },

  addRoom: (projectId, type, name) => {
    const option = getRoomTypeOption(type)
    const newRoom: Room = {
      id: generateId('rm'),
      projectId,
      type,
      name: name?.trim() || option.label,
      dimensions: { lengthFt: 0, widthFt: 0, heightFt: 10 },
      requirements: option.defaultRequirements.map((label) => ({
        id: generateId('req'),
        label,
        isChecked: false,
      })),
      items: [],
      isComplete: false,
    }
    set((state) => ({
      rooms: [...state.rooms, newRoom],
      projects: state.projects.map((p) =>
        p.id === projectId ? { ...p, roomIds: [...p.roomIds, newRoom.id], updatedAt: new Date().toISOString().slice(0, 10) } : p,
      ),
    }))
    pushRoom(newRoom)
    return newRoom
  },

  removeRoom: (roomId) => {
    set((state) => ({
      rooms: state.rooms.filter((r) => r.id !== roomId),
      projects: state.projects.map((p) => ({
        ...p,
        roomIds: p.roomIds.filter((id) => id !== roomId),
      })),
    }))
    deleteRoomCloud(roomId)
  },

  updateRoomDimensions: (roomId, dimensions) => {
    set((state) => ({
      rooms: state.rooms.map((r) =>
        r.id === roomId ? { ...r, dimensions: { ...r.dimensions, ...dimensions } } : r,
      ),
    }))
    syncRoomById(get, roomId)
  },

  toggleRequirement: (roomId, requirementId) => {
    set((state) => ({
      rooms: state.rooms.map((r) =>
        r.id === roomId
          ? {
              ...r,
              requirements: r.requirements.map((req: RoomRequirement) =>
                req.id === requirementId ? { ...req, isChecked: !req.isChecked } : req,
              ),
            }
          : r,
      ),
    }))
    syncRoomById(get, roomId)
  },

  addRequirement: (roomId, label) => {
    if (!label.trim()) return
    set((state) => ({
      rooms: state.rooms.map((r) =>
        r.id === roomId
          ? {
              ...r,
              requirements: [
                ...r.requirements,
                { id: generateId('req'), label: label.trim(), isChecked: true },
              ],
            }
          : r,
      ),
    }))
    syncRoomById(get, roomId)
  },

  addItem: (roomId, item) => {
    set((state) => ({
      rooms: state.rooms.map((r) =>
        r.id === roomId
          ? { ...r, items: [...r.items, { ...item, id: generateId('it') }] }
          : r,
      ),
    }))
    syncRoomById(get, roomId)
  },

  updateItem: (roomId, itemId, updates) => {
    set((state) => ({
      rooms: state.rooms.map((r) =>
        r.id === roomId
          ? {
              ...r,
              items: r.items.map((it) => (it.id === itemId ? { ...it, ...updates } : it)),
            }
          : r,
      ),
    }))
    syncRoomById(get, roomId)
  },

  removeItem: (roomId, itemId) => {
    set((state) => ({
      rooms: state.rooms.map((r) =>
        r.id === roomId ? { ...r, items: r.items.filter((it) => it.id !== itemId) } : r,
      ),
    }))
    syncRoomById(get, roomId)
  },

  markRoomComplete: (roomId, isComplete) => {
    set((state) => ({
      rooms: state.rooms.map((r) => (r.id === roomId ? { ...r, isComplete } : r)),
    }))
    syncRoomById(get, roomId)
  },

  addCatalogueItem: (item) => {
    const newItem: CatalogueItem = { ...item, id: generateId('cat') }
    set((state) => ({ catalogueItems: [newItem, ...state.catalogueItems] }))
    pushCatalogueItem(newItem)
    return newItem
  },

  updateCatalogueItem: (itemId, updates) => {
    set((state) => ({
      catalogueItems: state.catalogueItems.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item,
      ),
    }))
    const updated = get().catalogueItems.find((item) => item.id === itemId)
    if (updated) pushCatalogueItem(updated)
  },

  setCatalogueItemActive: (itemId, isActive) => {
    set((state) => ({
      catalogueItems: state.catalogueItems.map((item) =>
        item.id === itemId ? { ...item, isActive } : item,
      ),
    }))
    const updated = get().catalogueItems.find((item) => item.id === itemId)
    if (updated) pushCatalogueItem(updated)
  },

  createQuotationFromBoq: (projectId) => {
    const state = get()
    const project = state.projects.find((p) => p.id === projectId)
    if (!project) return undefined
    const rooms = state.rooms.filter((r) => r.projectId === projectId)
    const lines = buildProjectBoqLines(rooms, project.pricing)
    if (lines.length === 0) return undefined

    const client = state.clients.find((c) => c.id === project.clientId)
    const now = new Date()
    const issueDate = todayIso()
    const validUntilDate = new Date(now)
    validUntilDate.setDate(validUntilDate.getDate() + 30)
    const validUntil = validUntilDate.toISOString().slice(0, 10)

    const items: QuotationItem[] = lines.map((line) => ({
      id: generateId('qi'),
      roomId: line.roomId,
      roomName: line.roomName,
      sourceItemId: line.itemId,
      category: line.category,
      name: line.name,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      rate: line.rate,
      sourceRate: line.rate,
      isIncluded: true,
      isOptional: false,
    }))

    const quotation: Quotation = {
      id: generateId('qt'),
      projectId,
      clientId: project.clientId,
      quotationNumber: generateQuotationNumber(state.quotations, now),
      revision: 1,
      status: 'draft',
      issueDate,
      validUntil,
      clientName: client?.name ?? 'Client',
      projectName: project.name,
      projectLocation: project.address,
      company: { ...AURA_COMPANY_PROFILE },
      items,
      pricing: { ...project.pricing },
      paymentMilestones: DEFAULT_PAYMENT_MILESTONES.map((m) => ({ ...m, id: generateId('pm') })),
      termsAndConditions: [...DEFAULT_TERMS_AND_CONDITIONS],
      notes: '',
      createdAt: issueDate,
      updatedAt: issueDate,
    }

    set((s) => ({ quotations: [quotation, ...s.quotations] }))
    pushQuotation(quotation)
    return quotation
  },

  updateQuotation: (quotationId, updates) => {
    set((state) => ({
      quotations: state.quotations.map((q) =>
        q.id === quotationId ? { ...q, ...updates, updatedAt: todayIso() } : q,
      ),
    }))
    syncQuotationById(get, quotationId)
  },

  updateQuotationItem: (quotationId, itemId, updates) => {
    set((state) => ({
      quotations: state.quotations.map((q) =>
        q.id === quotationId
          ? {
              ...q,
              items: q.items.map((item) => (item.id === itemId ? { ...item, ...updates } : item)),
              updatedAt: todayIso(),
            }
          : q,
      ),
    }))
    syncQuotationById(get, quotationId)
  },

  setQuotationRoomIncluded: (quotationId, roomId, isIncluded) => {
    set((state) => ({
      quotations: state.quotations.map((q) =>
        q.id === quotationId
          ? {
              ...q,
              items: q.items.map((item) => (item.roomId === roomId ? { ...item, isIncluded } : item)),
              updatedAt: todayIso(),
            }
          : q,
      ),
    }))
    syncQuotationById(get, quotationId)
  },

  moveQuotationItem: (quotationId, itemId, direction) => {
    set((state) => ({
      quotations: state.quotations.map((q) => {
        if (q.id !== quotationId) return q
        const index = q.items.findIndex((item) => item.id === itemId)
        const targetIndex = direction === 'up' ? index - 1 : index + 1
        if (index === -1 || targetIndex < 0 || targetIndex >= q.items.length) return q
        const items = [...q.items]
        ;[items[index], items[targetIndex]] = [items[targetIndex], items[index]]
        return { ...q, items, updatedAt: todayIso() }
      }),
    }))
    syncQuotationById(get, quotationId)
  },

  addSitePhotos: (projectId, photos) => {
    const now = new Date().toISOString()
    const newPhotos: SitePhoto[] = photos.map((p) => ({
      id: generateId('sp'),
      projectId,
      roomId: p.roomId,
      dataUrl: p.dataUrl,
      caption: p.caption,
      createdAt: now,
    }))
    set((state) => {
      const sitePhotos = [...newPhotos, ...state.sitePhotos]
      saveProjectMedia({ sitePhotos, references: state.references })
      return { sitePhotos }
    })
    newPhotos.forEach(pushNewSitePhoto)
  },

  deleteSitePhoto: (photoId) => {
    set((state) => {
      const sitePhotos = state.sitePhotos.filter((p) => p.id !== photoId)
      saveProjectMedia({ sitePhotos, references: state.references })
      return { sitePhotos }
    })
    deleteSitePhotoCloud(photoId)
  },

  addLocalReferences: (projectId, refs) => {
    const now = new Date().toISOString()
    const newRefs: LocalReference[] = refs.map((r) => ({
      id: generateId('rf'),
      projectId,
      source: 'local',
      dataUrl: r.dataUrl,
      name: r.name,
      addedAt: now,
    }))
    set((state) => {
      const references = [...newRefs, ...state.references]
      saveProjectMedia({ sitePhotos: state.sitePhotos, references })
      return { references }
    })
    newRefs.forEach(pushNewLocalReference)
  },

  addDriveReferences: (projectId, refs) => {
    const now = new Date().toISOString()
    const newRefs: DriveReference[] = refs.map((r) => ({
      ...r,
      id: generateId('rf'),
      projectId,
      source: 'drive',
      addedAt: now,
    }))
    set((state) => {
      const references = [...newRefs, ...state.references]
      saveProjectMedia({ sitePhotos: state.sitePhotos, references })
      return { references }
    })
    newRefs.forEach(pushNewDriveReference)
  },

  deleteReference: (referenceId) => {
    // Removes AURA's reference record only — for a Drive reference, the
    // original file in Google Drive is never touched by this action.
    const removed = get().references.find((r) => r.id === referenceId)
    set((state) => {
      const references = state.references.filter((r) => r.id !== referenceId)
      saveProjectMedia({ sitePhotos: state.sitePhotos, references })
      return { references }
    })
    if (removed) deleteReferenceCloud(removed)
  },

  hydrateFromCloud: ({ clients, projects, rooms, quotations, catalogueItems }) => {
    set({ clients, projects, rooms, quotations, catalogueItems })
  },

  hydrateProjectMediaFromCloud: (sitePhotos, references) => {
    set({ sitePhotos, references })
    saveProjectMedia({ sitePhotos, references })
  },

  resetToLocalDefaults: () => {
    set({
      clients: SAMPLE_CLIENTS,
      projects: SAMPLE_PROJECTS,
      rooms: SAMPLE_ROOMS,
      quotations: [],
      catalogueItems: CATALOGUE_ITEMS,
      ...loadProjectMedia(),
    })
  },
}))

export function roomArea(room: Room): number {
  return room.dimensions.lengthFt * room.dimensions.widthFt
}
