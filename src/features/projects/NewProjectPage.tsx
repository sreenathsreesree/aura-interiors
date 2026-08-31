import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Search, Check, UserRound } from 'lucide-react'
import { Avatar, Button, Card, IconButton, Input, ProgressSteps } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useAppStore } from '@/store/useAppStore'
import { DEFAULT_PRICING_CONFIG } from '@/lib/pricing'
import { ROOM_TYPE_OPTIONS } from '@/data/roomTypes'
import { getRoomIcon } from '@/data/roomIcons'
import { PROJECT_TYPE_LABEL } from '@/data/statusMeta'
import type { ProjectType, RoomType } from '@/types'

const STEPS = [{ label: 'Client' }, { label: 'Project Details' }, { label: 'Select Rooms' }]

const PROJECT_TYPES = Object.entries(PROJECT_TYPE_LABEL) as [ProjectType, string][]

export function NewProjectPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const preselectedClientId = (location.state as { clientId?: string } | null)?.clientId

  const clients = useAppStore((s) => s.clients)
  const addClient = useAppStore((s) => s.addClient)
  const addProject = useAppStore((s) => s.addProject)
  const addRoom = useAppStore((s) => s.addRoom)

  const [stepIndex, setStepIndex] = useState(0)
  const [clientId, setClientId] = useState<string | null>(preselectedClientId ?? null)
  const [clientQuery, setClientQuery] = useState('')
  const [showNewClient, setShowNewClient] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [newClientPhone, setNewClientPhone] = useState('')

  const [projectName, setProjectName] = useState('')
  const [projectType, setProjectType] = useState<ProjectType>('apartment')
  const [address, setAddress] = useState('')
  const [budget, setBudget] = useState('')
  const [targetDate, setTargetDate] = useState('')

  const [selectedRoomTypes, setSelectedRoomTypes] = useState<RoomType[]>([])

  const filteredClients = useMemo(() => {
    if (!clientQuery.trim()) return clients
    return clients.filter((c) => c.name.toLowerCase().includes(clientQuery.toLowerCase()))
  }, [clients, clientQuery])

  const selectedClient = clients.find((c) => c.id === clientId)

  const canProceedStep0 = Boolean(clientId)
  const canProceedStep1 = projectName.trim().length > 1 && address.trim().length > 1

  function toggleRoomType(type: RoomType) {
    setSelectedRoomTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    )
  }

  function handleCreateNewClient() {
    if (newClientName.trim().length < 2 || newClientPhone.trim().length < 3) return
    const client = addClient({
      name: newClientName.trim(),
      phone: newClientPhone.trim(),
      email: '',
      address: '',
      city: '',
      status: 'lead',
      avatarColor: 'brass',
    })
    setClientId(client.id)
    setShowNewClient(false)
    setNewClientName('')
    setNewClientPhone('')
  }

  function handleNext() {
    if (stepIndex === 0 && !canProceedStep0) return
    if (stepIndex === 1 && !canProceedStep1) return
    if (stepIndex === 1 && !projectName.trim() && selectedClient) {
      setProjectName(`${selectedClient.name.split(' ')[0]} — ${PROJECT_TYPE_LABEL[projectType]}`)
    }
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1))
  }

  function handleBack() {
    if (stepIndex === 0) {
      navigate(-1)
      return
    }
    setStepIndex((i) => Math.max(i - 1, 0))
  }

  function handleCreateProject() {
    if (!clientId) return
    const project = addProject({
      clientId,
      name: projectName.trim(),
      type: projectType,
      status: 'draft',
      address: address.trim(),
      budgetEstimate: Number(budget) || 0,
      targetDate: targetDate || undefined,
      coverColor: 'brass',
      pricing: DEFAULT_PRICING_CONFIG,
    })
    selectedRoomTypes.forEach((type) => addRoom(project.id, type))
    navigate(`/projects/${project.id}`)
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex items-center gap-2 border-b border-ink-100 bg-sand-100/60 px-5 py-4 sm:px-8">
        <IconButton label="Back" variant="ghost" onClick={handleBack}>
          <ArrowLeft className="h-5 w-5" />
        </IconButton>
        <span className="text-sm font-semibold text-ink-500">New Project</span>
      </div>

      <div className="px-5 py-6 sm:px-8">
        <ProgressSteps steps={STEPS} currentIndex={stepIndex} className="mx-auto max-w-xl" />
      </div>

      <div className="flex-1 px-5 pb-32 sm:px-8">
        <div className="mx-auto max-w-xl">
          {stepIndex === 0 && (
            <div>
              <h2 className="font-display text-xl font-semibold text-ink-900">Who is this project for?</h2>
              <p className="mt-1 text-sm text-ink-500">Pick an existing client or add a new one.</p>

              <div className="relative mt-5">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400" />
                <input
                  value={clientQuery}
                  onChange={(e) => setClientQuery(e.target.value)}
                  placeholder="Search clients..."
                  className="h-13 w-full rounded-[--radius-md] border-2 border-ink-100 bg-white pl-12 pr-4 text-base text-ink-900 placeholder:text-ink-400 outline-none transition-colors focus:border-brass-500"
                />
              </div>

              <div className="mt-4 flex flex-col gap-2.5">
                {filteredClients.map((client) => {
                  const isSelected = clientId === client.id
                  return (
                    <button
                      key={client.id}
                      onClick={() => setClientId(client.id)}
                      className={cn(
                        'flex items-center gap-3.5 rounded-[--radius-md] border-2 px-4 py-3 text-left transition-colors',
                        isSelected ? 'border-brass-500 bg-brass-500/8' : 'border-ink-100 bg-white hover:border-ink-300',
                      )}
                    >
                      <Avatar name={client.name} color={client.avatarColor} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink-900">{client.name}</p>
                        <p className="truncate text-xs text-ink-500">{client.city || client.phone}</p>
                      </div>
                      {isSelected && (
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brass-500 text-white">
                          <Check className="h-4 w-4" />
                        </div>
                      )}
                    </button>
                  )
                })}
                {filteredClients.length === 0 && (
                  <p className="py-6 text-center text-sm text-ink-400">No clients match your search.</p>
                )}
              </div>

              {!showNewClient ? (
                <button
                  onClick={() => setShowNewClient(true)}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-[--radius-md] border-2 border-dashed border-ink-200 py-3.5 text-sm font-semibold text-ink-600 hover:border-ink-400 hover:bg-sand-50"
                >
                  <UserRound className="h-4 w-4" />
                  Add a New Client
                </button>
              ) : (
                <Card className="mt-4 flex flex-col gap-3">
                  <Input
                    label="Client Name"
                    placeholder="e.g. Ananya Mehta"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    autoFocus
                  />
                  <Input
                    label="Phone Number"
                    placeholder="+91 98765 43210"
                    inputMode="tel"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                  />
                  <div className="flex gap-2.5">
                    <Button variant="ghost" className="flex-1" onClick={() => setShowNewClient(false)}>
                      Cancel
                    </Button>
                    <Button className="flex-1" onClick={handleCreateNewClient}>
                      Save Client
                    </Button>
                  </div>
                </Card>
              )}
            </div>
          )}

          {stepIndex === 1 && (
            <div>
              <h2 className="font-display text-xl font-semibold text-ink-900">Project details</h2>
              <p className="mt-1 text-sm text-ink-500">A quick overview — you can refine this anytime.</p>

              <div className="mt-5 flex flex-col gap-4">
                <Input
                  label="Project Name"
                  placeholder={selectedClient ? `${selectedClient.name.split(' ')[0]} Residence` : 'Project name'}
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  autoFocus
                />

                <div>
                  <span className="mb-1.5 block text-sm font-semibold text-ink-700">Project Type</span>
                  <div className="flex flex-wrap gap-2">
                    {PROJECT_TYPES.map(([type, label]) => (
                      <button
                        key={type}
                        onClick={() => setProjectType(type)}
                        className={cn(
                          'h-10 rounded-full border-2 px-4 text-sm font-semibold transition-colors',
                          projectType === type
                            ? 'border-ink-900 bg-ink-900 text-sand-50'
                            : 'border-ink-100 bg-white text-ink-600 hover:border-ink-300',
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <Input
                  label="Site Address"
                  placeholder="Flat / villa, building, area, city"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Budget Estimate"
                    placeholder="0"
                    inputMode="numeric"
                    prefix="₹"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value.replace(/[^0-9]/g, ''))}
                  />
                  <Input
                    label="Target Date"
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {stepIndex === 2 && (
            <div>
              <h2 className="font-display text-xl font-semibold text-ink-900">Select rooms</h2>
              <p className="mt-1 text-sm text-ink-500">
                Choose the rooms in scope. You can add or remove rooms anytime from the project.
              </p>

              <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4">
                {ROOM_TYPE_OPTIONS.map((option) => {
                  const Icon = getRoomIcon(option.icon)
                  const isSelected = selectedRoomTypes.includes(option.type)
                  return (
                    <button
                      key={option.type}
                      onClick={() => toggleRoomType(option.type)}
                      className={cn(
                        'flex flex-col items-center gap-2 rounded-[--radius-md] border-2 px-2 py-3.5 text-center transition-colors',
                        isSelected
                          ? 'border-brass-500 bg-brass-500/8'
                          : 'border-ink-100 bg-white hover:border-ink-300',
                      )}
                    >
                      <Icon className={cn('h-6 w-6', isSelected ? 'text-brass-600' : 'text-ink-500')} />
                      <span
                        className={cn(
                          'text-xs font-semibold leading-tight',
                          isSelected ? 'text-brass-700' : 'text-ink-600',
                        )}
                      >
                        {option.label}
                      </span>
                    </button>
                  )
                })}
              </div>
              <p className="mt-4 text-sm font-medium text-ink-500">
                {selectedRoomTypes.length} room{selectedRoomTypes.length === 1 ? '' : 's'} selected
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-ink-100 bg-white px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-xl gap-3">
          {stepIndex < STEPS.length - 1 ? (
            <Button
              fullWidth
              size="xl"
              icon={<ArrowRight className="h-5 w-5" />}
              iconPosition="right"
              disabled={(stepIndex === 0 && !canProceedStep0) || (stepIndex === 1 && !canProceedStep1)}
              onClick={handleNext}
            >
              Continue
            </Button>
          ) : (
            <Button fullWidth size="xl" onClick={handleCreateProject}>
              Create Project
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
