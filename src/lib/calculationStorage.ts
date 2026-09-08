// Interior Tools — saved-calculation persistence.
//
// Follows the exact pattern lib/canvasStorage.ts and lib/projectMediaStorage.ts
// already established: a dedicated load/save module, JSON in localStorage,
// namespaced per signed-in account (see supabase/localNamespace.ts) so two
// different cloud accounts on one browser never share a cache. Local-only
// for this milestone — Supabase work is paused — but this module is the
// same shape projectMediaStorage.ts was before its Cloud Foundation push
// wiring landed, so adding cloud sync later means adding a
// src/supabase/repositories/calculations.ts + push actions, not touching
// this file's contract.

import type { SavedCalculation } from '@/features/tools/types'
import { namespacedKey } from '@/supabase/localNamespace'

const BASE_STORAGE_KEY = 'aura-calculations'

export function loadCalculations(): SavedCalculation[] {
  try {
    const raw = window.localStorage.getItem(namespacedKey(BASE_STORAGE_KEY))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveCalculations(calculations: SavedCalculation[]): void {
  try {
    window.localStorage.setItem(namespacedKey(BASE_STORAGE_KEY), JSON.stringify(calculations))
  } catch {
    // Storage can fail (private browsing, quota) — saving is best-effort, same as Canvas/Media.
  }
}
