import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Phone, Mail, MapPin, Plus, FolderKanban } from 'lucide-react'
import { Avatar, Badge, Button, Card, EmptyState, IconButton } from '@/components/ui'
import { useAppStore } from '@/store/useAppStore'
import { useShallow } from 'zustand/react/shallow'
import { CLIENT_STATUS_META } from '@/data/statusMeta'
import { formatDate } from '@/lib/format'
import { ProjectCard } from '@/components/project/ProjectCard'

export function ClientDetailPage() {
  const { clientId } = useParams<{ clientId: string }>()
  const navigate = useNavigate()
  const client = useAppStore((s) => s.clients.find((c) => c.id === clientId))
  const projects = useAppStore(
    useShallow((s) => s.projects.filter((p) => p.clientId === clientId)),
  )

  if (!client) {
    return (
      <div className="p-8">
        <EmptyState
          icon={<FolderKanban className="h-8 w-8" />}
          title="Client not found"
          description="This client may have been removed."
          action={<Button onClick={() => navigate('/clients')}>Back to Clients</Button>}
        />
      </div>
    )
  }

  const statusMeta = CLIENT_STATUS_META[client.status]

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-ink-100 bg-sand-100/60 px-5 py-4 sm:px-8">
        <IconButton label="Back" variant="ghost" onClick={() => navigate('/clients')}>
          <ArrowLeft className="h-5 w-5" />
        </IconButton>
        <span className="text-sm font-semibold text-ink-500">Clients</span>
      </div>

      <div className="px-5 py-6 sm:px-8">
        <Card className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar name={client.name} color={client.avatarColor} size="xl" />
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-display text-2xl font-semibold text-ink-900">{client.name}</h1>
                <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
              </div>
              <p className="mt-1 text-sm text-ink-500">Client since {formatDate(client.createdAt)}</p>
            </div>
          </div>
          <Button
            icon={<Plus className="h-5 w-5" />}
            onClick={() => navigate('/projects/new', { state: { clientId: client.id } })}
          >
            New Project
          </Button>
        </Card>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="flex items-center gap-3">
            <Phone className="h-5 w-5 shrink-0 text-brass-500" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-ink-400">Phone</p>
              <p className="truncate text-sm font-semibold text-ink-800">{client.phone}</p>
            </div>
          </Card>
          <Card className="flex items-center gap-3">
            <Mail className="h-5 w-5 shrink-0 text-brass-500" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-ink-400">Email</p>
              <p className="truncate text-sm font-semibold text-ink-800">{client.email}</p>
            </div>
          </Card>
          <Card className="flex items-center gap-3">
            <MapPin className="h-5 w-5 shrink-0 text-brass-500" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-ink-400">Address</p>
              <p className="truncate text-sm font-semibold text-ink-800">
                {client.address}, {client.city}
              </p>
            </div>
          </Card>
        </div>

        {client.notes && (
          <Card className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Notes</p>
            <p className="mt-1.5 text-sm text-ink-700">{client.notes}</p>
          </Card>
        )}

        <h2 className="mt-8 mb-3.5 font-display text-xl font-semibold text-ink-900">
          Projects ({projects.length})
        </h2>
        {projects.length === 0 ? (
          <EmptyState
            icon={<FolderKanban className="h-8 w-8" />}
            title="No projects yet"
            description="Start a new project for this client to begin the design workflow."
            action={
              <Button
                icon={<Plus className="h-5 w-5" />}
                onClick={() => navigate('/projects/new', { state: { clientId: client.id } })}
              >
                New Project
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
