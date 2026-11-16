import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  deleteParticipant,
  getEvent,
  getEventParticipants,
  getEvents,
  isNotFoundError,
  updateParticipantStatus,
} from './api'

function mockFetch(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('event normalization', () => {
  it('converts second timestamps, drops numeric locations and keeps capacity', async () => {
    mockFetch(200, [
      { id: '1', name: 'Jana Toy', startsAt: 1778317844, endsAt: 1778317844, location: 1778317844, capacity: 64 },
    ])

    const [event] = await getEvents()

    expect(event).toEqual({
      id: '1',
      name: 'Jana Toy',
      startsAt: new Date(1778317844 * 1000),
      endsAt: new Date(1778317844 * 1000),
      location: null,
      capacity: 64,
    })
  })

  it('treats invalid capacities as 0 and keeps string locations', async () => {
    mockFetch(200, [
      { id: 2, name: '  ', startsAt: 'not a date', location: ' Paris ', capacity: -5 },
      { id: 3, name: 'Meetup', startsAt: '2026-05-09T09:00:00.000Z', location: 'Lyon', capacity: '12.7' },
    ])

    const [invalid, valid] = await getEvents()

    expect(invalid).toMatchObject({ id: '2', name: 'Événement sans nom', startsAt: null, location: 'Paris', capacity: 0 })
    expect(valid).toMatchObject({ id: '3', startsAt: new Date('2026-05-09T09:00:00.000Z'), capacity: 12 })
  })

  it('throws a not found error for an unknown event', async () => {
    mockFetch(404, 'Not found')

    const error = await getEvent('999').catch((e: unknown) => e)

    expect(isNotFoundError(error)).toBe(true)
  })
})

describe('participant normalization', () => {
  it('maps unknown statuses to "unknown" and keeps valid ones', async () => {
    mockFetch(200, [
      { id: '1', eventId: '1', name: 'Josh', avatar: 'https://a.png', status: 'status 1' },
      { id: '2', eventId: '1', name: 'Kathy', status: 'confirmed' },
    ])

    const participants = await getEventParticipants('1')

    expect(participants.map((p) => p.status)).toEqual(['unknown', 'confirmed'])
    expect(participants[1]?.avatar).toBeNull()
  })

  it('uses the nested route and filters other events out strictly', async () => {
    const fetchMock = mockFetch(200, [
      { id: '1', eventId: '1', name: 'A', status: 'registered' },
      { id: '2', eventId: '10', name: 'B', status: 'registered' },
    ])

    const participants = await getEventParticipants('1')

    expect(fetchMock).toHaveBeenCalledWith('https://api.test/events/1/participants', expect.anything())
    expect(participants.map((p) => p.id)).toEqual(['1'])
  })

  it('returns an empty list when the API answers 404 for no participants', async () => {
    mockFetch(404, 'Not found')

    await expect(getEventParticipants('5')).resolves.toEqual([])
  })

  it('rethrows other errors', async () => {
    mockFetch(500, 'boom')

    await expect(getEventParticipants('5')).rejects.toMatchObject({ status: 500 })
  })
})

describe('participant writes', () => {
  const stored = { id: '51', eventId: '8', name: 'Tmp', status: 'confirmed' }

  // The flat `/participants/:id` route answers 404 on DELETE in MockAPI.
  it('deletes through the nested event route', async () => {
    const fetchMock = mockFetch(200, stored)

    await deleteParticipant('8', '51')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/events/8/participants/51',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('updates the status through the nested event route', async () => {
    const fetchMock = mockFetch(200, stored)

    await updateParticipantStatus('8', '51', 'confirmed')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/events/8/participants/51',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ status: 'confirmed' }) }),
    )
  })
})
