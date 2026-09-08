import { useState } from 'react'
import { CloudUpload } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import { useAuthStore } from '@/store/useAuthStore'

// Shown once, right after a first cloud sign-in, only when the cloud
// workspace is empty AND there's local data worth offering to bring along
// (see summarizeLocalData()/useAuthStore's sign-in flow). Declining leaves
// all local data exactly as it is — nothing is deleted either way.
export function MigrationPrompt() {
  const summary = useAuthStore((s) => s.pendingMigration)
  const confirmMigration = useAuthStore((s) => s.confirmMigration)
  const skipMigration = useAuthStore((s) => s.skipMigration)
  const [busy, setBusy] = useState<'sync' | 'skip' | null>(null)

  if (!summary) return null

  async function handleConfirm() {
    setBusy('sync')
    try {
      await confirmMigration()
    } finally {
      setBusy(null)
    }
  }

  async function handleSkip() {
    setBusy('skip')
    try {
      await skipMigration()
    } finally {
      setBusy(null)
    }
  }

  const parts: string[] = []
  if (summary.projectCount > 0) parts.push(`${summary.projectCount} project${summary.projectCount === 1 ? '' : 's'}`)
  if (summary.clientCount > 0) parts.push(`${summary.clientCount} client${summary.clientCount === 1 ? '' : 's'}`)
  if (summary.roomCount > 0) parts.push(`${summary.roomCount} room${summary.roomCount === 1 ? '' : 's'}`)
  if (summary.quotationCount > 0) parts.push(`${summary.quotationCount} quotation${summary.quotationCount === 1 ? '' : 's'}`)
  if (summary.canvasDocumentCount > 0) parts.push(`${summary.canvasDocumentCount} Canvas drawing${summary.canvasDocumentCount === 1 ? '' : 's'}`)
  if (summary.sitePhotoCount > 0) parts.push(`${summary.sitePhotoCount} site photo${summary.sitePhotoCount === 1 ? '' : 's'}`)
  if (summary.referenceCount > 0) parts.push(`${summary.referenceCount} reference${summary.referenceCount === 1 ? '' : 's'}`)

  return (
    <div className="flex min-h-dvh items-center justify-center bg-sand-100 px-4 py-10">
      <Card padding="lg" className="w-full max-w-md">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brass-500/12 text-brass-600">
          <CloudUpload className="h-6 w-6" />
        </div>
        <h1 className="font-display text-xl font-semibold text-ink-900">Existing AURA data found</h1>
        <p className="mt-2 text-sm text-ink-600">
          This browser has local AURA data that hasn&apos;t been synced yet: {parts.join(', ')}. Sync it to your new
          cloud account?
        </p>
        <p className="mt-2 text-xs text-ink-400">
          Your local data stays exactly where it is either way — nothing is deleted by this choice.
        </p>
        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row-reverse">
          <Button fullWidth onClick={handleConfirm} disabled={busy !== null}>
            {busy === 'sync' ? 'Syncing…' : 'Sync to cloud'}
          </Button>
          <Button fullWidth variant="outline" onClick={handleSkip} disabled={busy !== null}>
            {busy === 'skip' ? 'Starting fresh…' : 'Start fresh instead'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
