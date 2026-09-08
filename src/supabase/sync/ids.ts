/** A real UUID for a new cloud row — `crypto.randomUUID()` where available, a small RFC4122-v4 fallback otherwise. */
export function newUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** A local id -> freshly-minted cloud UUID map, so cross-references (project.clientId, room.projectId, ...) stay consistent when migrating non-UUID local ids (e.g. "pr-1") into UUID cloud columns. */
export class IdRemap {
  private map = new Map<string, string>()

  get(localId: string): string {
    let cloudId = this.map.get(localId)
    if (!cloudId) {
      cloudId = newUuid()
      this.map.set(localId, cloudId)
    }
    return cloudId
  }

  getIfSeen(localId: string | undefined): string | undefined {
    return localId ? this.map.get(localId) : undefined
  }
}
