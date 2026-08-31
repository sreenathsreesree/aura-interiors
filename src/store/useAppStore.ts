import { create } from 'zustand'
import type {
  CatalogueItem,
  Client,
  PricingConfig,
  Project,
  Quotation,
  QuotationItem,
  Room,
  RoomItem,
  RoomRequirement,
  RoomType,
} from '@/types'
import { SAMPLE_CLIENTS, SAMPLE_PROJECTS, SAMPLE_ROOMS } from '@/data/sampleData'
import { CATALOGUE_ITEMS } from '@/data/catalogue'
import { AURA_COMPANY_PROFILE } from '@/data/company'
import { DEFAULT_PAYMENT_MILESTONES, DEFAULT_TERMS_AND_CONDITIONS } from '@/data/quotationDefaults'
import { getRoomTypeOption } from '@/data/roomTypes'
import { buildProjectBoqLines } from '@/lib/pricing'
import { generateQuotationNumber } from '@/lib/quotation'
import { generateId } from '@/lib/id'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

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
}

export const useAppStore = create<AppState>((set, get) => ({
  clients: SAMPLE_CLIENTS,
  projects: SAMPLE_PROJECTS,
  rooms: SAMPLE_ROOMS,
  quotations: [],
  catalogueItems: CATALOGUE_ITEMS,

  addClient: (client) => {
    const newClient: Client = {
      ...client,
      id: generateId('cl'),
      createdAt: new Date().toISOString().slice(0, 10),
    }
    set((state) => ({ clients: [newClient, ...state.clients] }))
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
    return newProject
  },

  updateProjectPricing: (projectId, updates) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId ? { ...p, pricing: { ...p.pricing, ...updates } } : p,
      ),
    }))
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
  },

  updateRoomDimensions: (roomId, dimensions) => {
    set((state) => ({
      rooms: state.rooms.map((r) =>
        r.id === roomId ? { ...r, dimensions: { ...r.dimensions, ...dimensions } } : r,
      ),
    }))
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
  },

  addItem: (roomId, item) => {
    set((state) => ({
      rooms: state.rooms.map((r) =>
        r.id === roomId
          ? { ...r, items: [...r.items, { ...item, id: generateId('it') }] }
          : r,
      ),
    }))
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
  },

  removeItem: (roomId, itemId) => {
    set((state) => ({
      rooms: state.rooms.map((r) =>
        r.id === roomId ? { ...r, items: r.items.filter((it) => it.id !== itemId) } : r,
      ),
    }))
  },

  markRoomComplete: (roomId, isComplete) => {
    set((state) => ({
      rooms: state.rooms.map((r) => (r.id === roomId ? { ...r, isComplete } : r)),
    }))
  },

  addCatalogueItem: (item) => {
    const newItem: CatalogueItem = { ...item, id: generateId('cat') }
    set((state) => ({ catalogueItems: [newItem, ...state.catalogueItems] }))
    return newItem
  },

  updateCatalogueItem: (itemId, updates) => {
    set((state) => ({
      catalogueItems: state.catalogueItems.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item,
      ),
    }))
  },

  setCatalogueItemActive: (itemId, isActive) => {
    set((state) => ({
      catalogueItems: state.catalogueItems.map((item) =>
        item.id === itemId ? { ...item, isActive } : item,
      ),
    }))
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
    return quotation
  },

  updateQuotation: (quotationId, updates) => {
    set((state) => ({
      quotations: state.quotations.map((q) =>
        q.id === quotationId ? { ...q, ...updates, updatedAt: todayIso() } : q,
      ),
    }))
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
  },
}))

export function roomArea(room: Room): number {
  return room.dimensions.lengthFt * room.dimensions.widthFt
}
