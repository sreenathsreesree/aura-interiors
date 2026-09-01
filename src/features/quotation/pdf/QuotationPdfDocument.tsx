import { Document, Page, Path, StyleSheet, Svg, Text, View } from '@react-pdf/renderer'
import { registerPdfFonts } from '@/lib/pdfFonts'
import { round2 } from '@/lib/pricing'
import { formatCurrency, formatDate, formatPercent } from '@/lib/format'
import {
  QUOTATION_UNIT_LABEL,
  groupQuotationItemsByRoom,
  includedQuotationItems,
  optionalItemsSubtotal,
  optionalQuotationItems,
  quotationItemAmount,
  quotationPricingBreakdown,
} from '@/lib/quotation'
import { QUOTATION_STATUS_META } from '@/data/statusMeta'
import type { Quotation, QuotationItem } from '@/types'
import type { QuotationRoomGroup } from '@/lib/quotation'

// This document renders the exact same Quotation snapshot as QuotationPreview,
// through the exact same lib/quotation + lib/pricing helpers — no calculation
// is ever duplicated here. Only presentation (PDF layout/pagination) differs.

registerPdfFonts()

const COLOR = {
  ink900: '#221f1b',
  ink800: '#322d27',
  ink700: '#453e36',
  ink600: '#5c5348',
  ink500: '#75695a',
  ink400: '#948676',
  ink200: '#d6cbb8',
  ink100: '#e8e0d1',
  sand50: '#fbf9f6',
  sand100: '#f6f1ea',
  brass500: '#b5893f',
  brass600: '#966f30',
  brass700: '#785828',
  terracotta600: '#954e32',
  sage600: '#576c51',
}

const STATUS_BG: Record<string, string> = {
  neutral: COLOR.ink100,
  brass: '#eaddc3',
  terracotta: '#ecd3c6',
  success: '#dbe4d7',
  danger: '#f0d7d0',
  ink: COLOR.ink200,
}

