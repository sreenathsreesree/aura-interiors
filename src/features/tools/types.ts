// Interior Tools — shared types.
//
// Kept deliberately loose (Record<string, number> inputs/results rather
// than a rigid per-calculator discriminated union) so adding a new
// calculator never means touching a shared type — see registry.ts.

import type { CanvasUnit } from '@/lib/units'

export type CalculatorId =
  | 'area'
  | 'running-feet'
  | 'paint'
  | 'flooring'
  | 'false-ceiling'
  | 'plywood'
  | 'wardrobe'
  | 'kitchen'
  | 'wall-panel'
  | 'curtain'
  | 'lighting'
  | 'electrical'
  | 'project-estimate'

export type CalculatorCategory = 'measurement' | 'material' | 'interior' | 'estimation'

export interface CalculatorDefinition {
  id: CalculatorId
  label: string
  category: CalculatorCategory
  description: string
  icon: string
  /** 'active' calculators render their real form; 'coming-soon' ones show a placeholder card in the hub and are not routable. */
  status: 'active' | 'coming-soon'
}

/**
 * A calculation a designer chose to keep — enough to both display it later
 * and reproduce it exactly (inputs + unit + which formula version produced
 * the result), per the milestone's "store enough information to reproduce
 * the calculation" requirement.
 */
export interface SavedCalculation {
  id: string
  calculatorId: CalculatorId
  label: string
  projectId?: string
  roomId?: string
  unit: CanvasUnit
  inputs: Record<string, number>
  result: Record<string, number>
  formulaVersion: number
  createdAt: string
  updatedAt: string
}

/** What "Add to BOQ" needs — deliberately shaped like Omit<RoomItem, 'id'> minus rate/masterRate, which AddItemSheet already collects from the user or the catalogue. */
export interface CalculatorBoqSuggestion {
  name: string
  category: string
  description?: string
  quantity: number
  unit: 'sqft' | 'rft'
}

/** What a calculator hands back to CalculatorPage to save — CalculatorPage attaches calculatorId/projectId/roomId itself, since only it knows them. */
export interface CalculatorSavePayload {
  label: string
  unit: CanvasUnit
  inputs: Record<string, number>
  result: Record<string, number>
  formulaVersion: number
}

/** Shared props every calculator component receives from CalculatorPage — room context (for prefill) and the two "do something with this result" callbacks. onAddToBoq is undefined when there's no room to add to. */
export interface CalculatorComponentProps {
  roomName?: string
  roomLengthMm?: number
  roomWidthMm?: number
  onBack: () => void
  onSaveCalculation: (payload: CalculatorSavePayload) => void
  onAddToBoq?: (suggestion: CalculatorBoqSuggestion) => void
}
