import type { PaymentMilestone } from '@/types'

export const DEFAULT_PAYMENT_MILESTONES: Omit<PaymentMilestone, 'id'>[] = [
  { label: 'Advance', percent: 40, description: 'On confirmation of order' },
  { label: 'Stage Payment', percent: 40, description: 'On completion of carpentry & civil work' },
  { label: 'Handover', percent: 20, description: 'On final handover & client walkthrough' },
]

export const DEFAULT_TERMS_AND_CONDITIONS: string[] = [
  'This quotation is valid for 30 days from the date of issue.',
  'GST is charged as per government norms prevailing at the time of invoicing.',
  'Any change in scope, material, or finish after order confirmation may affect the final cost and timeline.',
  'Detailed execution timeline will be shared separately upon order confirmation.',
  'Payment milestones must be honoured as per the schedule to avoid delays in execution.',
  'Warranty on modular furniture is 1 year from the date of handover, covering manufacturing defects only.',
]
