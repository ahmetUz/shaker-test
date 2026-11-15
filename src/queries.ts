import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ApiError,
  createParticipant,
  deleteParticipant,
  getEvent,
  getEventParticipants,
  getEvents,
  isNotFoundError,
  updateParticipantStatus,
  type Participant,
  type ParticipantStatus,
} from './api'
import { canChangeStatus, canCreateParticipant } from './rules'

/* -------------------------------------------------------------------------- */
/*                                 Query keys                                 */
/* -------------------------------------------------------------------------- */

export const queryKeys = {
  events: ['events'] as const,
  event: (eventId: string) => ['event', eventId] as const,
  participants: (eventId: string) => ['participants', eventId] as const,
}

/* -------------------------------------------------------------------------- */
/*                                   Errors                                   */
/* -------------------------------------------------------------------------- */

/** A business rule refused the action (e.g. the event is full). */
export class BusinessRuleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BusinessRuleError'
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof BusinessRuleError || error instanceof ApiError) return error.message
  return 'Une erreur inattendue est survenue.'
}

/** No point retrying a 404 or a refused business rule. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  return !isNotFoundError(error) && failureCount < 1
}

/* -------------------------------------------------------------------------- */
/*                                   Queries                                  */
/* -------------------------------------------------------------------------- */

export function useEvents() {
  return useQuery({ queryKey: queryKeys.events, queryFn: getEvents })
}

export function useEvent(eventId: string) {
  return useQuery({
    queryKey: queryKeys.event(eventId),
    queryFn: () => getEvent(eventId),
    retry: shouldRetry,
  })
}

export function useEventParticipants(eventId: string) {
  return useQuery({
    queryKey: queryKeys.participants(eventId),
    queryFn: () => getEventParticipants(eventId),
  })
}

/* -------------------------------------------------------------------------- */
/*                                  Mutations                                 */
/* -------------------------------------------------------------------------- */

/**
 * The API cannot enforce capacity, so every write that may take a spot first
 * re-reads the event and its participants from the server (bypassing the cache)
 * and re-checks the rule. This narrows, but cannot fully close, the race window.
 * Direct API calls are used on purpose: writing them to the cache would undo
 * optimistic updates.
 */
async function fetchFreshEventState(eventId: string) {
  const [event, participants] = await Promise.all([
    getEvent(eventId),
    getEventParticipants(eventId),
  ])
  return { capacity: event.capacity, participants }
}

export type NewParticipant = { name: string; status: ParticipantStatus }
export type StatusChange = { participantId: string; status: ParticipantStatus }

export async function createParticipantChecked(eventId: string, input: NewParticipant) {
  const { capacity, participants } = await fetchFreshEventState(eventId)
  const check = canCreateParticipant(capacity, participants, input.status)
  if (!check.allowed) throw new BusinessRuleError(check.reason)

  return createParticipant({ eventId, ...input })
}

export async function updateStatusChecked(eventId: string, { participantId, status }: StatusChange) {
  const { capacity, participants } = await fetchFreshEventState(eventId)
  const participant = participants.find((p) => p.id === participantId)
  if (!participant) throw new BusinessRuleError("Ce participant n'existe plus.")

  const check = canChangeStatus(capacity, participants, participant, status)
  if (!check.allowed) throw new BusinessRuleError(check.reason)

  return updateParticipantStatus(participantId, status)
}

export function useCreateParticipant(eventId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: NewParticipant) => createParticipantChecked(eventId, input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.participants(eventId) }),
  })
}

export function useUpdateParticipantStatus(eventId: string) {
  const queryClient = useQueryClient()
  const key = queryKeys.participants(eventId)

  return useMutation({
    mutationFn: (change: StatusChange) => updateStatusChecked(eventId, change),

    // Optimistic update: the status changes instantly and is rolled back on error.
    onMutate: async ({ participantId, status }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Participant[]>(key)
      queryClient.setQueryData<Participant[]>(key, (current) =>
        current?.map((p) => (p.id === participantId ? { ...p, status } : p)),
      )
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

export function useDeleteParticipant(eventId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (participantId: string) => {
      try {
        await deleteParticipant(participantId)
      } catch (error) {
        // Already deleted elsewhere: the end result is the one the user wants.
        if (!isNotFoundError(error)) throw error
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.participants(eventId) }),
  })
}
