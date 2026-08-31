import { create } from 'zustand'
import type { Client, Project, Room, RoomItem, RoomRequirement, RoomType } from '@/types'
import { SAMPLE_CLIENTS, SAMPLE_PROJECTS, SAMPLE_ROOMS } from '@/data/sampleData'
import { getRoomTypeOption } from '@/data/roomTypes'
import { generateId } from '@/lib/id'

interface AppState {
  clients: Client[]
  projects: Project[]
  rooms: Room[]

  // Clients
  addClient: (client: Omit<Client, 'id' | 'createdAt'>) => Client

  // Projects
  addProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'roomIds'>) => Project

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
}

export const useAppStore = create<AppState>((set) => ({
  clients: SAMPLE_CLIENTS,
  projects: SAMPLE_PROJECTS,
  rooms: SAMPLE_ROOMS,

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
}))

export function roomTotal(room: Room): number {
  return room.items.reduce((sum, item) => sum + item.quantity * item.rate, 0)
}

export function projectTotal(rooms: Room[]): number {
  return rooms.reduce((sum, room) => sum + roomTotal(room), 0)
}

export function roomArea(room: Room): number {
  return room.dimensions.lengthFt * room.dimensions.widthFt
}
