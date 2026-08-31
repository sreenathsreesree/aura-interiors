import { useNavigate } from 'react-router-dom'
import { Briefcase, Users, Wallet, FileText, Plus, UserPlus, ArrowRight } from 'lucide-react'
import { PageHeader, StatCard, Button, Card, Badge, Avatar } from '@/components/ui'
import { ProjectCard } from '@/components/project/ProjectCard'
import { useAppStore } from '@/store/useAppStore'
import { formatCompactCurrency, formatDate } from '@/lib/format'
import { CLIENT_STATUS_META } from '@/data/statusMeta'

export function DashboardPage() {
  const navigate = useNavigate()
  const projects = useAppStore((s) => s.projects)
  const clients = useAppStore((s) => s.clients)

  const activeProjects = projects.filter((p) => p.status !== 'completed')
  const pipelineValue = activeProjects.reduce((sum, p) => sum + p.budgetEstimate, 0)
  const quotationsSent = projects.filter((p) => p.status === 'quotation-sent').length
  const recentProjects = [...projects]
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .slice(0, 4)
  const recentClients = [...clients]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 4)

  return (
    <div>
      <PageHeader
        title="Good morning, Studio"
        subtitle="Here's where your projects stand today."
        actions={
          <Button icon={<Plus className="h-5 w-5" />} onClick={() => navigate('/projects/new')}>
            New Project
          </Button>
        }
      />

      <div className="px-5 py-6 sm:px-8">
        <div className="grid grid-cols-2 gap-3.5 sm:gap-4 lg:grid-cols-4">
          <StatCard
            label="Active Projects"
            value={String(activeProjects.length)}
            icon={<Briefcase className="h-6 w-6" />}
            tone="brass"
          />
          <StatCard
            label="Total Clients"
            value={String(clients.length)}
            icon={<Users className="h-6 w-6" />}
            tone="sage"
          />
          <StatCard
            label="Pipeline Value"
            value={formatCompactCurrency(pipelineValue)}
            icon={<Wallet className="h-6 w-6" />}
            tone="terracotta"
          />
          <StatCard
            label="Quotations Sent"
            value={String(quotationsSent)}
            icon={<FileText className="h-6 w-6" />}
            tone="ink"
          />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <div className="mb-3.5 flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold text-ink-900">Recent Projects</h2>
              <button
                onClick={() => navigate('/projects')}
                className="flex items-center gap-1 text-sm font-semibold text-brass-600 hover:text-brass-700"
              >
                View all <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {recentProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </div>

          <div>
            <div className="mb-3.5 flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold text-ink-900">Recent Clients</h2>
              <button
                onClick={() => navigate('/clients')}
                className="flex items-center gap-1 text-sm font-semibold text-brass-600 hover:text-brass-700"
              >
                View all <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <Card padding="none" className="divide-y divide-ink-100">
              {recentClients.map((client) => {
                const statusMeta = CLIENT_STATUS_META[client.status]
                return (
                  <button
                    key={client.id}
                    onClick={() => navigate(`/clients/${client.id}`)}
                    className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-sand-50 active:bg-sand-100"
                  >
                    <Avatar name={client.name} color={client.avatarColor} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink-900">{client.name}</p>
                      <p className="truncate text-xs text-ink-500">{formatDate(client.createdAt)}</p>
                    </div>
                    <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                  </button>
                )
              })}
            </Card>
            <Button
              variant="outline"
              fullWidth
              className="mt-4"
              icon={<UserPlus className="h-5 w-5" />}
              onClick={() => navigate('/clients?new=1')}
            >
              Add Client
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
