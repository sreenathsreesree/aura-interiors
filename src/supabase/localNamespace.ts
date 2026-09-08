// The local-storage key namespace currently in effect.
//
// Canvas documents and Project Media persist to plain localStorage (see
// lib/canvasStorage.ts / lib/projectMediaStorage.ts) under fixed keys with
// no per-user scoping — fine for a single local-only user, but if two
// different cloud accounts ever sign into the *same browser*, unscoped keys
// would leak one account's cached photos/drawings into the other's view.
//
// Signed-out / cloud-not-configured usage keeps the original, un-namespaced
// keys exactly as before (so nothing changes for today's local-only
// behavior or any existing test). Once a user is signed in, their id
// becomes the namespace, so each account gets its own local cache — cleared
// by useAuthStore on sign-out/account switch, per this milestone's
// "switching accounts must correctly clear the previous user's active
// application state" requirement.

let activeNamespace: string | null = null

export function setLocalNamespace(namespace: string | null): void {
  activeNamespace = namespace
}

export function getLocalNamespace(): string | null {
  return activeNamespace
}

/**
 * Prefixes a base storage key with the active namespace, or returns it
 * unchanged when signed out. The namespace goes at the FRONT (not appended)
 * so callers that need to enumerate/prefix-match their own keys (e.g.
 * listing every cached Canvas document) can still do a simple
 * `startsWith(namespacedKey(PREFIX))` regardless of what varies after the
 * base prefix.
 */
export function namespacedKey(baseKey: string): string {
  return activeNamespace ? `ns:${activeNamespace}:${baseKey}` : baseKey
}
