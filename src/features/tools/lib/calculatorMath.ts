// Interior Tools — pure calculation functions.
//
// Every calculator works internally in millimetres (matching Canvas's own
// "internal document coordinates are millimetres" convention — see
// lib/units.ts) and only converts at the edges: length INPUT unit
// conversion goes entirely through lib/units.ts (never reimplemented here),
// and the mm-per-foot constant used for area conversions below is derived
// from that same module (`unitValueToMm(1, 'ft')`) rather than hard-coded a
// second time.
//
// No premature rounding: every function here returns full-precision
// numbers. Rounding only happens at display time (components decide how
// many decimals to show) or where a real-world final quantity genuinely
// has to be a whole unit (a tile count, a board count) — those are called
// out explicitly below.
//
// `formulaVersion` on each result is a plain integer bumped only if a
// formula's definition changes — see SavedCalculation in ../types.ts,
// which stores it so a saved calculation stays reproducible even if a
// later AURA version tweaks the math.

import { unitValueToMm } from '@/lib/units'

const MM_PER_FOOT = unitValueToMm(1, 'ft')
const MM2_PER_SQFT = MM_PER_FOOT * MM_PER_FOOT
const MM2_PER_M2 = 1000 * 1000

export function mm2ToSqft(areaMm2: number): number {
  return areaMm2 / MM2_PER_SQFT
}

export function mm2ToM2(areaMm2: number): number {
  return areaMm2 / MM2_PER_M2
}

export function m2ToSqft(areaM2: number): number {
  return (areaM2 * MM2_PER_M2) / MM2_PER_SQFT
}

export function mmToRunningFeet(lengthMm: number): number {
  return lengthMm / MM_PER_FOOT
}

export function mmToMetres(lengthMm: number): number {
  return lengthMm / 1000
}

/**
 * Flattens one of the typed Result objects above into the plain numeric
 * record SavedCalculation.result expects — drops `formulaVersion` (already
 * stored as its own field on SavedCalculation) and any unset optional
 * fields (e.g. Flooring's `boxes`, False Ceiling's `amount`), rather than
 * writing 'undefined' into a record that's meant to hold numbers.
 */
export function toResultRecord(result: object): Record<string, number> {
  const record: Record<string, number> = {}
  for (const [key, value] of Object.entries(result)) {
    if (key === 'formulaVersion') continue
    if (typeof value === 'number') record[key] = value
  }
  return record
}

// ---------------------------------------------------------------- Area

export interface AreaInputs {
  lengthMm: number
  widthMm: number
}

export interface AreaResult {
  formulaVersion: 1
  areaMm2: number
  areaM2: number
  areaSqft: number
}

export function calculateArea(inputs: AreaInputs): AreaResult {
  const areaMm2 = Math.max(0, inputs.lengthMm) * Math.max(0, inputs.widthMm)
  return { formulaVersion: 1, areaMm2, areaM2: mm2ToM2(areaMm2), areaSqft: mm2ToSqft(areaMm2) }
}

// ---------------------------------------------------------------- Running Feet

export interface RunningFeetInputs {
  lengthMm: number
}

export interface RunningFeetResult {
  formulaVersion: 1
  lengthMm: number
  runningFeet: number
  runningMetres: number
}

export function calculateRunningFeet(inputs: RunningFeetInputs): RunningFeetResult {
  const lengthMm = Math.max(0, inputs.lengthMm)
  return { formulaVersion: 1, lengthMm, runningFeet: mmToRunningFeet(lengthMm), runningMetres: mmToMetres(lengthMm) }
}

// ---------------------------------------------------------------- Paint

export interface PaintInputs {
  wallLengthMm: number
  wallHeightMm: number
  coats: number
  /** Litres of paint one coat of one m² needs coverage for — entered as "m² per litre" (e.g. 10), matching how paint tins publish coverage. */
  coveragePerLitreM2: number
  wastagePercent: number
  /** Aggregate deduction for doors/windows/openings, in m² — a single number rather than per-opening rows, per the milestone's own worked example. */
  openingsM2: number
}

export interface PaintResult {
  formulaVersion: 1
  grossAreaM2: number
  openingsM2: number
  netAreaM2: number
  netAreaSqft: number
  coats: number
  coveragePerLitreM2: number
  baseLitres: number
  wastagePercent: number
  wastageLitres: number
  finalLitres: number
}

