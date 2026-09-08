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
 * AURA CANVAS -> CALCULATOR INTEGRATION — a lightweight source reference
 * for a calculation started from a Canvas selection, per the milestone's
 * "source traceability" requirement. Groundwork for future reverse
 * navigation (BOQ item <- Calculator result <- Canvas object) only — this
 * milestone doesn't build that navigation, just records enough to make it
 * possible later.
 */
export interface CalculationSourceInfo {
  sourceType: 'canvas'
  sourceObjectId: string
  /** The Canvas view this object was selected in — 'plan', 'wall-1'..'wall-4', or 'perspective'. */
  canvasView: string
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
  /** Present only when this calculation started from a Canvas selection. */
  source?: CalculationSourceInfo
  unit: CanvasUnit
  inputs: Record<string, number>
  result: Record<string, number>
  formulaVersion: number
  createdAt: string
  updatedAt: string
}

/**
 * What AuraCanvasPage hands to CalculatorPage via router navigation state
 * when launching a calculator from a Canvas selection ("Use in Calculator").
 * Ephemeral (not persisted) — a fresh page load or a navigation that
 * doesn't pass this state simply means no canvas prefill, same as opening
 * a calculator normally.
 */
export interface CanvasCalculatorHandoff {
  /** Keyed exactly like the target calculator's own Inputs interface — see lib/canvasCalculatorAdapter.ts. */
  canvasPrefill: Record<string, number>
  canvasUnit: CanvasUnit
  sourceObjectId: string
  canvasView: string
}

/** What "Add to BOQ" needs — deliberately shaped like Omit<RoomItem, 'id'> minus rate/masterRate, which AddItemSheet already collects from the user or the catalogue. */
export interface CalculatorBoqSuggestion {
  name: string
  category: string
  description?: string
  quantity: number
  unit: 'sqft' | 'rft'
}

/** What a calculator hands back to CalculatorPage to save — CalculatorPage attaches calculatorId/projectId/roomId/source itself, since only it knows them. */
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
  /**
   * AURA CANVAS -> CALCULATOR INTEGRATION — inputs prefilled from a
   * Canvas-selected object's real geometry, keyed exactly like this
   * calculator's own Inputs interface (e.g. Area's {lengthMm, widthMm}).
   * Only seeds each field's initial value — every value stays fully
   * user-editable afterward, same as a room-dimension prefill.
   */
  canvasPrefill?: Record<string, number>
  /** The unit Canvas was displaying in when this calculator was launched from it. */
  canvasUnit?: CanvasUnit
  /** Pre-formatted "Project: X · Room: Y · Source: Canvas · View" context line — shown only when this calculator was opened from a Canvas selection. */
  canvasSourceLabel?: string
  onBack: () => void
  onSaveCalculation: (payload: CalculatorSavePayload) => void
  onAddToBoq?: (suggestion: CalculatorBoqSuggestion) => void
}
