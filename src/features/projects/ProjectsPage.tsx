import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, FolderKanban } from 'lucide-react'
import { PageHeader, Button, EmptyState } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useAppStore } from '@/store/useAppStore'
import { PROJECT_STATUS_META } from '@/data/statusMeta'
import { ProjectCard } from '@/components/project/ProjectCard'
import type { ProjectStatus } from '@/types'

type FilterTab = 'all' | ProjectStatus

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: PROJECT_STATUS_META.draft.label },
  { key: 'in-progress', label: PROJECT_STATUS_META['in-progress'].label },
  { key: 'quotation-sent', label: PROJECT_STATUS_META['quotation-sent'].label },
  { key: 'approved', label: PROJECT_STATUS_META.approved.label },
  { key: 'completed', label: PROJECT_STATUS_META.completed.label },
]

export function ProjectsPage() {
  const navigate = useNavigate()
  const projects = useAppStore((s) => s.projects)
  const clients = useAppStore((s) => s.clients)

  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<FilterTab>('all')

  const filtered = useMemo(() => {
    return projects
      .filter((project) => tab === 'all' || project.status === tab)
      .filter((project) => {
        if (query.trim().length === 0) return true
        const client = clients.find((c) => c.id === project.clientId)
        const haystack = `${project.name} ${client?.name ?? ''}`.toLowerCase()
        return haystack.includes(query.toLowerCase())
      })
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  }, [projects, clients, tab, query])

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle={`${projects.length} projects in your studio`}
        actions={
          <Button icon={<Plus className="h-5 w-5" />} onClick={() => navigate('/projects/new')}>
            New Project
          </Button>
        }
      />

      <div className="px-5 py-6 sm:px-8">
        <div className="flex flex-col gap-3.5">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects or clients..."
              className="h-13 w-full rounded-[--radius-md] border-2 border-ink-100 bg-white pl-12 pr-4 text-base text-ink-900 placeholder:text-ink-400 outline-none transition-colors focus:border-brass-500"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto rounded-[--radius-md] bg-ink-50 p-1.5 no-scrollbar">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'h-10 shrink-0 rounded-[calc(var(--radius-md)-0.35rem)] px-4 text-sm font-semibold transition-colors',
                  tab === t.key ? 'bg-white text-ink-900 shadow-[--shadow-soft]' : 'text-ink-500',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            className="mt-8"
            icon={<FolderKanban className="h-8 w-8" />}
            title="No projects found"
            description="Try a different search term or filter, or start a new project."
            action={
              <Button icon={<Plus className="h-5 w-5" />} onClick={() => navigate('/projects/new')}>
                New Project
              </Button>
            }
          />
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
