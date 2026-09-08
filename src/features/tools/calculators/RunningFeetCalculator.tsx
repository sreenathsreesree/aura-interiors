import { useState } from 'react'
import { Button } from '@/components/ui'
import { LengthField } from '@/features/canvas/LengthField'
import { formatLength, type CanvasUnit } from '@/lib/units'
import { calculateRunningFeet, toResultRecord } from '../lib/calculatorMath'
import { CalculatorShell } from '../components/CalculatorShell'
import { ResultRow } from '../components/ResultRow'
import { UnitPicker } from '../components/UnitPicker'
import { UseRoomDimensionsCard } from '../components/UseRoomDimensionsCard'
import type { CalculatorComponentProps } from '../types'

// A single length in running feet/metres — useful for wardrobes, kitchens,
// skirting, wall panels, counters and other linear interior work priced by
// running length rather than area.
export function RunningFeetCalculator({ roomName, roomLengthMm, roomWidthMm, onBack, onSaveCalculation, onAddToBoq }: CalculatorComponentProps) {
  const [unit, setUnit] = useState<CanvasUnit>('ft')
  const [lengthMm, setLengthMm] = useState(0)

  const result = calculateRunningFeet({ lengthMm })
  const hasInput = lengthMm > 0

  function reset() {
    setLengthMm(0)
  }

  function useRoomDimensions() {
    if (roomLengthMm === undefined) return
    setLengthMm(roomLengthMm)
  }

  function handleSave() {
    onSaveCalculation({
      label: `Running Feet — ${formatLength(lengthMm, unit)}`,
      unit,
      inputs: { lengthMm },
      result: toResultRecord(result),
      formulaVersion: result.formulaVersion,
    })
  }

  function handleAddToBoq() {
    onAddToBoq?.({
      name: 'Running Length',
      category: 'General',
      description: formatLength(lengthMm, unit),
      quantity: result.runningFeet,
      unit: 'rft',
    })
  }

  return (
    <CalculatorShell
      title="Running Feet Calculator"
      subtitle="A single length, in running feet and metres."
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
        </>
      }
      results={
        <>
          <ResultRow label="Running Feet" value={`${result.runningFeet.toFixed(2)} rft`} emphasis />
          <ResultRow label="Running Metres" value={`${result.runningMetres.toFixed(2)} m`} />
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