export function calculatePaint(inputs: PaintInputs): PaintResult {
  const grossAreaMm2 = Math.max(0, inputs.wallLengthMm) * Math.max(0, inputs.wallHeightMm)
  const grossAreaM2 = mm2ToM2(grossAreaMm2)
  const openingsM2 = Math.max(0, inputs.openingsM2)
  const netAreaM2 = Math.max(0, grossAreaM2 - openingsM2)
  const coats = Math.max(0, inputs.coats)
  const coveragePerLitreM2 = Math.max(0.0001, inputs.coveragePerLitreM2)
  const baseLitres = (netAreaM2 * coats) / coveragePerLitreM2
  const wastagePercent = Math.max(0, inputs.wastagePercent)
  const wastageLitres = baseLitres * (wastagePercent / 100)
  return {
    formulaVersion: 1,
    grossAreaM2,
    openingsM2,
    netAreaM2,
    netAreaSqft: m2ToSqft(netAreaM2),
    coats,
    coveragePerLitreM2,
    baseLitres,
    wastagePercent,
    wastageLitres,
    finalLitres: baseLitres + wastageLitres,
  }
}

// ---------------------------------------------------------------- Flooring / Tile

export interface FlooringInputs {
  roomLengthMm: number
  roomWidthMm: number
  tileLengthMm: number
  tileWidthMm: number
  wastagePercent: number
  /** 0 = not provided; box-count output is omitted. */
  tilesPerBox: number
}

export interface FlooringResult {
  formulaVersion: 1
  roomAreaM2: number
  roomAreaSqft: number
  tileAreaM2: number
  /** Exact (unrounded) tile count the room area alone requires. */
  theoreticalTiles: number
  wastagePercent: number
  wastageTiles: number
  /** A tile count is inherently a whole number in the real world — this is the one place a ceiling (not a premature round) is correct. */
  finalTiles: number
  boxes?: number
}

export function calculateFlooring(inputs: FlooringInputs): FlooringResult {
  const roomAreaMm2 = Math.max(0, inputs.roomLengthMm) * Math.max(0, inputs.roomWidthMm)
  const tileAreaMm2 = Math.max(0.0001, inputs.tileLengthMm) * Math.max(0.0001, inputs.tileWidthMm)
  const theoreticalTiles = roomAreaMm2 / tileAreaMm2
  const wastagePercent = Math.max(0, inputs.wastagePercent)
  const wastageTiles = theoreticalTiles * (wastagePercent / 100)
  const finalTiles = Math.ceil(theoreticalTiles + wastageTiles)
  const tilesPerBox = Math.max(0, inputs.tilesPerBox)
  return {
    formulaVersion: 1,
    roomAreaM2: mm2ToM2(roomAreaMm2),
    roomAreaSqft: mm2ToSqft(roomAreaMm2),
    tileAreaM2: mm2ToM2(tileAreaMm2),
    theoreticalTiles,
    wastagePercent,
    wastageTiles,
    finalTiles,
    boxes: tilesPerBox > 0 ? Math.ceil(finalTiles / tilesPerBox) : undefined,
  }
}

// ---------------------------------------------------------------- False Ceiling

export interface FalseCeilingInputs {
  lengthMm: number
  widthMm: number
  wastagePercent: number
  /** Board dimensions are optional — when both are 0, board-count output is omitted and only area+wastage are shown. */
  boardLengthMm: number
  boardWidthMm: number
  /** 0 = not provided; amount output is omitted. */
  ratePerSqft: number
}

export interface FalseCeilingResult {
  formulaVersion: 1
  ceilingAreaM2: number
  ceilingAreaSqft: number
  wastagePercent: number
  wastageAreaSqft: number
  finalAreaSqft: number
  theoreticalBoards?: number
  finalBoards?: number
  amount?: number
}

export function calculateFalseCeiling(inputs: FalseCeilingInputs): FalseCeilingResult {
  const ceilingAreaMm2 = Math.max(0, inputs.lengthMm) * Math.max(0, inputs.widthMm)
  const ceilingAreaSqft = mm2ToSqft(ceilingAreaMm2)
  const wastagePercent = Math.max(0, inputs.wastagePercent)
  const wastageAreaSqft = ceilingAreaSqft * (wastagePercent / 100)
  const finalAreaSqft = ceilingAreaSqft + wastageAreaSqft

  let theoreticalBoards: number | undefined
  let finalBoards: number | undefined
  if (inputs.boardLengthMm > 0 && inputs.boardWidthMm > 0) {
    const boardAreaMm2 = inputs.boardLengthMm * inputs.boardWidthMm
    theoreticalBoards = ceilingAreaMm2 / boardAreaMm2
    finalBoards = Math.ceil(theoreticalBoards * (1 + wastagePercent / 100))
  }

  return {
    formulaVersion: 1,
    ceilingAreaM2: mm2ToM2(ceilingAreaMm2),
    ceilingAreaSqft,
    wastagePercent,
    wastageAreaSqft,
    finalAreaSqft,
    theoreticalBoards,
    finalBoards,
    amount: inputs.ratePerSqft > 0 ? finalAreaSqft * inputs.ratePerSqft : undefined,
  }
}
