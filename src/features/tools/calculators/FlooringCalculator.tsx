import { useState } from 'react'
import { Button, NumberStepper } from '@/components/ui'
import { LengthField } from '@/features/canvas/LengthField'
import { formatLength, type CanvasUnit } from '@/lib/units'
import { calculateFlooring, toResultRecord } from '../lib/calculatorMath'
import { CalculatorShell } from '../components/CalculatorShell'
import { ResultRow } from '../components/ResultRow'
import { UnitPicker } from '../components/UnitPicker'
import { UseRoomDimensionsCard } from '../components/UseRoomDimensionsCard'
import type { CalculatorComponentProps } from '../types'

export function FlooringCalculator({ roomName, roomLengthMm, roomWidthMm, onBack, onSaveCalculation, onAddToBoq }: CalculatorComponentProps) {
  const [unit, setUnit] = useState<CanvasUnit>('ft')
  const [tileUnit, setTileUnit] = useState<CanvasUnit>('mm')
  const [roomLen, setRoomLen] = useState(0)
  const [roomWid, setRoomWid] = useState(0)
  const [tileLen, setTileLen] = useState(0)
  const [tileWid, setTileWid] = useState(0)
  const [wastagePercent, setWastagePercent] = useState(10)
  const [tilesPerBox, setTilesPerBox] = useState(0)

  const result = calculateFlooring({
    roomLengthMm: roomLen,
    roomWidthMm: roomWid,
    tileLengthMm: tileLen,
    tileWidthMm: tileWid,
    wastagePercent,
    tilesPerBox,
  })
  const hasInput = roomLen > 0 && roomWid > 0 && tileLen > 0 && tileWid > 0

  function reset() {
    setRoomLen(0)
    setRoomWid(0)
    setTileLen(0)
    setTileWid(0)
    setWastagePercent(10)
    setTilesPerBox(0)
  }

  function useRoomDimensions() {
    if (roomLengthMm === undefined || roomWidthMm === undefined) return
    setRoomLen(roomLengthMm)
    setRoomWid(roomWidthMm)
  }

  function handleSave() {
    onSaveCalculation({
      label: `Flooring — ${formatLength(roomLen, unit)} × ${formatLength(roomWid, unit)} room, ${formatLength(tileLen, tileUnit)} × ${formatLength(tileWid, tileUnit)} tile`,
      unit,
      inputs: { roomLengthMm: roomLen, roomWidthMm: roomWid, tileLengthMm: tileLen, tileWidthMm: tileWid, wastagePercent, tilesPerBox },
      result: toResultRecord(result),
      formulaVersion: result.formulaVersion,
    })
  }

  function handleAddToBoq() {
    onAddToBoq?.({
      name: 'Flooring / Tiling',
      category: 'Flooring',
      description: `${formatLength(tileLen, tileUnit)} × ${formatLength(tileWid, tileUnit)} tiles, ${wastagePercent}% wastage — ${result.finalTiles} tiles${result.boxes ? ` (${result.boxes} boxes)` : ''}`,
      quantity: result.roomAreaSqft,
      unit: 'sqft',
    })
  }

  return (
    <CalculatorShell
      title="Flooring / Tile Calculator"
      subtitle="Room and tile size to a wastage-adjusted tile count."
      onBack={onBack}
      onReset={reset}
      roomContext={
        roomName && roomLengthMm !== undefined && roomWidthMm !== undefined ? (
          <UseRoomDimensionsCard roomName={roomName} lengthMm={roomLengthMm} widthMm={roomWidthMm} unit={unit} onUse={useRoomDimensions} />
        ) : undefined
      }
      inputs={
        <>
          <div>
            <span className="mb-1.5 block text-sm font-semibold text-ink-700">Room</span>
            <UnitPicker unit={unit} onChange={setUnit} className="mb-3" />
            <div className="flex flex-col gap-4">
              <LengthField label="Room Length" valueMm={roomLen} unit={unit} onChangeMm={setRoomLen} />
              <LengthField label="Room Width" valueMm={roomWid} unit={unit} onChangeMm={setRoomWid} />
            </div>
          </div>
          <div className="border-t border-ink-100 pt-5">
            <span className="mb-1.5 block text-sm font-semibold text-ink-700">Tile</span>
            <UnitPicker unit={tileUnit} onChange={setTileUnit} className="mb-3" />
            <div className="flex flex-col gap-4">
              <LengthField label="Tile Length" valueMm={tileLen} unit={tileUnit} onChangeMm={setTileLen} />
              <LengthField label="Tile Width" valueMm={tileWid} unit={tileUnit} onChangeMm={setTileWid} />
            </div>
          </div>
          <NumberStepper label="Wastage" value={wastagePercent} onChange={setWastagePercent} step={1} max={100} suffix="%" />
          <NumberStepper label="Tiles per Box (optional)" value={tilesPerBox} onChange={setTilesPerBox} step={1} suffix="tiles" />
        </>
      }
      results={
        <>
          <ResultRow label="Room Area" value={`${result.roomAreaM2.toFixed(2)} m²`} />
          <ResultRow label="Room Area (sqft)" value={`${result.roomAreaSqft.toFixed(2)} sqft`} />
          <ResultRow label="Tile Area" value={`${(result.tileAreaM2 * 10000).toFixed(0)} cm²`} />
          <ResultRow label="Theoretical Tiles" value={result.theoreticalTiles.toFixed(2)} />
          <ResultRow label="Wastage" value={`${result.wastagePercent}% · ${result.wastageTiles.toFixed(2)} tiles`} />
          <ResultRow label="Final Tile Quantity" value={`${result.finalTiles} tiles`} emphasis />
          {result.boxes !== undefined && <ResultRow label="Boxes Needed" value={`${result.boxes} boxes`} />}
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
