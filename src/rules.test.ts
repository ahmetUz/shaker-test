import { describe, expect, it } from 'vitest'
import type { NormalizedStatus, Participant } from './api'
import {
  canChangeStatus,
  canCreateParticipant,
  findParticipantByName,
  getCapacitySummary,
  isAttendedBeforeStart,
  isComing,
  searchParticipants,
} from './rules'

let nextId = 1

function participant(status: NormalizedStatus, name = `Participant ${nextId}`): Participant {
  const id = String(nextId++)
  return { id, eventId: '1', name, avatar: null, status }
}

function participants(...statuses: NormalizedStatus[]): Participant[] {
  return statuses.map((status) => participant(status))
}

describe('isComing', () => {
  it.each([
    ['registered', true],
    ['confirmed', true],
    ['attended', true],
    ['canceled', false],
    ['unknown', false],
  ] as const)('%s → %s', (status, expected) => {
    expect(isComing(status)).toBe(expected)
  })
})

describe('getCapacitySummary', () => {
  it('only counts coming participants', () => {
    const list = participants('registered', 'confirmed', 'attended', 'canceled', 'unknown')

    expect(getCapacitySummary(5, list)).toEqual({
      capacity: 5,
      coming: 3,
      remaining: 2,
      isFull: false,
      isOverCapacity: false,
    })
  })

  it('is full when coming equals capacity', () => {
    expect(getCapacitySummary(2, participants('registered', 'confirmed'))).toMatchObject({
      remaining: 0,
      isFull: true,
      isOverCapacity: false,
    })
  })

  it('flags existing over-capacity data without negative remaining spots', () => {
    expect(getCapacitySummary(1, participants('registered', 'confirmed'))).toMatchObject({
      remaining: 0,
      isFull: true,
      isOverCapacity: true,
    })
  })

  it('treats a capacity of 0 as full', () => {
    expect(getCapacitySummary(0, [])).toMatchObject({ remaining: 0, isFull: true })
  })
})

describe('canCreateParticipant', () => {
  it('allows a coming participant when spots remain', () => {
    expect(canCreateParticipant(2, participants('registered'), 'registered')).toEqual({ allowed: true })
  })

  it('blocks a coming participant when the event is full', () => {
    const result = canCreateParticipant(1, participants('confirmed'), 'registered')

    expect(result).toEqual({ allowed: false, reason: "L'événement est complet (1/1 places occupées)." })
  })

  it('blocks a coming participant when capacity is 0', () => {
    expect(canCreateParticipant(0, [], 'registered').allowed).toBe(false)
  })

  it('ignores canceled and unknown participants when counting spots', () => {
    expect(canCreateParticipant(1, participants('canceled', 'unknown'), 'registered').allowed).toBe(true)
  })

  it('always allows creating a canceled participant', () => {
    expect(canCreateParticipant(1, participants('registered'), 'canceled').allowed).toBe(true)
  })
})

describe('canChangeStatus', () => {
  it('allows switching between coming statuses when full', () => {
    const list = participants('registered')

    expect(canChangeStatus(1, list, list[0]!, 'attended').allowed).toBe(true)
  })

  it('allows canceling when full or over capacity', () => {
    const list = participants('registered', 'registered')

    expect(canChangeStatus(1, list, list[0]!, 'canceled').allowed).toBe(true)
  })

  it('blocks reactivating a canceled participant when full', () => {
    const list = participants('registered', 'canceled')

    expect(canChangeStatus(1, list, list[1]!, 'confirmed').allowed).toBe(false)
  })

  it('allows reactivating a canceled participant when a spot is free', () => {
    const list = participants('registered', 'canceled')

    expect(canChangeStatus(2, list, list[1]!, 'confirmed').allowed).toBe(true)
  })

  it('treats fixing an unknown status as taking a new spot', () => {
    const list = participants('registered', 'unknown')

    expect(canChangeStatus(1, list, list[1]!, 'registered').allowed).toBe(false)
    expect(canChangeStatus(1, list, list[1]!, 'canceled').allowed).toBe(true)
  })

  it('blocks taking a spot when the event is already over capacity', () => {
    const list = participants('registered', 'registered', 'canceled')

    expect(canChangeStatus(1, list, list[2]!, 'registered').allowed).toBe(false)
  })
})

describe('isAttendedBeforeStart', () => {
  const now = new Date('2026-05-01T00:00:00Z')
  const future = new Date('2026-05-09T00:00:00Z')
  const past = new Date('2026-04-01T00:00:00Z')

  it('warns only for attended participants of a future event', () => {
    expect(isAttendedBeforeStart('attended', future, now)).toBe(true)
    expect(isAttendedBeforeStart('attended', past, now)).toBe(false)
    expect(isAttendedBeforeStart('confirmed', future, now)).toBe(false)
    expect(isAttendedBeforeStart('attended', null, now)).toBe(false)
  })
})

describe('searchParticipants', () => {
  const list = [participant('registered', 'Élodie Martin'), participant('confirmed', 'Josh Crona')]

  it('returns everyone for an empty or blank query', () => {
    expect(searchParticipants(list, '   ')).toHaveLength(2)
  })

  it('is case- and accent-insensitive', () => {
    expect(searchParticipants(list, 'elodie').map((p) => p.name)).toEqual(['Élodie Martin'])
    expect(searchParticipants(list, 'CRONA').map((p) => p.name)).toEqual(['Josh Crona'])
  })

  it('returns an empty list when nothing matches', () => {
    expect(searchParticipants(list, 'zzz')).toEqual([])
  })
})

describe('findParticipantByName', () => {
  const list = [participant('registered', 'Élodie Martin')]

  it('matches regardless of case, accents and surrounding spaces', () => {
    expect(findParticipantByName(list, '  elodie MARTIN ')?.name).toBe('Élodie Martin')
  })

  it('ignores partial matches and blank names', () => {
    expect(findParticipantByName(list, 'Elodie')).toBeUndefined()
    expect(findParticipantByName(list, '   ')).toBeUndefined()
  })
})
