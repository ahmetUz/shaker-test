import { AlertTriangle, Search, UserRound } from 'lucide-react'
import { useState } from 'react'
import type { Participant } from '@/api'
import { Skeleton } from '@/components/ui/skeleton'
import { isAttendedBeforeStart } from '@/rules'
import { DeleteParticipantButton } from './DeleteParticipantButton'
import { StatusSelect } from './StatusSelect'

type Props = {
  eventId: string
  capacity: number
  startsAt: Date | null
  /** Full list: capacity rules must always see every participant, not only the search results. */
  participants: Participant[]
  visibleParticipants: Participant[]
  isSearching: boolean
}

/**
 * A list rather than a table: each row wraps on narrow screens (name on top,
 * status and delete below) instead of overflowing horizontally.
 */
export function ParticipantsTable({
  eventId,
  capacity,
  startsAt,
  participants,
  visibleParticipants,
  isSearching,
}: Props) {
  if (visibleParticipants.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        {isSearching ? (
          <>
            <Search className="mx-auto mb-2 size-6" />
            Aucun participant ne correspond à la recherche.
          </>
        ) : (
          <>
            <UserRound className="mx-auto mb-2 size-6" />
            Aucun participant pour le moment.
          </>
        )}
      </div>
    )
  }

  return (
    <ul className="divide-y" aria-label="Participants">
      {visibleParticipants.map((participant) => (
        <li key={participant.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
          <div className="flex min-w-0 flex-1 basis-48 items-center gap-3">
            <Avatar participant={participant} />
            <div className="min-w-0">
              <p className="font-medium break-words">{participant.name}</p>
              {isAttendedBeforeStart(participant.status, startsAt) && (
                <p
                  className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500"
                  title="Marqué présent alors que l'événement n'a pas commencé"
                >
                  <AlertTriangle className="size-3.5" />
                  Avant le début
                </p>
              )}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <StatusSelect
              eventId={eventId}
              capacity={capacity}
              participants={participants}
              participant={participant}
            />
            <DeleteParticipantButton eventId={eventId} participant={participant} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function Avatar({ participant }: { participant: Participant }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const showImage = participant.avatar !== null && participant.avatar !== failedSrc
  const initials = participant.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <span className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-medium text-muted-foreground">
      {initials}
      {showImage && (
        <img
          src={participant.avatar ?? undefined}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
          // A broken avatar URL shows the initials instead.
          onError={() => setFailedSrc(participant.avatar)}
        />
      )}
    </span>
  )
}

export function ParticipantsTableSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="ml-auto h-7 w-40" />
        </div>
      ))}
    </div>
  )
}
