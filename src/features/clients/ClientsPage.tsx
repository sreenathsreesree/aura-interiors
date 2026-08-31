import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Plus, Phone, MapPin, UserRound } from 'lucide-react'
import { PageHeader, Button, Card, Badge, Avatar, EmptyState } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useAppStore } from '@/store/useAppStore'
import { CLIENT_STATUS_META } from '@/data/statusMeta'
import { formatDate } from '@/lib/format'
import { AddClientSheet } from './AddClientSheet'
import type { ClientStatus } from '@/types'

type FilterTab = 'all' | ClientStatus

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'lead', label: 'Leads' },
  { key: 'archived', label: 'Archived' },
]

export function ClientsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const clients = useAppStore((s) => s.clients)
  const projects = useAppStore((s) => s.projects)

  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<FilterTab>('all')
  const [addOpen, setAddOpen] = useState(searchParams.get('new') === '1')

  const filtered = useMemo(() => {
    return clients.filter((client) => {
      const matchesTab = tab === 'all' || client.status === tab
      const matchesQuery =
        query.trim().length === 0 ||
        client.name.toLowerCase().includes(query.toLowerCase()) ||
        client.city.toLowerCase().includes(query.toLowerCase())
      return matchesTab && matchesQuery
    })
  }, [clients, tab, query])

  function projectCountFor(clientId: string) {
    return projects.filter((p) => p.clientId === clientId).length
  }

  function closeAddSheet() {
    setAddOpen(false)
    if (searchParams.get('new')) {
      searchParams.delete('new')
      setSearchParams(searchParams, { replace: true })
    }
  }

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle={`${clients.length} clients across your studio`}
        actions={
          <Button icon={<Plus className="h-5 w-5" />} onClick={() => setAddOpen(true)}>
            Add Client
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
              placeholder="Search by name or city..."
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
            icon={<UserRound className="h-8 w-8" />}
            title="No clients found"
            description="Try a different search term or filter, or add a new client to get started."
            action={
              <Button icon={<Plus className="h-5 w-5" />} onClick={() => setAddOpen(true)}>
                Add Client
              </Button>
            }
          />
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {filtered.map((client) => {
              const statusMeta = CLIENT_STATUS_META[client.status]
              const count = projectCountFor(client.id)
              return (
                <Card
                  key={client.id}
                  interactive
                  onClick={() => navigate(`/clients/${client.id}`)}
                  className="flex flex-col gap-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3.5">
                      <Avatar name={client.name} color={client.avatarColor} size="lg" />
                      <div className="min-w-0">
                        <h3 className="truncate font-display text-lg font-semibold text-ink-900">
                          {client.name}
                        </h3>
                        <p className="truncate text-sm text-ink-500">{client.city}</p>
                      </div>
                    </div>
                    <Badge tone={statusMeta.tone} className="shrink-0">
                      {statusMeta.label}
                    </Badge>
                  </div>

                  <div className="flex flex-col gap-1.5 text-sm text-ink-600">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 shrink-0 text-ink-400" />
                      <span className="truncate">{client.phone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 shrink-0 text-ink-400" />
                      <span className="truncate">{client.address}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-ink-100 pt-3.5 text-sm">
                    <span className="font-medium text-ink-500">
                      {count} {count === 1 ? 'project' : 'projects'}
                    </span>
                    <span className="text-ink-400">Since {formatDate(client.createdAt)}</span>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <AddClientSheet
        open={addOpen}
        onClose={closeAddSheet}
        onCreated={(client) => navigate(`/clients/${client.id}`)}
      />
    </div>
  )
}
