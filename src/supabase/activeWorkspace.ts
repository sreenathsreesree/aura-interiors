// The signed-in user's resolved workspace id, if any. A tiny standalone
// module (no imports) so both useAuthStore (which sets it) and the sync
// push helpers used by useAppStore (which read it) can depend on it without
// creating an import cycle between the app store and the auth store.

let activeWorkspaceId: string | null = null

export function setActiveWorkspaceId(id: string | null): void {
  activeWorkspaceId = id
}

export function getActiveWorkspaceId(): string | null {
  return activeWorkspaceId
}
