import { useState } from 'react'
import { Button, NumberStepper } from '@/components/ui'
import { LengthField } from '@/features/canvas/LengthField'
import { formatCurrency } from '@/lib/format'
import { formatLength, type CanvasUnit } from '@/lib/units'
import { calculateFalseCeiling, toResultRecord } from '../lib/calculatorMath'
import { CalculatorShell } from '../components/CalculatorShell'
import { ResultRow } from '../components/ResultRow'
import { UnitPicker } from '../components/UnitPicker'
import { UseRoomDimensionsCard } from '../components/UseRoomDimensionsCard'
import type { CalculatorComponentProps } from '../types'

// A practical area + wastage + optional board-count estimate — not a full
// structural material schedule (framing, hangers, joints), per the
// milestone's explicit "keep this practical rather than pretending to
// produce a complete schedule" instruction.
export function FalseCeilingCalculator({ roomName, roomLengthMm, roomWidthMm, onBack, onSaveCalculation, onAddToBoq }: CalculatorComponentProps) {
  const [unit, setUnit] = useState<CanvasUnit>('ft')
  const [boardUnit, setBoardUnit] = useState<CanvasUnit>('mm')
  const [lengthMm, setLengthMm] = useState(0)
  const [widthMm, setWidthMm] = useState(0)
  const [wastagePercent, setWastagePercent] = useState(10)
  const [boardLengthMm, setBoardLengthMm] = useState(0)
  const [boardWidthMm, setBoardWidthMm] = useState(0)
  const [ratePerSqft, setRatePerSqft] = useState(0)

  const result = calculateFalseCeiling({ lengthMm, widthMm, wastagePercent, boardLengthMm, boardWidthMm, ratePerSqft })
  const hasInput = lengthMm > 0 && widthMm > 0

  function reset() {
    setLengthMm(0)
    setWidthMm(0)
    setWastagePercent(10)
    setBoardLengthMm(0)
    setBoardWidthMm(0)
    setRatePerSqft(0)
  }

  function useRoomDimensions() {
    if (roomLengthMm === undefined || roomWidthMm === undefined) return
    setLengthMm(roomLengthMm)
    setWidthMm(roomWidthMm)
  }

  function handleSave() {
    onSaveCalculation({
      label: `False Ceiling — ${formatLength(lengthMm, unit)} × ${formatLength(widthMm, unit)}`,
      unit,
      inputs: { lengthMm, widthMm, wastagePercent, boardLengthMm, boardWidthMm, ratePerSqft },
      result: toResultRecord(result),
      formulaVersion: result.formulaVersion,
    })
  }

  function handleAddToBoq() {
    onAddToBoq?.({
      name: 'False Ceiling',
      category: 'False Ceiling',
      description: `${wastagePercent}% wastage${result.finalBoards ? ` — ${result.finalBoards} boards` : ''}`,
      quantity: result.ceilingAreaSqft,
      unit: 'sqft',
    })
  }

  return (
    <CalculatorShell
      title="False Ceiling Calculator"
      subtitle="Ceiling area, optional board size and wastage."
      onBack={onBack}
      onReset={reset}
      roomContext={
        roomName && roomLengthMm !== undefined && roomWidthMm !== undefined ? (
          <UseRoomDimensionsCard roomName={roomName} lengthMm={roomLengthMm} widthMm={roomWidthMm} unit={unit} onUse={useRoomDimensions} />
        ) : undefined
      }
      inputs={
        <>
          <UnitPicker unit={unit} onChange={setUnit} />
          <LengthField label="Length" valueMm={lengthMm} unit={unit} onChangeMm={setLengthMm} />
          <LengthField label="Width" valueMm={widthMm} unit={unit} onChangeMm={setWidthMm} />
          <NumberStepper label="Wastage" value={wastagePercent} onChange={setWastagePercent} step={1} max={100} suffix="%" />

          <div className="border-t border-ink-100 pt-5">
            <span className="mb-1.5 block text-sm font-semibold text-ink-700">Board Size (optional)</span>
            <UnitPicker unit={boardUnit} onChange={setBoardUnit} className="mb-3" />
            <div className="flex flex-col gap-4">
              <LengthField label="Board Length" valueMm={boardLengthMm} unit={boardUnit} onChangeMm={setBoardLengthMm} />
              <LengthField label="Board Width" valueMm={boardWidthMm} unit={boardUnit} onChangeMm={setBoardWidthMm} />
            </div>
          </div>

          <NumberStepper label="Rate (optional)" value={ratePerSqft} onChange={setRatePerSqft} step={5} suffix="₹/sqft" />
        </>
      }
      results={
        <>
          <ResultRow label="Ceiling Area" value={`${result.ceilingAreaM2.toFixed(2)} m²`} />
          <ResultRow label="Ceiling Area (sqft)" value={`${result.ceilingAreaSqft.toFixed(2)} sqft`} />
          <ResultRow label="Wastage" value={`${result.wastagePercent}% · ${result.wastageAreaSqft.toFixed(2)} sqft`} />
          <ResultRow label="Final Quantity" value={`${result.finalAreaSqft.toFixed(2)} sqft`} emphasis />
          {result.finalBoards !== undefined && (
            <ResultRow label="Estimated Boards" value={`${result.finalBoards} boards`} hint={`${result.theoreticalBoards?.toFixed(2)} theoretical, wastage-adjusted`} />
          )}
          {result.amount !== undefined && <ResultRow label="Estimated Amount" value={formatCurrency(result.amount)} />}
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
