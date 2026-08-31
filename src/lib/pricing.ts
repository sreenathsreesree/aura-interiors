import type { DiscountType, MeasurementUnit, PricingConfig, Room, RoomItem } from '@/types'

// Single source of truth for every money calculation in the app: item amounts,
// room breakdowns, project totals and (eventually) BOQ/quotation line items
// all flow through the functions below. Nothing here talks to React or the
// store — it's pure so it can be reused, tested and later shared with the
// BOQ/quotation generator without duplicating logic.

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/** quantity × rate, except lump-sum which is a flat rate regardless of quantity. */
export function calculateBaseAmount(quantity: number, rate: number, unit: MeasurementUnit): number {
  if (unit === 'lump-sum') return rate
  return round2(quantity * rate)
}

export function itemBaseAmount(item: Pick<RoomItem, 'quantity' | 'rate' | 'unit'>): number {
  return calculateBaseAmount(item.quantity, item.rate, item.unit)
}

export function roomSubtotal(room: Room): number {
  return round2(room.items.reduce((sum, item) => sum + itemBaseAmount(item), 0))
}

export function projectSubtotal(rooms: Room[]): number {
  return round2(rooms.reduce((sum, room) => sum + roomSubtotal(room), 0))
}

export interface PricingBreakdown {
  subtotal: number
  markupPercent: number
  markupAmount: number
  discountType: DiscountType
  discountValue: number
  discountAmount: number
  taxableAmount: number
  taxRatePercent: number
  taxAmount: number
  grandTotal: number
}

function calculateDiscountAmount(afterMarkup: number, discountType: DiscountType, discountValue: number): number {
  if (discountType === 'percentage') return round2(afterMarkup * (discountValue / 100))
  if (discountType === 'fixed') return round2(Math.min(discountValue, afterMarkup))
  return 0
}

/**
 * Runs one subtotal through the full pricing flow:
 * subtotal → markup → discount → taxable amount → GST → grand total.
 *
 * `share` (0–1) is this subtotal's proportion of whatever larger total it
 * belongs to. Percentage-based markup/discount/tax don't need it — they scale
 * on their own — but a *fixed* discount is configured once for a whole
 * project, so a room or line item must only claim its proportional slice of
 * it. Pass share=1 (the default) when calculating a standalone or top-level
 * total, so summing every room/item breakdown always reconciles exactly with
 * the project-level breakdown.
 */
export function calculatePricingBreakdown(
  subtotal: number,
  config: PricingConfig,
  share: number = 1,
): PricingBreakdown {
  const markupAmount = round2(subtotal * (config.markupPercent / 100))
  const afterMarkup = round2(subtotal + markupAmount)
  const discountAmount =
    config.discountType === 'fixed'
      ? round2(config.discountValue * share)
      : calculateDiscountAmount(afterMarkup, config.discountType, config.discountValue)
  const taxableAmount = round2(Math.max(0, afterMarkup - discountAmount))
  const taxAmount = round2(taxableAmount * (config.taxRatePercent / 100))
  const grandTotal = round2(taxableAmount + taxAmount)

  return {
    subtotal,
    markupPercent: config.markupPercent,
    markupAmount,
    discountType: config.discountType,
    discountValue: config.discountValue,
    discountAmount,
    taxableAmount,
    taxRatePercent: config.taxRatePercent,
    taxAmount,
    grandTotal,
  }
}

export function roomPricingBreakdown(room: Room, projectRooms: Room[], config: PricingConfig): PricingBreakdown {
  const subtotal = roomSubtotal(room)
  const total = projectSubtotal(projectRooms)
  const share = total > 0 ? subtotal / total : 0
  return calculatePricingBreakdown(subtotal, config, share)
}

export function projectPricingBreakdown(rooms: Room[], config: PricingConfig): PricingBreakdown {
  return calculatePricingBreakdown(projectSubtotal(rooms), config, 1)
}

// --- BOQ data foundation --------------------------------------------------
// A flat, per-item breakdown that both the future BOQ and quotation screens
// can read directly. Every line's finalAmount already carries its share of
// markup/discount/tax, so summing finalAmount across all lines reconciles
// with projectPricingBreakdown(rooms, config).grandTotal.

