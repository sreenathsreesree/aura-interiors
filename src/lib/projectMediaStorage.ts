// Project Media persistence (Site Photos + References).
//
// The rest of the app's domain state (clients/projects/rooms/quotations)
// lives only in memory — useAppStore re-seeds from sample data on every
// load, with no persistence layer at all. Media is different: the spec
// explicitly requires it to survive a reload, so this module gives it its
// own small localStorage-backed store, following the exact pattern
// lib/canvasStorage.ts already established for Canvas (a dedicated
// load/save module, JSON in localStorage, downscaled data URIs for images)
// rather than inventing a new persistence approach.
//
// Deliberately a flat "load everything, save everything" shape (not
// per-project keys) — the total volume here is small (photo/reference
// records, not full documents), and it keeps the store's hydration logic
// (see useAppStore.ts) a single synchronous read, mirroring how Canvas
// documents are read synchronously on mount.
//
// Storage decision (kept explicitly replaceable — see the SitePhoto/
// ProjectReference types): Site Photos store a downscaled image directly;
// References either store one the same way (source: 'local') or store only
// Drive metadata (source: 'drive') — the Drive file itself is never
// downloaded. Swapping local storage for real cloud storage later only
// means changing what `dataUrl` points to, not this module's shape.

import type { ProjectReference, SitePhoto } from '@/types'
import { namespacedKey } from '@/supabase/localNamespace'

const BASE_STORAGE_KEY = 'aura-project-media'

interface StoredProjectMedia {
  sitePhotos: SitePhoto[]
  references: ProjectReference[]
}

function emptyMedia(): StoredProjectMedia {
  return { sitePhotos: [], references: [] }
}

export function loadProjectMedia(): StoredProjectMedia {
  try {
    const raw = window.localStorage.getItem(namespacedKey(BASE_STORAGE_KEY))
    if (!raw) return emptyMedia()
    const parsed = JSON.parse(raw) as Partial<StoredProjectMedia>
    return {
      sitePhotos: Array.isArray(parsed.sitePhotos) ? parsed.sitePhotos : [],
      references: Array.isArray(parsed.references) ? parsed.references : [],
    }
  } catch {
    return emptyMedia()
  }
}

export function saveProjectMedia(data: StoredProjectMedia): void {
  try {
    window.localStorage.setItem(namespacedKey(BASE_STORAGE_KEY), JSON.stringify(data))
  } catch {
    // Storage can fail (private browsing, quota) — saving is best-effort, same as Canvas.
  }
}
