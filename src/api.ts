import { z } from 'zod'

/* -------------------------------------------------------------------------- */
/*                                   Config                                   */
/* -------------------------------------------------------------------------- */

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL

if (!rawBaseUrl) {
  throw new Error('Missing VITE_API_BASE_URL. Copy .env.example to .env.local.')
}

const API_BASE_URL = rawBaseUrl.replace(/\/$/, '')

/* -------------------------------------------------------------------------- */
/*                                   Schemas                                  */
/* -------------------------------------------------------------------------- */

export const PARTICIPANT_STATUSES = ['registered', 'confirmed', 'attended', 'canceled'] as const

export type ParticipantStatus = (typeof PARTICIPANT_STATUSES)[number]

/** Any value outside the allowed statuses (e.g. "status 1" in the mock data) becomes `unknown`. */
export type NormalizedStatus = ParticipantStatus | 'unknown'

function isParticipantStatus(value: unknown): value is ParticipantStatus {
  return PARTICIPANT_STATUSES.includes(value as ParticipantStatus)
}

/**
 * Accepts Unix timestamps in seconds (what the API returns), in milliseconds,
 * or ISO strings. Anything unparsable becomes `null`.
 */
function toDate(value: unknown): Date | null {
  let date: Date | null = null
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Below 1e11 the value can only be seconds (1e11 ms is in 1973).
    date = new Date(value < 1e11 ? value * 1000 : value)
  } else if (typeof value === 'string' && value.trim() !== '') {
    date = new Date(value)
  }
  return date && !Number.isNaN(date.getTime()) ? date : null
}

/** Empty or non-string values become `null` (the mock API sends numbers for `location`). */
function toOptionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

/** A missing, negative or non-numeric capacity is treated as 0 so it can never be exceeded. */
function toCapacity(value: unknown): number {
  const capacity = typeof value === 'string' ? Number(value) : value
  return typeof capacity === 'number' && Number.isFinite(capacity) && capacity > 0
    ? Math.floor(capacity)
    : 0
}

const idSchema = z.union([z.string(), z.number()]).transform(String)

const eventSchema = z.object({
  id: idSchema,
  name: z.unknown().optional().transform((value) => toOptionalText(value) ?? 'Événement sans nom'),
  startsAt: z.unknown().optional().transform(toDate),
  endsAt: z.unknown().optional().transform(toDate),
  location: z.unknown().optional().transform(toOptionalText),
  capacity: z.unknown().optional().transform(toCapacity),
})

const participantSchema = z.object({
  id: idSchema,
  eventId: idSchema,
  name: z.unknown().optional().transform((value) => toOptionalText(value) ?? 'Participant sans nom'),
  avatar: z.unknown().optional().transform(toOptionalText),
  status: z.unknown().optional().transform((value): NormalizedStatus =>
    isParticipantStatus(value) ? value : 'unknown',
  ),
})

export type Event = z.infer<typeof eventSchema>
export type Participant = z.infer<typeof participantSchema>

export type CreateParticipantInput = {
  eventId: string
  name: string
  status: ParticipantStatus
}

/* -------------------------------------------------------------------------- */
/*                                 HTTP client                                */
/* -------------------------------------------------------------------------- */

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function isNotFoundError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404
}

async function request<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiError(0, 'Impossible de joindre le serveur. Vérifiez votre connexion.')
  }

  if (!response.ok) {
    const message =
      response.status === 404 ? 'Ressource introuvable.' : `Erreur serveur (${response.status}).`
    throw new ApiError(response.status, message)
  }

  const result = schema.safeParse(await response.json())
  if (!result.success) {
    throw new ApiError(response.status, 'Réponse du serveur invalide.')
  }
  return result.data
}

/* -------------------------------------------------------------------------- */
/*                                  Endpoints                                 */
/* -------------------------------------------------------------------------- */

export function getEvents(): Promise<Event[]> {
  return request('/events', z.array(eventSchema))
}

export function getEvent(eventId: string): Promise<Event> {
  return request(`/events/${encodeURIComponent(eventId)}`, eventSchema)
}

/**
 * Uses the nested route because the `?eventId=` filter is a substring match
 * (eventId=1 also returns event 10). Results are still filtered strictly.
 * MockAPI answers 404 instead of an empty array when there is no participant.
 */
export async function getEventParticipants(eventId: string): Promise<Participant[]> {
  try {
    const participants = await request(
      `/events/${encodeURIComponent(eventId)}/participants`,
      z.array(participantSchema),
    )
    return participants.filter((participant) => participant.eventId === eventId)
  } catch (error) {
    if (isNotFoundError(error)) return []
    throw error
  }
}

export function createParticipant(input: CreateParticipantInput): Promise<Participant> {
  return request('/participants', participantSchema, {
    method: 'POST',
    body: JSON.stringify({ ...input, name: input.name.trim() }),
  })
}

export function updateParticipantStatus(
  participantId: string,
  status: ParticipantStatus,
): Promise<Participant> {
  return request(`/participants/${encodeURIComponent(participantId)}`, participantSchema, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  })
}

export function deleteParticipant(participantId: string): Promise<Participant> {
  return request(`/participants/${encodeURIComponent(participantId)}`, participantSchema, {
    method: 'DELETE',
  })
}
