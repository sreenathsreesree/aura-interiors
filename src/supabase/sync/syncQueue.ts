// A small debounced, per-key, retrying push queue.
//
// This is deliberately NOT a generic offline-first sync engine — it's the
// minimum this milestone asks for (section 9/13): local writes are already
// immediate (existing Zustand/localStorage behavior, untouched), and this
// queue only owns turning "something changed" into a background, debounced
// Supabase write, with a visible status and a retry when the network comes
// back. One entry per logical record (e.g. `project:${id}`) — a burst of
// edits to the same record collapses into one write, not one per keystroke.

import { setSyncStatus } from './syncStatus'
import { isSupabaseConfigured } from '../client'

type Task = () => Promise<void>

const DEBOUNCE_MS = 1500
const RETRY_MS = 8000

const timers = new Map<string, ReturnType<typeof setTimeout>>()
const pending = new Map<string, Task>()
let retryTimer: ReturnType<typeof setTimeout> | null = null
let enabled = false

/** Turns the queue on/off — off entirely when signed out or Supabase isn't configured, so nothing here ever runs against local-only usage. */
export function setSyncEnabled(value: boolean): void {
  enabled = value
  if (!value) {
    for (const timer of timers.values()) clearTimeout(timer)
    timers.clear()
    pending.clear()
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
    setSyncStatus('disabled')
  } else if (pending.size === 0) {
    setSyncStatus('synced')
  }
}

function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine
}

async function flush(key: string): Promise<void> {
  const task = pending.get(key)
  if (!task) return
  timers.delete(key)

  if (!isOnline()) {
    setSyncStatus('offline')
    scheduleRetry()
    return
  }

  try {
    await task()
    pending.delete(key)
    setSyncStatus(pending.size === 0 ? 'synced' : 'saving')
  } catch (err) {
    // The write stays queued (not dropped) so a transient failure never
    // silently loses the change — it's retried, never discarded.
    setSyncStatus('error', err instanceof Error ? err.message : 'Sync failed')
    scheduleRetry()
  }
}

function scheduleRetry(): void {
  if (retryTimer || !enabled) return
  retryTimer = setTimeout(() => {
    retryTimer = null
    for (const key of Array.from(pending.keys())) void flush(key)
  }, RETRY_MS)
}

/** Debounced push — collapses repeated calls for the same key into one write. */
export function enqueueSync(key: string, task: Task): void {
  if (!enabled || !isSupabaseConfigured()) return
  pending.set(key, task)
  setSyncStatus('saving')
  const existing = timers.get(key)
  if (existing) clearTimeout(existing)
  timers.set(key, setTimeout(() => void flush(key), DEBOUNCE_MS))
}

/** Bypasses the debounce for an important lifecycle moment (e.g. leaving Canvas) — still queued/retried the same way if it fails. */
export function flushSyncNow(key: string, task: Task): void {
  if (!enabled || !isSupabaseConfigured()) return
  const existing = timers.get(key)
  if (existing) clearTimeout(existing)
  timers.delete(key)
  pending.set(key, task)
  void flush(key)
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (!enabled) return
    for (const key of Array.from(pending.keys())) void flush(key)
  })
  window.addEventListener('offline', () => {
    if (enabled) setSyncStatus('offline')
  })
}