const STATUS_FG: Record<string, string> = {
  neutral: COLOR.ink600,
  brass: COLOR.brass700,
  terracotta: COLOR.terracotta600,
  success: COLOR.sage600,
  danger: '#8a3324',
  ink: COLOR.ink900,
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 54,
    paddingBottom: 46,
    paddingHorizontal: 40,
    fontFamily: 'Manrope',
    fontSize: 9.5,
    color: COLOR.ink700,
  },
  runningHeader: {
    position: 'absolute',
    top: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 0.75,
    borderBottomColor: COLOR.ink200,
    paddingBottom: 6,
  },
  runningHeaderText: {
    fontSize: 8,
    color: COLOR.ink400,
    letterSpacing: 0.5,
  },
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.75,
    borderTopColor: COLOR.ink200,
    paddingTop: 6,
  },
  footerText: {
    fontSize: 7.5,
    color: COLOR.ink400,
  },
  letterhead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1.5,
    borderBottomColor: COLOR.ink900,
    paddingBottom: 14,
    marginBottom: 16,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandName: {
    fontFamily: 'Fraunces',
    fontWeight: 600,
    fontSize: 16,
    color: COLOR.ink900,
  },
  brandTagline: {
    fontSize: 8,
    color: COLOR.ink400,
    marginTop: 2,
  },
  docTitle: {
    fontFamily: 'Fraunces',
    fontWeight: 600,
    fontSize: 18,
    color: COLOR.ink900,
    textAlign: 'right',
  },
  docNumber: {
    fontSize: 10,
    fontWeight: 600,
    color: COLOR.brass600,
    textAlign: 'right',
    marginTop: 2,
  },
  statusPill: {
    alignSelf: 'flex-end',
    marginTop: 6,
    borderRadius: 9,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  statusPillText: {
    fontSize: 7.5,
    fontWeight: 700,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 0.75,
    borderBottomColor: COLOR.ink100,
    paddingBottom: 14,
    marginBottom: 16,
  },
  metaCol: {
    maxWidth: '55%',
  },
  sectionLabel: {
    fontSize: 8,
    fontWeight: 700,
    color: COLOR.brass600,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  clientName: {
    fontFamily: 'Fraunces',
    fontWeight: 600,
    fontSize: 12,
    color: COLOR.ink900,
    marginBottom: 2,
  },
  metaLine: {
    fontSize: 9,
    color: COLOR.ink600,
    marginTop: 1,
  },
  metaLineRight: {
    fontSize: 9,
    color: COLOR.ink600,
    marginTop: 2,
    textAlign: 'right',
  },
  metaLineStrong: {
    fontWeight: 700,
    color: COLOR.ink900,
  },
  section: {
    marginBottom: 16,
  },
  roomBlock: {
    marginBottom: 10,
  },
  roomHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    borderBottomWidth: 0.75,
    borderBottomColor: COLOR.ink200,
    paddingBottom: 4,
    marginBottom: 4,
  },
  roomName: {
    fontFamily: 'Fraunces',
    fontWeight: 600,
    fontSize: 10.5,
    color: COLOR.ink900,
  },
  roomSubtotal: {
    fontSize: 9.5,
    fontWeight: 700,
    color: COLOR.ink700,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f1ece2',
  },
  itemLeft: {
    flex: 1,
    paddingRight: 10,
  },
  itemName: {
    fontSize: 9.5,
    color: COLOR.ink800,
  },
  itemDescription: {
    fontSize: 8,
    color: COLOR.ink400,
    marginTop: 1,
  },
  itemMeta: {
    fontSize: 8,
    color: COLOR.ink400,
    marginTop: 1,
  },
  itemAmount: {
    fontSize: 9.5,
    fontWeight: 700,
    color: COLOR.ink900,
  },
  emptyNote: {
    fontSize: 9,
    color: COLOR.ink400,
    fontStyle: 'italic',
  },
  optionalWrap: {
    marginTop: 4,
    paddingTop: 14,
    borderTopWidth: 0.75,
    borderTopColor: COLOR.ink200,
    borderTopStyle: 'dashed',
  },
  optionalTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 0.75,
    borderTopColor: COLOR.ink100,
  },
  optionalTotalLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: COLOR.ink600,
  },
  optionalTotalValue: {
    fontSize: 9,
    fontWeight: 700,
    color: COLOR.ink700,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  pricingLabel: {
    fontSize: 9.5,
    color: COLOR.ink600,
  },
  pricingLabelMuted: {
    fontSize: 9,
    color: COLOR.ink400,
  },
  pricingValue: {
    fontSize: 9.5,
    fontWeight: 700,
    color: COLOR.ink800,
  },
  pricingValueMuted: {
    fontSize: 9,
    fontWeight: 700,
    color: COLOR.ink400,
  },
  grandTotalBox: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLOR.ink900,
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  grandTotalLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: COLOR.sand50,
    letterSpacing: 0.5,
  },
  grandTotalValue: {
    fontFamily: 'Fraunces',
    fontWeight: 600,
    fontSize: 15,
    color: '#e7c589',
  },
  milestoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: COLOR.ink100,
  },
  milestoneLabel: {
    fontSize: 9.5,
    fontWeight: 700,
    color: COLOR.ink800,
  },
  milestonePercent: {
    fontWeight: 400,
    color: COLOR.ink400,
  },
  milestoneDescription: {
    fontSize: 8,
    color: COLOR.ink400,
    marginTop: 1,
  },
  milestoneAmount: {
    fontSize: 9.5,
    fontWeight: 700,
    color: COLOR.ink900,
  },
  termRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  termIndex: {
    width: 14,
    fontSize: 9,
    color: COLOR.ink400,
  },
  termText: {
    flex: 1,
    fontSize: 9,
    color: COLOR.ink600,
    lineHeight: 1.4,
  },
  notesText: {
    fontSize: 9,
    color: COLOR.ink600,
    lineHeight: 1.4,
  },
  brandFooter: {
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: 1.5,
    borderTopColor: COLOR.ink900,
    alignItems: 'center',
  },
  brandFooterName: {
    fontFamily: 'Fraunces',
    fontWeight: 600,
    fontSize: 11,
    color: COLOR.ink900,
  },
  brandFooterLine: {
    fontSize: 7.5,
    color: COLOR.ink500,
    marginTop: 3,
  },
})

function AuraMark() {
  return (
    <Svg width={16} height={16} viewBox="0 0 30 30">
      <Path d="M15 4L25 26" stroke={COLOR.brass500} strokeWidth={2.6} strokeLinecap="round" fill="none" />
      <Path d="M15 4L5 26" stroke={COLOR.ink900} strokeWidth={2.6} strokeLinecap="round" fill="none" />
      <Path d="M9.5 18H20.5" stroke={COLOR.ink900} strokeWidth={2.6} strokeLinecap="round" fill="none" />
    </Svg>
  )
}

