import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from './api'
import type { NormalizedStatus, Participant } from './api'
import { BusinessRuleError, createParticipantChecked, updateStatusChecked } from './queries'

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>()
  return {
    ...actual,
    getEvent: vi.fn(),
    getEventParticipants: vi.fn(),
    createParticipant: vi.fn(),
    updateParticipantStatus: vi.fn(),
  }
})

function participant(id: string, status: NormalizedStatus): Participant {
  return { id, eventId: '1', name: `P${id}`, avatar: null, status }
}

/** Simulates the server state at the moment of the write. */
function serverState(capacity: number, participants: Participant[]) {
  vi.mocked(api.getEvent).mockResolvedValue({
    id: '1', name: 'Event', startsAt: null, endsAt: null, location: null, capacity,
  })
  vi.mocked(api.getEventParticipants).mockResolvedValue(participants)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createParticipantChecked', () => {
  it('creates the participant when a spot is free on the server', async () => {
    serverState(2, [participant('1', 'registered')])

    await createParticipantChecked('1', { name: 'New', status: 'registered' })

    expect(api.createParticipant).toHaveBeenCalledWith({ eventId: '1', name: 'New', status: 'registered' })
  })

  it('refuses without writing when the server says the event is full', async () => {
    // The cached UI may still show a free spot; the fresh server read wins.
    serverState(1, [participant('1', 'confirmed')])

    await expect(createParticipantChecked('1', { name: 'New', status: 'registered' })).rejects.toBeInstanceOf(
      BusinessRuleError,
    )
    expect(api.createParticipant).not.toHaveBeenCalled()
  })
})

describe('updateStatusChecked', () => {
  it('refuses reactivating a canceled participant when full', async () => {
    serverState(1, [participant('1', 'registered'), participant('2', 'canceled')])

    await expect(updateStatusChecked('1', { participantId: '2', status: 'confirmed' })).rejects.toThrow(
      "L'événement est complet",
    )
    expect(api.updateParticipantStatus).not.toHaveBeenCalled()
  })

  it('allows canceling when full', async () => {
    serverState(1, [participant('1', 'registered')])

    await updateStatusChecked('1', { participantId: '1', status: 'canceled' })

    expect(api.updateParticipantStatus).toHaveBeenCalledWith('1', '1', 'canceled')
  })

  it('refuses when the participant was deleted in the meantime', async () => {
    serverState(5, [])

    await expect(updateStatusChecked('1', { participantId: '9', status: 'confirmed' })).rejects.toThrow(
      "Ce participant n'existe plus.",
    )
  })
})
