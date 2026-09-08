import { useState } from 'react'
import { Button, NumberStepper } from '@/components/ui'
import { LengthField } from '@/features/canvas/LengthField'
import { formatLength, type CanvasUnit } from '@/lib/units'
import { calculatePaint, toResultRecord } from '../lib/calculatorMath'
import { CalculatorShell } from '../components/CalculatorShell'
import { ResultRow } from '../components/ResultRow'
import { UnitPicker } from '../components/UnitPicker'
import { UseRoomDimensionsCard } from '../components/UseRoomDimensionsCard'
import type { CalculatorComponentProps } from '../types'

// Estimated paint quantity — deliberately labelled "estimated" throughout,
// per the milestone's "do not pretend these are manufacturer-certified
// quantities" instruction. Coverage and wastage are plain editable inputs
// (defaulted to common values), not hidden assumptions.
export function PaintCalculator({
  roomName,
  roomLengthMm,
  roomWidthMm,
  canvasPrefill,
  canvasUnit,
  canvasSourceLabel,
  onBack,
  onSaveCalculation,
  onAddToBoq,
}: CalculatorComponentProps) {
  const [unit, setUnit] = useState<CanvasUnit>(canvasUnit ?? 'ft')
  const [wallLengthMm, setWallLengthMm] = useState(() => canvasPrefill?.wallLengthMm ?? 0)
  const [wallHeightMm, setWallHeightMm] = useState(() => canvasPrefill?.wallHeightMm ?? 0)
  const [coats, setCoats] = useState(2)
  const [coveragePerLitreM2, setCoveragePerLitreM2] = useState(10)
  const [wastagePercent, setWastagePercent] = useState(10)
  const [openingsM2, setOpeningsM2] = useState(0)

  const result = calculatePaint({ wallLengthMm, wallHeightMm, coats, coveragePerLitreM2, wastagePercent, openingsM2 })
  const hasInput = wallLengthMm > 0 && wallHeightMm > 0

  function reset() {
    setWallLengthMm(0)
    setWallHeightMm(0)
    setCoats(2)
    setCoveragePerLitreM2(10)
    setWastagePercent(10)
    setOpeningsM2(0)
  }

  function useRoomDimensions() {
    if (roomLengthMm === undefined || roomWidthMm === undefined) return
    // A room's perimeter, not one wall, is the practical starting point for
    // a paint estimate — the designer can still edit it down to one wall.
    setWallLengthMm(2 * (roomLengthMm + roomWidthMm))
  }

  function handleSave() {
    onSaveCalculation({
      label: `Paint — ${formatLength(wallLengthMm, unit)} × ${formatLength(wallHeightMm, unit)}, ${coats} coats`,
      unit,
      inputs: { wallLengthMm, wallHeightMm, coats, coveragePerLitreM2, wastagePercent, openingsM2 },
      result: toResultRecord(result),
      formulaVersion: result.formulaVersion,
    })
  }

  function handleAddToBoq() {
    onAddToBoq?.({
      name: 'Wall Painting',
      category: 'Painting',
      description: `${coats} coats, ${coveragePerLitreM2} m²/L coverage, ${wastagePercent}% wastage — ${result.finalLitres.toFixed(2)} L estimated`,
      quantity: result.netAreaSqft,
      unit: 'sqft',
    })
  }

  return (
    <CalculatorShell
      title="Paint Calculator"
      subtitle="Wall area, coats and coverage to an estimated litre quantity."
      onBack={onBack}
      onReset={reset}
      sourceLabel={canvasSourceLabel}
      roomContext={
        roomName && roomLengthMm !== undefined && roomWidthMm !== undefined ? (
          <UseRoomDimensionsCard roomName={roomName} lengthMm={roomLengthMm} widthMm={roomWidthMm} unit={unit} onUse={useRoomDimensions} />
        ) : undefined
      }
      inputs={
        <>
          <UnitPicker unit={unit} onChange={setUnit} />
          <LengthField label="Wall Length" valueMm={wallLengthMm} unit={unit} onChangeMm={setWallLengthMm} />
          <LengthField label="Wall Height" valueMm={wallHeightMm} unit={unit} onChangeMm={setWallHeightMm} />
          <NumberStepper label="Coats" value={coats} onChange={setCoats} step={1} min={1} max={10} />
          <NumberStepper
            label="Coverage"
            value={coveragePerLitreM2}
            onChange={setCoveragePerLitreM2}
            step={0.5}
            min={0.5}
            suffix="m²/L"
          />
          <NumberStepper label="Openings (doors/windows)" value={openingsM2} onChange={setOpeningsM2} step={0.1} suffix="m²" />
          <NumberStepper label="Wastage" value={wastagePercent} onChange={setWastagePercent} step={1} max={100} suffix="%" />
        </>
      }
      results={
        <>
          <ResultRow label="Gross Wall Area" value={`${result.grossAreaM2.toFixed(2)} m²`} />
          <ResultRow label="Openings" value={`${result.openingsM2.toFixed(2)} m²`} />
          <ResultRow label="Net Paint Area" value={`${result.netAreaM2.toFixed(2)} m²`} />
          <ResultRow label="Coats" value={result.coats} />
          <ResultRow label="Coverage" value={`${result.coveragePerLitreM2.toFixed(1)} m²/L`} />
          <ResultRow label="Base Quantity" value={`${result.baseLitres.toFixed(2)} L`} />
          <ResultRow label="Wastage" value={`${result.wastagePercent}% · ${result.wastageLitres.toFixed(2)} L`} />
          <ResultRow label="Estimated Quantity" value={`${result.finalLitres.toFixed(2)} L`} emphasis />
        </>
      }
      footer={
        hasInput ? (
          <>
            {onAddToBoq && (
              <Button variant="outline" fullWidth onClick={handleAddToBoq}>
                Add to BOQ
              </Button>
            )}
            <Button fullWidth onClick={handleSave}>
              Save Calculation
            </Button>
          </>
        ) : undefined
      }
    />
  )
}