function ItemRows({ items, muted }: { items: QuotationItem[]; muted?: boolean }) {
  return (
    <>
      {items.map((item) => (
        <View key={item.id} style={styles.itemRow} wrap={false}>
          <View style={styles.itemLeft}>
            <Text style={[styles.itemName, muted ? { color: COLOR.ink600 } : undefined]}>{item.name}</Text>
            {item.description ? <Text style={styles.itemDescription}>{item.description}</Text> : null}
            <Text style={styles.itemMeta}>
              {item.quantity} {QUOTATION_UNIT_LABEL[item.unit] ?? item.unit} × {formatCurrency(item.rate)}
            </Text>
          </View>
          <Text style={[styles.itemAmount, muted ? { color: COLOR.ink700 } : undefined]}>
            {formatCurrency(quotationItemAmount(item))}
          </Text>
        </View>
      ))}
    </>
  )
}

function RoomGroups({ groups, muted }: { groups: QuotationRoomGroup[]; muted?: boolean }) {
  return (
    <>
      {groups.map((room) => (
        <View key={room.roomId} style={styles.roomBlock}>
          <View style={styles.roomHeaderRow} minPresenceAhead={28}>
            <Text style={styles.roomName}>{room.roomName}</Text>
            <Text style={styles.roomSubtotal}>{formatCurrency(room.subtotal)}</Text>
          </View>
          {room.categories.map((cat) => (
            <ItemRows key={cat.category} items={cat.items} muted={muted} />
          ))}
        </View>
      ))}
    </>
  )
}

