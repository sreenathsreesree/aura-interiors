import { calculateBaseAmount, calculatePricingBreakdown, groupBy, round2 } from './pricing'
import type { PricingBreakdown } from './pricing'
import type { PricingConfig, Quotation, QuotationItem } from '@/types'

// Everything here reuses the pricing engine's primitives (calculateBaseAmount,
// calculatePricingBreakdown) — a quotation never runs its own markup/discount/
// GST math. What's specific to a quotation is which items count toward the
// total (included vs excluded vs optional) and how they're grouped for the
// builder and preview.

export function quotationItemAmount(item: Pick<QuotationItem, 'quantity' | 'rate' | 'unit'>): number {
  return calculateBaseAmount(item.quantity, item.rate, item.unit)
}

/** Items that count toward the main grand total: included and not optional. */
export function includedQuotationItems(items: QuotationItem[]): QuotationItem[] {
  return items.filter((item) => item.isIncluded && !item.isOptional)
}

/** Included, but shown separately and excluded from the main total until made mandatory. */
export function optionalQuotationItems(items: QuotationItem[]): QuotationItem[] {
  return items.filter((item) => item.isIncluded && item.isOptional)
}

export function quotationSubtotal(items: QuotationItem[]): number {
  return round2(includedQuotationItems(items).reduce((sum, item) => sum + quotationItemAmount(item), 0))
}

export function optionalItemsSubtotal(items: QuotationItem[]): number {
  return round2(optionalQuotationItems(items).reduce((sum, item) => sum + quotationItemAmount(item), 0))
}

export function quotationPricingBreakdown(items: QuotationItem[], config: PricingConfig): PricingBreakdown {
  return calculatePricingBreakdown(quotationSubtotal(items), config, 1)
}

export interface QuotationCategoryGroup {
  category: string
  items: QuotationItem[]
  subtotal: number
}

export interface QuotationRoomGroup {
  roomId: string
  roomName: string
  categories: QuotationCategoryGroup[]
  subtotal: number
}

/** Groups Room → Category → Item, preserving the items' existing order. */
export function groupQuotationItemsByRoom(items: QuotationItem[]): QuotationRoomGroup[] {
  const byRoom = groupBy(items, (item) => item.roomId)
  return Array.from(byRoom.entries()).map(([roomId, roomItems]) => {
    const byCategory = groupBy(roomItems, (item) => item.category)
    const categories: QuotationCategoryGroup[] = Array.from(byCategory.entries()).map(
      ([category, categoryItems]) => ({
        category,
        items: categoryItems,
        subtotal: round2(categoryItems.reduce((sum, item) => sum + quotationItemAmount(item), 0)),
      }),
    )
    return {
      roomId,
      roomName: roomItems[0].roomName,
      categories,
      subtotal: round2(categories.reduce((sum, cat) => sum + cat.subtotal, 0)),
    }
  })
}

/** QT-{year}-{sequence}, sequence resets per year based on existing quotations. */
export function generateQuotationNumber(existingQuotations: Quotation[], date: Date = new Date()): string {
  const prefix = `QT-${date.getFullYear()}-`
  const sequence = existingQuotations.filter((q) => q.quotationNumber.startsWith(prefix)).length + 1
  return `${prefix}${String(sequence).padStart(3, '0')}`
}
