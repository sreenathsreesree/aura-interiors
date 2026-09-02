// AURA CANVAS V3C — centralized measurement unit conversion/formatting.
//
// Canvas geometry is ALWAYS stored internally in millimetres, in every
// CanvasObject and in every engine calculation. Nothing in this file (or
// anywhere that imports it) is allowed to feed a converted value back into
// `doc.objects` — these functions only convert at the display/input edges,
// so switching the project's display unit back and forth can never move,
// resize, or lose precision on stored geometry.

export type CanvasUnit = 'mm' | 'cm' | 'm' | 'in' | 'ft' | 'ftin'

export const UNIT_LABELS: Record<CanvasUnit, string> = {
  mm: 'mm',
  cm: 'cm',
  m: 'm',
  in: 'in',
  ft: 'ft',
  ftin: "ft + in",
}

const MM_PER_INCH = 25.4
const MM_PER_FOOT = MM_PER_INCH * 12 // 304.8

/** Raw mm -> unit conversion factor for the simple (non-composite) units. */
function mmPerUnit(unit: Exclude<CanvasUnit, 'ftin'>): number {
  switch (unit) {
    case 'mm':
      return 1
    case 'cm':
      return 10
    case 'm':
      return 1000
    case 'in':
      return MM_PER_INCH
    case 'ft':
      return MM_PER_FOOT
  }
}

/** A sensible default NumberStepper increment, expressed in mm, for the given display unit. */
export function defaultStepMm(unit: CanvasUnit): number {
  switch (unit) {
    case 'mm':
      return 10
    case 'cm':
      return 10 // 1cm
    case 'm':
      return 100 // 0.1m
    case 'in':
      return MM_PER_INCH / 2 // 0.5in
    case 'ft':
    case 'ftin':
      return MM_PER_FOOT / 12 // 1in, a practical increment either way
  }
}

/** How many decimal places to round a converted display value to, per unit. */
function displayDecimals(unit: Exclude<CanvasUnit, 'ftin'>): number {
  switch (unit) {
    case 'mm':
      return 0
    case 'cm':
      return 1
    case 'm':
      return 2
    case 'in':
      return 2
    case 'ft':
      return 2
  }
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/** mm -> a plain number in the given unit (not usable for 'ftin', which has no single numeric value). */
export function mmToUnitValue(mm: number, unit: Exclude<CanvasUnit, 'ftin'>): number {
  return round(mm / mmPerUnit(unit), displayDecimals(unit))
}

/** unit value -> mm, full precision (no rounding — only display rounds). */
export function unitValueToMm(value: number, unit: Exclude<CanvasUnit, 'ftin'>): number {
  return value * mmPerUnit(unit)
}

export interface FeetInches {
  feet: number
  inches: number // 0 <= inches < 12, may carry a fraction
}

export function mmToFeetInches(mm: number): FeetInches {
  const totalInches = mm / MM_PER_INCH
  const sign = totalInches < 0 ? -1 : 1
  const abs = Math.abs(totalInches)
  let feet = Math.floor(abs / 12)
  let inches = round(abs - feet * 12, 2)
  if (inches >= 12) {
    // Rounding an inches value like 11.996 up to 12.00 would otherwise print "7' 12.00"".
    inches -= 12
    feet += 1
  }
  return { feet: feet * sign, inches: sign < 0 && feet === 0 ? -inches : inches }
}

/** Feet+inches -> mm, full precision. */
export function feetInchesToMm(feet: number, inches: number): number {
  return (feet * 12 + inches) * MM_PER_INCH
}

/**
 * The single source of truth for how a millimetre length prints in Canvas —
 * property panels, live/automatic dimensions, the Measure tool, precision
 * creation, arc/line labels, grid readouts, everything.
 */
export function formatLength(mm: number, unit: CanvasUnit): string {
  if (unit === 'ftin') {
    const { feet, inches } = mmToFeetInches(mm)
    return `${feet}' ${inches.toFixed(2).replace(/\.?0+$/, '') || '0'}"`
  }
  const value = mmToUnitValue(mm, unit)
  const decimals = displayDecimals(unit)
  return `${value.toFixed(decimals)} ${UNIT_LABELS[unit]}`
}

/** Same as formatLength but without the trailing unit suffix — for compact combined labels like "2400 × 750 mm". */
export function formatLengthValue(mm: number, unit: CanvasUnit): string {
  if (unit === 'ftin') {
    const { feet, inches } = mmToFeetInches(mm)
    return `${feet}'${inches.toFixed(2).replace(/\.?0+$/, '') || '0'}"`
  }
  const value = mmToUnitValue(mm, unit)
  return value.toFixed(displayDecimals(unit))
}

export function unitSuffix(unit: CanvasUnit): string {
  return UNIT_LABELS[unit]
}

/** "2400 × 750 mm" — width/height sharing one unit suffix (or two ft+in groups with no shared suffix). */
export function formatLengthPair(aMm: number, bMm: number, unit: CanvasUnit): string {
  if (unit === 'ftin') return `${formatLength(aMm, unit)} × ${formatLength(bMm, unit)}`
  return `${formatLengthValue(aMm, unit)} × ${formatLengthValue(bMm, unit)} ${unitSuffix(unit)}`
}

/**
 * The plain-number editing value for a NumberStepper bound to a length field
 * — used only by units that have one (everything except ft+in, which uses
 * its own free-text field instead).
 */
export function mmToEditableNumber(mm: number, unit: Exclude<CanvasUnit, 'ftin'>): number {
  return mmToUnitValue(mm, unit)
}

export class LengthParseError extends Error {}

/**
 * Parses user text input in the given display unit back to mm. Accepts
 * plain numbers for mm/cm/m/in/ft. For 'ftin' it accepts practical
 * interior-design notation:
 *   7' 10"      5'6"      2' 3.5"      7 ft 10 in      94.49 (bare inches)
 * Throws LengthParseError with a short, user-facing message on invalid input
 * — callers should catch it and show the message rather than let it throw
 * through to the UI.
 */
export function parseLength(input: string, unit: CanvasUnit): number {
  const text = input.trim()
  if (text === '') throw new LengthParseError('Enter a value')

  if (unit !== 'ftin') {
    const n = Number(text)
    if (!Number.isFinite(n)) throw new LengthParseError(`"${text}" isn't a number`)
    return unitValueToMm(n, unit)
  }

  // ft+in notation: feet marked by ' or "ft", inches by " or "in", either part optional.
  const normalized = text.replace(/\s+/g, ' ').trim()
  const full = normalized.match(/^(-?\d+(?:\.\d+)?)\s*(?:'|ft)\s*(\d+(?:\.\d+)?)?\s*(?:"|in)?\s*$/i)
  if (full) {
    const feet = Number(full[1])
    const inches = full[2] ? Number(full[2]) : 0
    return feetInchesToMm(feet, inches)
  }
  const inchesOnly = normalized.match(/^(-?\d+(?:\.\d+)?)\s*(?:"|in)$/i)
  if (inchesOnly) return feetInchesToMm(0, Number(inchesOnly[1]))
  const bareNumber = Number(normalized)
  if (Number.isFinite(bareNumber)) return feetInchesToMm(0, bareNumber) // bare number = inches, matching the ft+in field's own display
  throw new LengthParseError(`Try "7' 10"" or a plain number of inches`)
}
