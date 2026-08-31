import { useNavigate } from 'react-router-dom'
import { MapPin, DoorClosed, ChevronRight } from 'lucide-react'
import type { Project } from '@/types'
import { Card, Badge } from '@/components/ui'
import { PROJECT_STATUS_META, PROJECT_TYPE_LABEL } from '@/data/statusMeta'
import { formatCompactCurrency, formatDate } from '@/lib/format'
import { useAppStore } from '@/store/useAppStore'

interface ProjectCardProps {
  project: Project
}

export function ProjectCard({ project }: ProjectCardProps) {
  const navigate = useNavigate()
  const client = useAppStore((s) => s.clients.find((c) => c.id === project.clientId))
  const statusMeta = PROJECT_STATUS_META[project.status]

  return (
    <Card
      interactive
      onClick={() => navigate(`/projects/${project.id}`)}
      className="flex flex-col gap-3.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-ink-400">
            {PROJECT_TYPE_LABEL[project.type]}
          </p>
          <h3 className="mt-0.5 truncate font-display text-lg font-semibold text-ink-900">
            {project.name}
          </h3>
          <p className="mt-0.5 truncate text-sm text-ink-500">{client?.name ?? 'Unknown client'}</p>
        </div>
        <Badge tone={statusMeta.tone} className="shrink-0">
          {statusMeta.label}
        </Badge>
      </div>

      <div className="flex items-center gap-1.5 text-sm text-ink-500">
        <MapPin className="h-4 w-4 shrink-0" />
        <span className="truncate">{project.address}</span>
      </div>

      <div className="flex items-center justify-between border-t border-ink-100 pt-3.5">
        <div className="flex items-center gap-1.5 text-sm font-medium text-ink-600">
          <DoorClosed className="h-4 w-4" />
          {project.roomIds.length} {project.roomIds.length === 1 ? 'room' : 'rooms'}
        </div>
        <div className="text-right">
          <p className="font-display text-base font-semibold text-ink-900">
            {formatCompactCurrency(project.budgetEstimate)}
          </p>
          <p className="text-xs text-ink-400">Updated {formatDate(project.updatedAt)}</p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-ink-300" />
      </div>
    </Card>
  )
}