export interface BoqLineItem {
  roomId: string
  roomName: string
  itemId: string
  name: string
  category: string
  description?: string
  quantity: number
  unit: MeasurementUnit
  rate: number
  baseAmount: number
  markupAmount: number
  discountAmount: number
  taxAmount: number
  finalAmount: number
}

export function buildProjectBoqLines(rooms: Room[], config: PricingConfig): BoqLineItem[] {
  const total = projectSubtotal(rooms)

  return rooms.flatMap((room) =>
    room.items.map((item): BoqLineItem => {
      const baseAmount = itemBaseAmount(item)
      const share = total > 0 ? baseAmount / total : 0
      const breakdown = calculatePricingBreakdown(baseAmount, config, share)
      return {
        roomId: room.id,
        roomName: room.name,
        itemId: item.id,
        name: item.name,
        category: item.category,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        rate: item.rate,
        baseAmount,
        markupAmount: breakdown.markupAmount,
        discountAmount: breakdown.discountAmount,
        taxAmount: breakdown.taxAmount,
        finalAmount: breakdown.grandTotal,
      }
    }),
  )
}

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  markupPercent: 15,
  discountType: 'none',
  discountValue: 0,
  taxRatePercent: 18,
}

// --- BOQ grouping ----------------------------------------------------------
// Groups the same BOQ lines (Room → Category → Item) and rolls up subtotals
// at every level, purely by reducing buildProjectBoqLines — no separate
// quantities or prices are introduced, so this always reflects live room data.

export interface BoqCategoryGroup {
  category: string
  lines: BoqLineItem[]
  subtotal: number
}

export interface BoqRoomGroup {
  roomId: string
  roomName: string
  categories: BoqCategoryGroup[]
  subtotal: number
  itemCount: number
}

export interface BoqSubtotalEntry {
  label: string
  subtotal: number
}

export interface BoqSummary {
  totalItems: number
  roomSubtotals: BoqSubtotalEntry[]
  categorySubtotals: BoqSubtotalEntry[]
  breakdown: PricingBreakdown
}

export interface ProjectBoq {
  lines: BoqLineItem[]
  rooms: BoqRoomGroup[]
  summary: BoqSummary
}

function groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const key = keyOf(item)
    const bucket = map.get(key)
    if (bucket) bucket.push(item)
    else map.set(key, [item])
  }
  return map
}

export function buildProjectBoq(rooms: Room[], config: PricingConfig): ProjectBoq {
  const lines = buildProjectBoqLines(rooms, config)
  const linesByRoom = groupBy(lines, (l) => l.roomId)

  const roomGroups: BoqRoomGroup[] = rooms
    .filter((room) => room.items.length > 0)
    .map((room) => {
      const roomLines = linesByRoom.get(room.id) ?? []
      const linesByCategory = groupBy(roomLines, (l) => l.category)
      const categories: BoqCategoryGroup[] = Array.from(linesByCategory.entries()).map(
        ([category, categoryLines]) => ({
          category,
          lines: categoryLines,
          subtotal: round2(categoryLines.reduce((sum, l) => sum + l.baseAmount, 0)),
        }),
      )
      return {
        roomId: room.id,
        roomName: room.name,
        categories,
        subtotal: roomSubtotal(room),
        itemCount: roomLines.length,
      }
    })

  const categoryTotals = new Map<string, number>()
  for (const line of lines) {
    categoryTotals.set(line.category, (categoryTotals.get(line.category) ?? 0) + line.baseAmount)
  }

  return {
    lines,
    rooms: roomGroups,
    summary: {
      totalItems: lines.length,
      roomSubtotals: roomGroups.map((r) => ({ label: r.roomName, subtotal: r.subtotal })),
      categorySubtotals: Array.from(categoryTotals.entries()).map(([category, subtotal]) => ({
        label: category,
        subtotal: round2(subtotal),
      })),
      breakdown: projectPricingBreakdown(rooms, config),
    },
  }
}
