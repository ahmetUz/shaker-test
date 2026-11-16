import type { NormalizedStatus, Participant, ParticipantStatus } from './api'

/* -------------------------------------------------------------------------- */
/*                                  Statuses                                  */
/* -------------------------------------------------------------------------- */

/** Statuses that take a spot in the event. `canceled` and `unknown` do not. */
export const COMING_STATUSES: readonly ParticipantStatus[] = ['registered', 'confirmed', 'attended']

export function isComing(status: NormalizedStatus): boolean {
  return (COMING_STATUSES as readonly NormalizedStatus[]).includes(status)
}

/* -------------------------------------------------------------------------- */
/*                                  Capacity                                  */
/* -------------------------------------------------------------------------- */

export type CapacitySummary = {
  capacity: number
  coming: number
  remaining: number
  isFull: boolean
  /** Possible when data was created outside the app: the rule is then enforced for new spots only. */
  isOverCapacity: boolean
}

export function getCapacitySummary(capacity: number, participants: Participant[]): CapacitySummary {
  const coming = participants.filter((participant) => isComing(participant.status)).length
  return {
    capacity,
    coming,
    remaining: Math.max(0, capacity - coming),
    isFull: coming >= capacity,
    isOverCapacity: coming > capacity,
  }
}

/** Groups participants by event once, so the events list does not filter the whole list per row. */
export function groupParticipantsByEvent(participants: Participant[]): Map<string, Participant[]> {
  const byEvent = new Map<string, Participant[]>()
  for (const participant of participants) {
    const list = byEvent.get(participant.eventId)
    if (list) list.push(participant)
    else byEvent.set(participant.eventId, [participant])
  }
  return byEvent
}

export type RuleResult = { allowed: true } | { allowed: false; reason: string }

/**
 * A spot is needed only when moving into a coming status from a non-coming one
 * (or from nothing, i.e. a creation). Leaving a coming status or switching
 * between coming statuses never needs a spot.
 */
function checkSpot(
  capacity: number,
  participants: Participant[],
  from: NormalizedStatus | null,
  to: ParticipantStatus,
): RuleResult {
  const needsSpot = isComing(to) && !(from !== null && isComing(from))
  if (!needsSpot) return { allowed: true }

  const { coming, remaining } = getCapacitySummary(capacity, participants)
  if (remaining > 0) return { allowed: true }

  return {
    allowed: false,
    reason: `L'événement est complet (${coming}/${capacity} places occupées).`,
  }
}

export function canCreateParticipant(
  capacity: number,
  participants: Participant[],
  status: ParticipantStatus,
): RuleResult {
  return checkSpot(capacity, participants, null, status)
}

export function canChangeStatus(
  capacity: number,
  participants: Participant[],
  participant: Participant,
  nextStatus: ParticipantStatus,
): RuleResult {
  return checkSpot(capacity, participants, participant.status, nextStatus)
}

/* -------------------------------------------------------------------------- */
/*                                  Warnings                                  */
/* -------------------------------------------------------------------------- */

/** Not a blocking rule (the subject does not define it), only a hint for the user. */
export function isAttendedBeforeStart(
  status: NormalizedStatus,
  startsAt: Date | null,
  now: Date = new Date(),
): boolean {
  return status === 'attended' && startsAt !== null && startsAt > now
}

/* -------------------------------------------------------------------------- */
/*                                   Search                                   */
/* -------------------------------------------------------------------------- */

function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

/** Not blocking (homonyms exist), only used to warn before creating a likely duplicate. */
export function findParticipantByName(
  participants: Participant[],
  name: string,
): Participant | undefined {
  const normalizedName = normalizeText(name)
  if (normalizedName === '') return undefined
  return participants.find((participant) => normalizeText(participant.name) === normalizedName)
}

/** Case- and accent-insensitive search on the participant name. */
export function searchParticipants(participants: Participant[], query: string): Participant[] {
  const normalizedQuery = normalizeText(query)
  if (normalizedQuery === '') return participants
  return participants.filter((participant) =>
    normalizeText(participant.name).includes(normalizedQuery),
  )
}
