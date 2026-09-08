import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Calculator as CalculatorIcon } from 'lucide-react'
import { Button, EmptyState } from '@/components/ui'
import { useAppStore } from '@/store/useAppStore'
import { unitValueToMm } from '@/lib/units'
import { AddItemSheet } from '@/features/rooms/AddItemSheet'
import type { RoomItem } from '@/types'
import { getCalculatorDefinition } from './registry'
import type {
  CalculatorBoqSuggestion,
  CalculatorComponentProps,
  CalculatorSavePayload,
  CalculatorId,
  CanvasCalculatorHandoff,
} from './types'
import { AreaCalculator } from './calculators/AreaCalculator'
import { RunningFeetCalculator } from './calculators/RunningFeetCalculator'
import { PaintCalculator } from './calculators/PaintCalculator'
import { FlooringCalculator } from './calculators/FlooringCalculator'
import { FalseCeilingCalculator } from './calculators/FalseCeilingCalculator'

// Registry -> component. Deliberately only lists the 'active' calculators —
// a coming-soon id (or an invalid one) simply isn't here, which is what
// drives the "not available" fallback below rather than a second status
// check duplicating registry.ts's own 'active'/'coming-soon' flag.
const CALCULATOR_COMPONENTS: Partial<Record<CalculatorId, (props: CalculatorComponentProps) => React.JSX.Element>> = {
  area: AreaCalculator,
  'running-feet': RunningFeetCalculator,
  paint: PaintCalculator,
  flooring: FlooringCalculator,
  'false-ceiling': FalseCeilingCalculator,
}

// Runs one calculator, reused at both /tools/:calculatorId (standalone) and
// /projects/:projectId/rooms/:roomId/tools/:calculatorId (room-scoped).
// Room context drives two things: dimension prefill (passed straight
// through to the calculator component) and whether "Add to BOQ" is offered
// at all — there's no BOQ to add to without a room.
export function CalculatorPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { projectId, roomId, calculatorId } = useParams<{ projectId?: string; roomId?: string; calculatorId: string }>()
  const room = useAppStore((s) => (roomId ? s.rooms.find((r) => r.id === roomId) : undefined))
  const project = useAppStore((s) => (projectId ? s.projects.find((p) => p.id === projectId) : undefined))
  const addItem = useAppStore((s) => s.addItem)
  const saveCalculation = useAppStore((s) => s.saveCalculation)

  // AURA CANVAS -> CALCULATOR INTEGRATION — set only when this route was
  // reached via "Use in Calculator" on a Canvas selection (see
  // AuraCanvasPage's launchCalculator). Absent on every normal open — a
  // fresh visit to this same URL, a reload, or opening from the Tools hub
  // all just mean no canvas prefill, same as before this milestone.
  const canvasHandoff = location.state as CanvasCalculatorHandoff | undefined
  const canvasViewLabel = canvasHandoff
    ? canvasHandoff.canvasView === 'plan'
      ? 'Plan'
      : canvasHandoff.canvasView === 'perspective'
        ? 'Perspective'
        : `Wall ${canvasHandoff.canvasView.replace('wall-', '')}`
    : undefined
  const canvasSourceLabel = canvasHandoff
    ? [project && `Project: ${project.name}`, room && `Room: ${room.name}`, `Source: Canvas · ${canvasViewLabel}`].filter(Boolean).join(' · ')
    : undefined

  const [boqSuggestion, setBoqSuggestion] = useState<CalculatorBoqSuggestion | null>(null)
  const [boqSheetKey, setBoqSheetKey] = useState(0)
  const [justSaved, setJustSaved] = useState(false)

  const definition = calculatorId ? getCalculatorDefinition(calculatorId) : undefined
  const Component = definition ? CALCULATOR_COMPONENTS[definition.id] : undefined

  function handleBack() {
    if (projectId && roomId) navigate(`/projects/${projectId}/rooms/${roomId}/tools`)
    else navigate('/tools')
  }

  if (!definition || !Component) {
    return (
      <div className="p-8">
        <EmptyState
          icon={<CalculatorIcon className="h-8 w-8" />}
          title="Calculator not available"
          description={
            definition?.status === 'coming-soon'
              ? `${definition.label} isn't built yet — it's on the roadmap.`
              : 'This calculator could not be found.'
          }
          action={<Button onClick={handleBack}>Back to Interior Tools</Button>}
        />
      </div>
    )
  }

  const roomLengthMm =
    room && room.dimensions.lengthFt > 0 ? unitValueToMm(room.dimensions.lengthFt, 'ft') : undefined
  const roomWidthMm = room && room.dimensions.widthFt > 0 ? unitValueToMm(room.dimensions.widthFt, 'ft') : undefined

  function handleSaveCalculation(payload: CalculatorSavePayload) {
    saveCalculation({
      calculatorId: definition!.id,
      projectId,
      roomId,
      source: canvasHandoff ? { sourceType: 'canvas', sourceObjectId: canvasHandoff.sourceObjectId, canvasView: canvasHandoff.canvasView } : undefined,
      ...payload,
    })
    setJustSaved(true)
    window.setTimeout(() => setJustSaved(false), 1800)
  }

  function handleAddToBoq(suggestion: CalculatorBoqSuggestion) {
    setBoqSuggestion(suggestion)
    setBoqSheetKey((k) => k + 1)
  }

  function handleAddItemSave(payload: Omit<RoomItem, 'id'>) {
    if (!roomId) return
    addItem(roomId, payload)
    setBoqSuggestion(null)
  }

  return (
    <>
      <Component
        roomName={room?.name}
        roomLengthMm={roomLengthMm}
        roomWidthMm={roomWidthMm}
        canvasPrefill={canvasHandoff?.canvasPrefill}
        canvasUnit={canvasHandoff?.canvasUnit}
        canvasSourceLabel={canvasSourceLabel}
        onBack={handleBack}
        onSaveCalculation={handleSaveCalculation}
        onAddToBoq={roomId ? handleAddToBoq : undefined}
      />

      {roomId && (
        <AddItemSheet
          key={boqSheetKey}
          open={boqSuggestion !== null}
          onClose={() => setBoqSuggestion(null)}
          onSave={handleAddItemSave}
          prefill={
            boqSuggestion
              ? {
                  name: boqSuggestion.name,
                  category: boqSuggestion.category,
                  description: boqSuggestion.description,
                  unit: boqSuggestion.unit,
                  quantity: boqSuggestion.quantity,
                }
              : undefined
          }
        />
      )}

      {justSaved && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center lg:bottom-8">
          <div className="rounded-full bg-ink-900 px-4 py-2 text-sm font-semibold text-sand-50 shadow-[--shadow-float]">
            Calculation saved
          </div>
        </div>
      )}
    </>
  )
}
