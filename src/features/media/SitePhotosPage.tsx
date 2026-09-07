import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Camera, Images, ImageUp } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { Button, EmptyState, IconButton } from '@/components/ui'
import { cn } from '@/lib/cn'
import { fileToDownscaledDataUrl } from '@/lib/imageUtils'
import { useAppStore } from '@/store/useAppStore'
import { AddPhotoMenu } from './AddPhotoMenu'
import { MediaCard } from './MediaCard'
import { MediaLightbox } from './MediaLightbox'
import type { MediaLightboxItem } from './MediaLightbox'

// A downscale target generous enough for a clean full-screen view (the
// original V2 texture-fill default of 480px is too soft for this use).
const PHOTO_MAX_DIM = 1600

export function SitePhotosPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()

  const project = useAppStore((s) => s.projects.find((p) => p.id === projectId))
  const rooms = useAppStore(useShallow((s) => s.rooms.filter((r) => r.projectId === projectId)))
  const allSitePhotos = useAppStore(useShallow((s) => s.sitePhotos))
  const addSitePhotos = useAppStore((s) => s.addSitePhotos)
  const deleteSitePhoto = useAppStore((s) => s.deleteSitePhoto)

  const [roomFilter, setRoomFilter] = useState('all')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [lightboxIndex, setLightboxIndex] = useState<number>()
  const [isUploading, setIsUploading] = useState(false)

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const libraryInputRef = useRef<HTMLInputElement>(null)

  const photos = useMemo(() => {
    if (!project) return []
    const projectPhotos = allSitePhotos.filter((p) => p.projectId === project.id)
    const filtered = roomFilter === 'all' ? projectPhotos : projectPhotos.filter((p) => p.roomId === roomFilter)
    const sorted = [...filtered].sort((a, b) => {
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      return sortOrder === 'newest' ? -diff : diff
    })
    return sorted
  }, [allSitePhotos, project, roomFilter, sortOrder])

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
      const dataUrls = await Promise.all(files.map((file) => fileToDownscaledDataUrl(file, PHOTO_MAX_DIM, 0.85)))
      addSitePhotos(
        project.id,
        dataUrls.map((dataUrl) => ({
          dataUrl,
          roomId: roomFilter === 'all' ? undefined : roomFilter,
        })),
      )
    } catch {
      window.alert('One or more photos could not be added. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  function handleDelete(photoId: string) {
    if (!window.confirm('Delete this photo? This cannot be undone.')) return
    deleteSitePhoto(photoId)
  }

  const lightboxItems: MediaLightboxItem[] = photos.map((p) => ({
    id: p.id,
    src: p.dataUrl,
    title: p.caption || 'Site Photo',
    subtitle: new Date(p.createdAt).toLocaleString(),
  }))

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex items-center gap-2 border-b border-ink-100 bg-sand-100/60 px-5 py-4 sm:px-8">
        <IconButton label="Back to project" variant="ghost" onClick={() => navigate(`/projects/${project.id}`)}>
          <ArrowLeft className="h-5 w-5" />
        </IconButton>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-ink-400">{project.name}</p>
          <p className="text-xs text-ink-400">Site Photos</p>
        </div>
      </div>

      <div className="flex items-start justify-between gap-4 border-b border-ink-100 bg-sand-100/60 px-5 py-4 sm:px-8">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-900">Site Photos</h1>
          <p className="text-sm text-ink-500">Existing conditions, measurements, and progress photos.</p>
        </div>
        <AddPhotoMenu
          triggerLabel="Add Photos"
          options={[
            {
              key: 'camera',
              label: 'Camera',
              description: 'Take a new photo now',
              icon: <Camera className="h-4.5 w-4.5" />,
              onSelect: () => cameraInputRef.current?.click(),
            },
            {
              key: 'library',
              label: 'Photo Library',
              description: 'Choose one or more existing photos',
              icon: <ImageUp className="h-4.5 w-4.5" />,
              onSelect: () => libraryInputRef.current?.click(),
            },
          ]}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            void handleFilesSelected(e.target.files)
            e.target.value = ''
          }}
        />
        <input
          ref={libraryInputRef}
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

      {rooms.length > 0 && (
        <div className="flex items-center gap-3 border-b border-ink-100 px-5 py-3 sm:px-8">
          <div className="flex flex-1 gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setRoomFilter('all')}
              className={cn(
                'h-9 shrink-0 rounded-full border-2 px-3.5 text-xs font-semibold transition-colors',
                roomFilter === 'all'
                  ? 'border-ink-900 bg-ink-900 text-sand-50'
                  : 'border-ink-100 bg-white text-ink-600 hover:border-ink-300',
              )}
            >
              All Photos
            </button>
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => setRoomFilter(room.id)}
                className={cn(
                  'h-9 shrink-0 rounded-full border-2 px-3.5 text-xs font-semibold transition-colors',
                  roomFilter === room.id
                    ? 'border-ink-900 bg-ink-900 text-sand-50'
                    : 'border-ink-100 bg-white text-ink-600 hover:border-ink-300',
                )}
              >
                {room.name}
              </button>
            ))}
          </div>
          <button
            onClick={() => setSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'))}
            className="h-9 shrink-0 rounded-full border-2 border-ink-100 bg-white px-3.5 text-xs font-semibold text-ink-600 transition-colors hover:border-ink-300"
          >
            {sortOrder === 'newest' ? 'Newest first' : 'Oldest first'}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8">
        {isUploading && (
          <p className="mb-4 text-sm font-medium text-brass-600">Adding photos&hellip;</p>
        )}
        {photos.length === 0 ? (
          <EmptyState
            icon={<Images className="h-8 w-8" />}
            title="No site photos yet"
            description="Add photos of existing conditions, measurements, or on-site progress. They stay with this project only."
            action={
              <Button icon={<Camera className="h-4 w-4" />} onClick={() => libraryInputRef.current?.click()}>
                Add Photos
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {photos.map((photo, index) => (
              <MediaCard
                key={photo.id}
                imageSrc={photo.dataUrl}
                title={photo.caption || 'Site Photo'}
                subtitle={rooms.find((r) => r.id === photo.roomId)?.name}
                onClick={() => setLightboxIndex(index)}
                onDelete={() => handleDelete(photo.id)}
                deleteLabel="Delete photo"
              />
            ))}
          </div>
        )}
      </div>

      {lightboxIndex !== undefined && (
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
