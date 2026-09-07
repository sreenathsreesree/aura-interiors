import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Cloud, Images, Upload, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { Button, EmptyState, IconButton } from '@/components/ui'
import { fileToDownscaledDataUrl } from '@/lib/imageUtils'
import { isGoogleDriveConfigured, openGoogleDrivePicker } from '@/lib/googleDrive'
import { useAppStore } from '@/store/useAppStore'
import { AddPhotoMenu } from './AddPhotoMenu'
import { MediaCard } from './MediaCard'
import { MediaLightbox } from './MediaLightbox'
import type { MediaLightboxItem } from './MediaLightbox'

const REFERENCE_MAX_DIM = 1600

export function ReferencesPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()

  const project = useAppStore((s) => s.projects.find((p) => p.id === projectId))
  const allReferences = useAppStore(useShallow((s) => s.references))
  const addLocalReferences = useAppStore((s) => s.addLocalReferences)
  const addDriveReferences = useAppStore((s) => s.addDriveReferences)
  const deleteReference = useAppStore((s) => s.deleteReference)

  const [lightboxIndex, setLightboxIndex] = useState<number>()
  const [isUploading, setIsUploading] = useState(false)
  const [showDriveSetupNotice, setShowDriveSetupNotice] = useState(false)
  const [driveError, setDriveError] = useState<string>()

  const fileInputRef = useRef<HTMLInputElement>(null)

  const references = useMemo(() => {
    if (!project) return []
    return allReferences
      .filter((r) => r.projectId === project.id)
      .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
  }, [allReferences, project])

  if (!project) {
    return (
      <div className="p-8">
        <EmptyState
          icon={<Images className="h-8 w-8" />}
          title="Project not found"
          action={<Button onClick={() => navigate('/projects')}>Back to Projects</Button>}
        />
      </div>
    )
  }

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !project) return
    setIsUploading(true)
    try {
      const files = Array.from(fileList)
      const dataUrls = await Promise.all(
        files.map((file) => fileToDownscaledDataUrl(file, REFERENCE_MAX_DIM, 0.85)),
      )
      addLocalReferences(
        project.id,
        dataUrls.map((dataUrl, i) => ({ dataUrl, name: files[i].name })),
      )
    } catch {
      window.alert('One or more references could not be added. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  async function handleDriveUpload() {
    if (!isGoogleDriveConfigured()) {
      setShowDriveSetupNotice(true)
      return
    }
    setDriveError(undefined)
    try {
      const picked = await openGoogleDrivePicker()
      if (picked.length > 0 && project) {
        addDriveReferences(project.id, picked)
      }
    } catch (err) {
      setDriveError(err instanceof Error ? err.message : 'Google Drive sign-in was cancelled or failed.')
    }
  }

  function handleDelete(referenceId: string, source: 'local' | 'drive') {
    const message =
      source === 'drive'
        ? 'Remove this reference from AURA? The original file stays in your Google Drive — it will not be deleted.'
        : 'Delete this reference? This cannot be undone.'
    if (!window.confirm(message)) return
    deleteReference(referenceId)
  }

  const lightboxItems: MediaLightboxItem[] = references.map((r) => ({
    id: r.id,
    src: r.source === 'local' ? r.dataUrl : r.previewLink || r.thumbnailLink,
    title: r.name,
    subtitle:
      r.source === 'drive'
        ? `Google Drive · ${new Date(r.addedAt).toLocaleDateString()}`
        : new Date(r.addedAt).toLocaleDateString(),
  }))

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex items-center gap-2 border-b border-ink-100 bg-sand-100/60 px-5 py-4 sm:px-8">
        <IconButton label="Back to project" variant="ghost" onClick={() => navigate(`/projects/${project.id}`)}>
          <ArrowLeft className="h-5 w-5" />
        </IconButton>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-ink-400">{project.name}</p>
          <p className="text-xs text-ink-400">References</p>
        </div>
      </div>

      <div className="flex items-start justify-between gap-4 border-b border-ink-100 bg-sand-100/60 px-5 py-4 sm:px-8">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-900">References</h1>
          <p className="text-sm text-ink-500">Client inspiration, materials, and design references.</p>
        </div>
        <AddPhotoMenu
          triggerLabel="Add References"
          options={[
            {
              key: 'local',
              label: 'Upload from device',
              description: 'Choose one or more images',
              icon: <Upload className="h-4.5 w-4.5" />,
              onSelect: () => fileInputRef.current?.click(),
            },
            {
              key: 'drive',
              label: 'Upload from Google Drive',
              description: 'Reference images without copying them',
              icon: <Cloud className="h-4.5 w-4.5" />,
              onSelect: () => void handleDriveUpload(),
            },
          ]}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void handleFilesSelected(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {showDriveSetupNotice && (
        <div className="mx-5 mt-4 flex items-start justify-between gap-3 rounded-[--radius-lg] border-2 border-dashed border-brass-400/60 bg-brass-500/5 px-5 py-4 sm:mx-8">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink-900">Google Drive isn&apos;t connected</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-500">
              This deployment hasn&apos;t been configured with Google Drive credentials yet. To enable it, set{' '}
              <code className="rounded bg-white px-1 py-0.5 text-[11px]">VITE_GOOGLE_CLIENT_ID</code> and{' '}
              <code className="rounded bg-white px-1 py-0.5 text-[11px]">VITE_GOOGLE_API_KEY</code> — see{' '}
              <code className="rounded bg-white px-1 py-0.5 text-[11px]">.env.example</code> for setup steps. Until
              then, you can still add references by uploading from this device.
            </p>
          </div>
          <IconButton label="Dismiss" variant="ghost" size="sm" onClick={() => setShowDriveSetupNotice(false)}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
      )}

      {driveError && (
        <div className="mx-5 mt-4 flex items-start justify-between gap-3 rounded-[--radius-lg] border-2 border-danger-500/30 bg-danger-500/5 px-5 py-4 sm:mx-8">
          <p className="text-sm text-danger-600">{driveError}</p>
          <IconButton label="Dismiss" variant="ghost" size="sm" onClick={() => setDriveError(undefined)}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8">
        {isUploading && <p className="mb-4 text-sm font-medium text-brass-600">Adding references&hellip;</p>}
        {references.length === 0 ? (
          <EmptyState
            icon={<Images className="h-8 w-8" />}
            title="No references yet"
            description="Add inspiration, material, or lighting references from this device or Google Drive."
            action={
              <Button icon={<Upload className="h-4 w-4" />} onClick={() => fileInputRef.current?.click()}>
                Add References
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {references.map((reference, index) => (
              <MediaCard
                key={reference.id}
                imageSrc={
                  reference.source === 'local'
                    ? reference.dataUrl
                    : reference.thumbnailLink || reference.previewLink
                }
                title={reference.name}
                subtitle={reference.source === 'drive' ? 'Google Drive' : undefined}
                badge={
                  reference.source === 'drive' ? (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/90 text-ink-600">
                      <Cloud className="h-3 w-3" />
                    </span>
                  ) : undefined
                }
                onClick={() => setLightboxIndex(index)}
                onDelete={() => handleDelete(reference.id, reference.source)}
                deleteLabel="Remove reference"
              />
            ))}
          </div>
        )}
      </div>

      {lightboxIndex !== undefined && references[lightboxIndex] && (
        <MediaLightbox
          items={lightboxItems}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(undefined)}
          onIndexChange={setLightboxIndex}
        />
      )}
    </div>
  )
}
