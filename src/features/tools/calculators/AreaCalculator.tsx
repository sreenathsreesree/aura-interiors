import { useState } from 'react'
import { Button } from '@/components/ui'
import { LengthField } from '@/features/canvas/LengthField'
import { formatLength, type CanvasUnit } from '@/lib/units'
import { calculateArea, toResultRecord } from '../lib/calculatorMath'
import { CalculatorShell } from '../components/CalculatorShell'
import { ResultRow } from '../components/ResultRow'
import { UnitPicker } from '../components/UnitPicker'
import { UseRoomDimensionsCard } from '../components/UseRoomDimensionsCard'
import type { CalculatorComponentProps } from '../types'

export function AreaCalculator({
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
  const [lengthMm, setLengthMm] = useState(() => canvasPrefill?.lengthMm ?? 0)
  const [widthMm, setWidthMm] = useState(() => canvasPrefill?.widthMm ?? 0)

  const result = calculateArea({ lengthMm, widthMm })
  const hasInput = lengthMm > 0 && widthMm > 0

  function reset() {
    setLengthMm(0)
    setWidthMm(0)
  }

  function useRoomDimensions() {
    if (roomLengthMm === undefined || roomWidthMm === undefined) return
    setLengthMm(roomLengthMm)
    setWidthMm(roomWidthMm)
  }

  function handleSave() {
    onSaveCalculation({
      label: `Area — ${formatLength(lengthMm, unit)} × ${formatLength(widthMm, unit)}`,
      unit,
      inputs: { lengthMm, widthMm },
      result: toResultRecord(result),
      formulaVersion: result.formulaVersion,
    })
  }

  function handleAddToBoq() {
    onAddToBoq?.({
      name: 'Area',
      category: 'General',
      description: `${formatLength(lengthMm, unit)} × ${formatLength(widthMm, unit)}`,
      quantity: result.areaSqft,
      unit: 'sqft',
    })
  }

  return (
    <CalculatorShell
      title="Area Calculator"
      subtitle="Length × width, converted across units."
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
          <LengthField label="Length" valueMm={lengthMm} unit={unit} onChangeMm={setLengthMm} />
          <LengthField label="Width" valueMm={widthMm} unit={unit} onChangeMm={setWidthMm} />
        </>
      }
      results={
        <>
          <ResultRow label="Area" value={`${result.areaM2.toFixed(2)} m²`} emphasis />
          <ResultRow label="Area (sqft)" value={`${result.areaSqft.toFixed(2)} sqft`} />
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
