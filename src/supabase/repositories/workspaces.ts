// Workspace lookup for the signed-in user. Workspace *creation* happens only
// via the handle_new_user() Postgres trigger (see migrations/0001_init.sql)
// — this file only ever reads.

import { supabase } from '../client'
import type { ProfileRow, WorkspaceMemberRow, WorkspaceRow } from '../types'

/** The signed-in user's default workspace, created automatically at signup. */
export async function getDefaultWorkspace(userId: string): Promise<WorkspaceRow | null> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (profileError) throw profileError
  const typedProfile = profile as ProfileRow | null

  const workspaceId = typedProfile?.default_workspace_id
  if (workspaceId) {
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .maybeSingle()
    if (workspaceError) throw workspaceError
    if (workspace) return workspace as WorkspaceRow
  }

  // Fallback: the profile row can lag the trigger by a beat right after
  // signup — fall back to the first workspace this user is a member of.
  const { data: membership, error: membershipError } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()
  if (membershipError) throw membershipError
  const typedMembership = membership as Pick<WorkspaceMemberRow, 'workspace_id'> | null
  if (!typedMembership) return null

  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', typedMembership.workspace_id)
    .maybeSingle()
  if (workspaceError) throw workspaceError
  return (workspace as WorkspaceRow | null) ?? null
}

/** Used to decide whether to offer the "sync existing local data to the cloud" migration prompt — only when the workspace has never had anything pushed to it. */
export async function isWorkspaceEmpty(workspaceId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
  if (error) throw error
  return (count ?? 0) === 0
}
