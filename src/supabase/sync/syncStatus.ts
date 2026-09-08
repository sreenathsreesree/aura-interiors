// A tiny, dedicated store for the sync status indicator — kept separate
// from useAuthStore so any component can subscribe to just this without
// re-rendering on every auth-state change, and separate from useAppStore so
// sync plumbing never has to reach back into business-data state.

import { create } from 'zustand'

export type SyncStatus = 'disabled' | 'synced' | 'saving' | 'offline' | 'error'

interface SyncStatusState {
  status: SyncStatus
  lastError: string | null
  setStatus: (status: SyncStatus, error?: string) => void
}

export const useSyncStatusStore = create<SyncStatusState>((set) => ({
  status: 'disabled',
  lastError: null,
  setStatus: (status, error) => set({ status, lastError: error ?? null }),
}))

export function setSyncStatus(status: SyncStatus, error?: string): void {
  useSyncStatusStore.getState().setStatus(status, error)
}