export function QuotationPdfDocument({ quotation }: { quotation: Quotation }) {
  const included = includedQuotationItems(quotation.items)
  const optional = optionalQuotationItems(quotation.items)
  const roomGroups = groupQuotationItemsByRoom(included)
  const optionalGroups = groupQuotationItemsByRoom(optional)
  const breakdown = quotationPricingBreakdown(quotation.items, quotation.pricing)
  const optionalTotal = optionalItemsSubtotal(quotation.items)
  const statusMeta = QUOTATION_STATUS_META[quotation.status]
  const hasDiscount = breakdown.discountAmount > 0

  return (
    <Document
      title={`${quotation.company.name} Quotation ${quotation.quotationNumber}`}
      author={quotation.company.name}
    >
      <Page size="A4" style={styles.page} wrap>
        {/* Repeating slim identification header on every page */}
        <View style={styles.runningHeader} fixed>
          <Text style={styles.runningHeaderText}>
            {quotation.quotationNumber}
            {quotation.revision > 1 ? ` · Rev ${quotation.revision}` : ''} · {quotation.clientName}
          </Text>
          <Text style={styles.runningHeaderText}>{quotation.company.name}</Text>
        </View>

        {/* Full letterhead — normal flow, appears once at the top of the document */}
        <View style={styles.letterhead}>
          <View>
            <View style={styles.brandRow}>
              <AuraMark />
              <Text style={styles.brandName}>{quotation.company.name}</Text>
            </View>
            <Text style={styles.brandTagline}>{quotation.company.tagline}</Text>
          </View>
          <View>
            <Text style={styles.docTitle}>QUOTATION</Text>
            <Text style={styles.docNumber}>
              {quotation.quotationNumber}
              {quotation.revision > 1 ? ` · Rev ${quotation.revision}` : ''}
            </Text>
            <View
              style={[
                styles.statusPill,
                { backgroundColor: STATUS_BG[statusMeta.tone] ?? COLOR.ink100 },
              ]}
            >
              <Text style={[styles.statusPillText, { color: STATUS_FG[statusMeta.tone] ?? COLOR.ink700 }]}>
                {statusMeta.label.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Client + details */}
        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <Text style={styles.sectionLabel}>Client</Text>
            <Text style={styles.clientName}>{quotation.clientName}</Text>
            <Text style={styles.metaLine}>{quotation.projectName}</Text>
            <Text style={[styles.metaLine, { color: COLOR.ink500 }]}>{quotation.projectLocation}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={[styles.sectionLabel, { textAlign: 'right' }]}>Details</Text>
            <Text style={styles.metaLineRight}>
              Date: <Text style={styles.metaLineStrong}>{formatDate(quotation.issueDate)}</Text>
            </Text>
            <Text style={styles.metaLineRight}>
              Valid Until: <Text style={styles.metaLineStrong}>{formatDate(quotation.validUntil)}</Text>
            </Text>
          </View>
        </View>

        {/* Scope of work */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Scope of Work</Text>
          {roomGroups.length === 0 ? (
            <Text style={styles.emptyNote}>No items included yet.</Text>
          ) : (
            <RoomGroups groups={roomGroups} />
          )}
        </View>

        {/* Optional items */}
        {optionalGroups.length > 0 && (
          <View style={[styles.section, styles.optionalWrap]}>
            <Text style={styles.sectionLabel}>Optional Items (not included in grand total)</Text>
            <RoomGroups groups={optionalGroups} muted />
            <View style={styles.optionalTotalRow}>
              <Text style={styles.optionalTotalLabel}>Optional Items Total</Text>
              <Text style={styles.optionalTotalValue}>{formatCurrency(optionalTotal)}</Text>
            </View>
          </View>
        )}

        {/* Pricing summary */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionLabel}>Pricing Summary</Text>
          <View style={styles.pricingRow}>
            <Text style={styles.pricingLabel}>Subtotal</Text>
            <Text style={styles.pricingValue}>{formatCurrency(breakdown.subtotal)}</Text>
          </View>
          <View style={styles.pricingRow}>
            <Text style={styles.pricingLabelMuted}>Markup ({formatPercent(breakdown.markupPercent)})</Text>
            <Text style={styles.pricingValueMuted}>+ {formatCurrency(breakdown.markupAmount)}</Text>
          </View>
          {hasDiscount && (
            <View style={styles.pricingRow}>
              <Text style={styles.pricingLabelMuted}>
                {breakdown.discountType === 'percentage'
                  ? `Discount (${formatPercent(breakdown.discountValue)})`
                  : 'Discount'}
              </Text>
              <Text style={styles.pricingValueMuted}>− {formatCurrency(breakdown.discountAmount)}</Text>
            </View>
          )}
          <View style={styles.pricingRow}>
            <Text style={styles.pricingLabelMuted}>Taxable Amount</Text>
            <Text style={styles.pricingValueMuted}>{formatCurrency(breakdown.taxableAmount)}</Text>
          </View>
          <View style={styles.pricingRow}>
            <Text style={styles.pricingLabelMuted}>GST ({formatPercent(breakdown.taxRatePercent)})</Text>
            <Text style={styles.pricingValueMuted}>+ {formatCurrency(breakdown.taxAmount)}</Text>
          </View>
          <View style={styles.grandTotalBox}>
            <Text style={styles.grandTotalLabel}>GRAND TOTAL</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(breakdown.grandTotal)}</Text>
          </View>
        </View>

        {/* Payment schedule */}
        {quotation.paymentMilestones.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Payment Schedule</Text>
            {quotation.paymentMilestones.map((milestone) => (
              <View key={milestone.id} style={styles.milestoneRow} wrap={false}>
                <View>
                  <Text style={styles.milestoneLabel}>
                    {milestone.label} <Text style={styles.milestonePercent}>({milestone.percent}%)</Text>
                  </Text>
                  {milestone.description ? (
                    <Text style={styles.milestoneDescription}>{milestone.description}</Text>
                  ) : null}
                </View>
                <Text style={styles.milestoneAmount}>
                  {formatCurrency(round2(breakdown.grandTotal * (milestone.percent / 100)))}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Terms & Conditions */}
        {quotation.termsAndConditions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Terms &amp; Conditions</Text>
            {quotation.termsAndConditions.map((term, index) => (
              <View key={index} style={styles.termRow} wrap={false}>
                <Text style={styles.termIndex}>{index + 1}.</Text>
                <Text style={styles.termText}>{term}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Notes */}
        {quotation.notes.trim().length > 0 && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionLabel}>Notes</Text>
            <Text style={styles.notesText}>{quotation.notes}</Text>
          </View>
        )}

        {/* Full branding footer — normal flow, appears once at the end of content */}
        <View style={styles.brandFooter} wrap={false}>
          <Text style={styles.brandFooterName}>{quotation.company.name}</Text>
          <Text style={styles.brandFooterLine}>
            {quotation.company.address} · {quotation.company.phone} · {quotation.company.email}
          </Text>
          <Text style={styles.brandFooterLine}>
            {quotation.company.website} · GSTIN {quotation.company.gstin}
          </Text>
        </View>

        {/* Page numbers — every page */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{quotation.company.name}</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}
