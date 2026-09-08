// Authentication + workspace + cloud-bootstrap orchestration.
//
// When Supabase isn't configured (no VITE_SUPABASE_URL/KEY), `init()`
// resolves immediately to a 'local-only' status and nothing else in this
// file ever runs — the entire app behaves exactly as it did before this
// milestone. This is deliberate: it's what keeps every existing feature and
// test working with zero Supabase credentials, per this milestone's
// explicit backward-compatibility requirement.

import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured } from '@/supabase/client'
import {
  onAuthStateChange,
  requestPasswordReset as requestPasswordResetApi,
  signInWithPassword,
  signOut as signOutApi,
  signUpWithPassword,
  updatePassword as updatePasswordApi,
  getCurrentSession,
} from '@/supabase/auth'
import { getDefaultWorkspace, isWorkspaceEmpty } from '@/supabase/repositories/workspaces'
import { setLocalNamespace } from '@/supabase/localNamespace'
import { setActiveWorkspaceId } from '@/supabase/activeWorkspace'
import { setSyncEnabled } from '@/supabase/sync/syncQueue'
import { bootstrapFromCloud } from '@/supabase/sync/cloudBootstrap'
import { migrateLocalDataToCloud, summarizeLocalData } from '@/supabase/sync/migrateLocalData'
import type { LocalDataSummary } from '@/supabase/sync/migrateLocalData'
import { useAppStore } from './useAppStore'

export type AuthStatus = 'loading' | 'local-only' | 'signed-out' | 'signed-in'

interface AuthState {
  status: AuthStatus
  user: User | null
  workspaceId: string | null
  cloudEnabled: boolean
  /** Set only right after a first cloud sign-in when the workspace is empty and there's local data worth offering to migrate — the UI shows a confirm prompt and calls confirmMigration()/skipMigration(). */
  pendingMigration: LocalDataSummary | null
  authError: string | null

  init: () => Promise<void>
  signUp: (email: string, password: string, fullName?: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  updatePassword: (newPassword: string) => Promise<void>
  confirmMigration: () => Promise<void>
  skipMigration: () => Promise<void>
  clearAuthError: () => void
}

let unsubscribeAuth: (() => void) | null = null
let bootstrappedWorkspaceId: string | null = null

async function resolveWorkspaceWithRetry(userId: string) {
  // The default-workspace-creating trigger (see migrations/0001_init.sql)
  // runs synchronously on signup, but a profile fetch immediately after can
  // occasionally beat replication by a beat — a couple of short retries is
  // simpler and more robust than assuming ordering.
  for (let attempt = 0; attempt < 3; attempt++) {
    const workspace = await getDefaultWorkspace(userId)
    if (workspace) return workspace
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  return null
}

async function finishSignIn(workspaceId: string, userId: string) {
  setLocalNamespace(userId)
  setActiveWorkspaceId(workspaceId)
  await bootstrapFromCloud(workspaceId)
  bootstrappedWorkspaceId = workspaceId
  setSyncEnabled(true)
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  user: null,
  workspaceId: null,
  cloudEnabled: isSupabaseConfigured(),
  pendingMigration: null,
  authError: null,

  init: async () => {
    if (!isSupabaseConfigured()) {
      set({ status: 'local-only' })
      return
    }

    async function handleSession(session: Session | null) {
      if (!session?.user) {
        setLocalNamespace(null)
        setActiveWorkspaceId(null)
        setSyncEnabled(false)
        bootstrappedWorkspaceId = null
        useAppStore.getState().resetToLocalDefaults()
        set({ status: 'signed-out', user: null, workspaceId: null, pendingMigration: null })
        return
      }

      const workspace = await resolveWorkspaceWithRetry(session.user.id)
      if (!workspace) {
        set({ status: 'signed-out', user: session.user, workspaceId: null, authError: 'Could not load your workspace. Please try again.' })
        return
      }

      // Already bootstrapped this workspace this session (e.g. a token
      // refresh fired onAuthStateChange again) — nothing new to do.
      if (bootstrappedWorkspaceId === workspace.id) {
        set({ status: 'signed-in', user: session.user, workspaceId: workspace.id })
        return
      }

      const empty = await isWorkspaceEmpty(workspace.id)
      const localSummary = empty ? summarizeLocalData() : null
      if (localSummary?.hasAnything) {
        set({ status: 'signed-in', user: session.user, workspaceId: workspace.id, pendingMigration: localSummary })
        return
      }

      await finishSignIn(workspace.id, session.user.id)
      set({ status: 'signed-in', user: session.user, workspaceId: workspace.id, pendingMigration: null })
    }

    unsubscribeAuth?.()
    unsubscribeAuth = onAuthStateChange((session) => void handleSession(session))

    const session = await getCurrentSession()
    await handleSession(session)
  },

  signUp: async (email, password, fullName) => {
    set({ authError: null })
    try {
      await signUpWithPassword(email, password, fullName)
    } catch (err) {
      set({ authError: err instanceof Error ? err.message : 'Sign up failed' })
      throw err
    }
  },

  signIn: async (email, password) => {
    set({ authError: null })
    try {
      await signInWithPassword(email, password)
    } catch (err) {
      set({ authError: err instanceof Error ? err.message : 'Sign in failed' })
      throw err
    }
  },

  signOut: async () => {
    // Signs out of Supabase Auth only. This never touches cloud data — the
    // onAuthStateChange handler above resets *local* app state back to its
    // pre-cloud defaults, exactly like using AURA without an account.
    await signOutApi()
  },

  requestPasswordReset: async (email) => {
    set({ authError: null })
    try {
      await requestPasswordResetApi(email, `${window.location.origin}/reset-password`)
    } catch (err) {
      set({ authError: err instanceof Error ? err.message : 'Could not send reset email' })
      throw err
    }
  },

  updatePassword: async (newPassword) => {
    set({ authError: null })
    try {
      await updatePasswordApi(newPassword)
    } catch (err) {
      set({ authError: err instanceof Error ? err.message : 'Could not update password' })
      throw err
    }
  },

  confirmMigration: async () => {
    const { workspaceId, user } = get()
    if (!workspaceId || !user) return
    await migrateLocalDataToCloud(workspaceId)
    await finishSignIn(workspaceId, user.id)
    set({ pendingMigration: null })
  },

  skipMigration: async () => {
    const { workspaceId, user } = get()
    if (!workspaceId || !user) return
    await finishSignIn(workspaceId, user.id)
    set({ pendingMigration: null })
  },

  clearAuthError: () => set({ authError: null }),
}))
