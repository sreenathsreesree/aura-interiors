import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { PageHeader, Badge, Card, EmptyState, IconButton } from '@/components/ui'
import { useAppStore } from '@/store/useAppStore'
import { useShallow } from 'zustand/react/shallow'
import { formatDate } from '@/lib/format'
import { getCalculatorDefinition, CALCULATOR_CATEGORY_LABEL, CALCULATOR_REGISTRY } from './registry'
import { getCalculatorIcon } from './icons'
import type { CalculatorCategory } from './types'

const CATEGORY_ORDER: CalculatorCategory[] = ['measurement', 'material', 'interior', 'estimation']

// Reused at both /tools (global, under the main Sidebar) and
// /projects/:projectId/rooms/:roomId/tools (room-scoped, reached from Room
// Builder) — the route params alone decide which context this renders in;
// CalculatorPage does the equivalent split for the calculator screen itself.
export function ToolsHubPage() {
  const navigate = useNavigate()
  const { projectId, roomId } = useParams<{ projectId?: string; roomId?: string }>()
  const room = useAppStore((s) => (roomId ? s.rooms.find((r) => r.id === roomId) : undefined))
  const roomCalculations = useAppStore(
    useShallow((s) => (roomId ? s.calculations.filter((c) => c.roomId === roomId) : [])),
  )
  const deleteCalculation = useAppStore((s) => s.deleteCalculation)

  function openCalculator(calculatorId: string) {
    if (projectId && roomId) {
      navigate(`/projects/${projectId}/rooms/${roomId}/tools/${calculatorId}`)
    } else {
      navigate(`/tools/${calculatorId}`)
    }
  }

  const categorized = CATEGORY_ORDER.map((category) => ({
    category,
    calculators: CALCULATOR_REGISTRY.filter((c) => c.category === category),
  }))

  const grid = (
    <div className="flex flex-col gap-8">
      {categorized.map(({ category, calculators }) => (
        <div key={category}>
          <h2 className="mb-3 font-display text-lg font-semibold text-ink-900">{CALCULATOR_CATEGORY_LABEL[category]}</h2>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
            {calculators.map((calc) => {
              const Icon = getCalculatorIcon(calc.icon)
              const isActive = calc.status === 'active'
              return (
                <Card
                  key={calc.id}
                  interactive={isActive}
                  onClick={isActive ? () => openCalculator(calc.id) : undefined}
                  className={isActive ? undefined : 'opacity-60'}
                >
                  <div className="flex items-start gap-3.5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[--radius-md] bg-brass-500/12 text-brass-600">
                      <Icon className="h-5.5 w-5.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-display text-base font-semibold text-ink-900">{calc.label}</h3>
                        {!isActive && (
                          <Badge tone="neutral" className="shrink-0">
                            Coming soon
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-ink-500">{calc.description}</p>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )

  if (projectId && roomId) {
    return (
      <div className="flex min-h-dvh flex-col">
        <div className="flex items-center gap-2 border-b border-ink-100 bg-sand-100/60 px-5 py-4 sm:px-8">
          <IconButton label="Back to room" variant="ghost" onClick={() => navigate(`/projects/${projectId}/rooms/${roomId}`)}>
            <ArrowLeft className="h-5 w-5" />
          </IconButton>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-wide text-ink-400">{room?.name ?? 'Room'}</p>
            <p className="text-xs text-ink-400">Interior Tools</p>
          </div>
        </div>
        <div className="border-b border-ink-100 bg-sand-100/60 px-5 py-4 sm:px-8">
          <h1 className="font-display text-2xl font-semibold text-ink-900">Interior Tools</h1>
          <p className="text-sm text-ink-500">Calculations prefill from {room?.name ?? 'this room'}'s dimensions.</p>
        </div>
        <div className="flex-1 px-5 py-6 sm:px-8">
          {room ? (
            <div className="flex flex-col gap-8">
              {grid}
              {roomCalculations.length > 0 && (
                <div>
                  <h2 className="mb-3 font-display text-lg font-semibold text-ink-900">
                    Saved Calculations ({roomCalculations.length})
                  </h2>
                  <Card padding="none">
                    <div className="divide-y divide-ink-100">
                      {roomCalculations.map((calc) => {
                        const Icon = getCalculatorIcon(getCalculatorDefinition(calc.calculatorId)?.icon ?? 'Calculator')
                        return (
                          <div key={calc.id} className="flex items-center gap-3.5 px-5 py-3.5">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[--radius-md] bg-brass-500/12 text-brass-600">
                              <Icon className="h-4.5 w-4.5" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-ink-900">{calc.label}</p>
                              <p className="text-xs text-ink-400">{formatDate(calc.createdAt)}</p>
                            </div>
                            <IconButton
                              label="Delete calculation"
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteCalculation(calc.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </IconButton>
                          </div>
                        )
                      })}
                    </div>
                  </Card>
                </div>
              )}
            </div>
          ) : (
            <EmptyState icon={<ArrowLeft className="h-8 w-8" />} title="Room not found" description="This room may have been removed." />
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Interior Tools" subtitle="Quick, transparent calculators that feed straight into a project's BOQ." />
      <div className="px-5 py-6 sm:px-8">{grid}</div>
    </div>
  )
}
