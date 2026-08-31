import type { ProjectStatus, ProjectType, ClientStatus } from '@/types'

export const PROJECT_STATUS_META: Record<ProjectStatus, { label: string; tone: 'brass' | 'sage' | 'terracotta' | 'ink' | 'success' | 'neutral' }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  'in-progress': { label: 'In Progress', tone: 'brass' },
  'quotation-sent': { label: 'Quotation Sent', tone: 'terracotta' },
  approved: { label: 'Approved', tone: 'sage' },
  completed: { label: 'Completed', tone: 'success' },
}

export const PROJECT_TYPE_LABEL: Record<ProjectType, string> = {
  'full-home': 'Full Home',
  apartment: 'Apartment',
  kitchen: 'Kitchen',
  office: 'Office',
  'single-room': 'Single Room',
  renovation: 'Renovation',
}

export const CLIENT_STATUS_META: Record<ClientStatus, { label: string; tone: 'sage' | 'brass' | 'neutral' }> = {
  active: { label: 'Active', tone: 'sage' },
  lead: { label: 'Lead', tone: 'brass' },
  archived: { label: 'Archived', tone: 'neutral' },
}
