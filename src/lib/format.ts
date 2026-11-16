import type { NormalizedStatus, ParticipantStatus } from '@/api'

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function formatDate(date: Date | null): string {
  return date ? dateFormatter.format(date) : 'Date non précisée'
}

/** Single date when start and end are equal or end is missing (the mock data often has both equal). */
export function formatDateRange(startsAt: Date | null, endsAt: Date | null): string {
  if (!startsAt) return formatDate(null)
  if (!endsAt || endsAt.getTime() === startsAt.getTime()) return formatDate(startsAt)
  return `${formatDate(startsAt)} → ${formatDate(endsAt)}`
}

export function formatLocation(location: string | null): string {
  return location ?? 'Lieu non précisé'
}

export const STATUS_LABELS: Record<NormalizedStatus, string> = {
  registered: 'Inscrit',
  confirmed: 'Confirmé',
  attended: 'Présent',
  canceled: 'Annulé',
  unknown: 'Statut inconnu',
}

export function statusLabel(status: NormalizedStatus | ParticipantStatus): string {
  return STATUS_LABELS[status]
}
