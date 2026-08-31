import { ArrowRight, Pencil } from 'lucide-react'
import { Sheet, Badge, Button } from '@/components/ui'
import { formatCurrency } from '@/lib/format'
import type { BoqLineItem } from '@/lib/pricing'
import type { RoomItem } from '@/types'

const UNIT_LABEL: Record<string, string> = {
  sqft: 'sqft',
  rft: 'rft',
  nos: 'nos',
  'lump-sum': 'lump sum',
}

function Row({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="font-medium text-ink-500">{label}</span>
      <span className={emphasize ? 'font-display text-lg font-semibold text-brass-700' : 'font-semibold text-ink-800'}>
        {value}
      </span>
    </div>
  )
}

interface BoqItemDetailSheetProps {
  open: boolean
  onClose: () => void
  line?: BoqLineItem
  roomItem?: RoomItem
  onEdit: () => void
  onGoToRoom: () => void
}

export function BoqItemDetailSheet({ open, onClose, line, roomItem, onEdit, onGoToRoom }: BoqItemDetailSheetProps) {
  if (!line) return null

  const isOverridden = Boolean(roomItem?.catalogueItemId) && roomItem?.rate !== roomItem?.masterRate

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={line.name}
      subtitle={`${line.roomName} · ${line.category}`}
      footer={
        <div className="flex gap-2.5">
          <Button variant="outline" className="flex-1" icon={<ArrowRight className="h-4 w-4" />} onClick={onGoToRoom}>
            Go to Room
          </Button>
          <Button className="flex-1" icon={<Pencil className="h-4 w-4" />} onClick={onEdit}>
            Edit Item
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 py-2">
        {line.description && (
          <p className="rounded-[--radius-md] bg-sand-100 px-4 py-3 text-sm text-ink-600">{line.description}</p>
        )}

        <div className="flex flex-col rounded-[--radius-md] border border-ink-100 p-4">
          <Row label="Quantity" value={`${line.quantity} ${UNIT_LABEL[line.unit] ?? line.unit}`} />
          <Row label="Project Rate" value={formatCurrency(line.rate)} />
          {roomItem && isOverridden && (
            <div className="mt-1 flex items-center justify-between py-1.5 text-sm">
              <span className="font-medium text-ink-500">Master Rate</span>
              <div className="flex items-center gap-2">
                <span className="text-ink-400 line-through">{formatCurrency(roomItem.masterRate)}</span>
                <Badge tone="terracotta">Overridden</Badge>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col rounded-[--radius-md] border border-ink-100 p-4">
          <Row label="Base Amount" value={formatCurrency(line.baseAmount)} />
          <Row label="Markup" value={`+ ${formatCurrency(line.markupAmount)}`} />
          {line.discountAmount > 0 && (
            <Row label="Discount" value={`− ${formatCurrency(line.discountAmount)}`} />
          )}
          <Row label="GST" value={`+ ${formatCurrency(line.taxAmount)}`} />
          <div className="mt-1.5 border-t border-ink-100 pt-2.5">
            <Row label="Final Amount" value={formatCurrency(line.finalAmount)} emphasize />
          </div>
        </div>
      </div>
    </Sheet>
  )
}
