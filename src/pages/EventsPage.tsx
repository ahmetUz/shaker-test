import { CalendarX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import type { Event, Participant } from '@/api'
import { QueryError } from '@/components/QueryError'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDateRange, formatLocation } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAllParticipants, useEvents } from '@/queries'
import { getCapacitySummary, groupParticipantsByEvent } from '@/rules'

/** Upcoming events first (soonest on top), then past events (most recent on top), undated last. */
function sortEvents(events: Event[], now: Date): Event[] {
  const rank = (event: Event) => {
    if (!event.startsAt) return 2
    return isPast(event, now) ? 1 : 0
  }
  return [...events].sort((a, b) => {
    const byRank = rank(a) - rank(b)
    if (byRank !== 0 || !a.startsAt || !b.startsAt) return byRank
    const diff = a.startsAt.getTime() - b.startsAt.getTime()
    return rank(a) === 0 ? diff : -diff
  })
}

function isPast(event: Event, now: Date): boolean {
  const end = event.endsAt ?? event.startsAt
  return end !== null && end < now
}

export function EventsPage() {
  const { data: events, isPending, isError, error, refetch } = useEvents()
  const [now] = useState(() => new Date())
  const sortedEvents = useMemo(() => (events ? sortEvents(events, now) : []), [events, now])

  // Loaded separately so a failure only hides the occupancy, never the events themselves.
  const participantsQuery = useAllParticipants()
  const participantsByEvent = useMemo(
    () => (participantsQuery.data ? groupParticipantsByEvent(participantsQuery.data) : null),
    [participantsQuery.data],
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Événements</h1>
        <p className="text-sm text-muted-foreground">
          Sélectionnez un événement pour gérer ses participants.
        </p>
      </div>

      {isError ? (
        <QueryError
          title="Impossible de charger les événements"
          error={error}
          onRetry={() => void refetch()}
        />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead className="hidden md:table-cell">Date</TableHead>
                <TableHead className="hidden md:table-cell">Lieu</TableHead>
                <TableHead className="text-right">Places</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending ? (
                <LoadingRows />
              ) : sortedEvents.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-12 text-center whitespace-normal text-muted-foreground"
                  >
                    <CalendarX className="mx-auto mb-2 size-6" />
                    Aucun événement pour le moment.
                  </TableCell>
                </TableRow>
              ) : (
                sortedEvents.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    past={isPast(event, now)}
                    // null while loading or on error: only the capacity is shown.
                    participants={participantsByEvent ? (participantsByEvent.get(event.id) ?? []) : null}
                    participantsLoading={participantsQuery.isPending}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}

/**
 * The whole row is clickable for mouse users; the name stays a real link so
 * keyboard navigation, screen readers and cmd/ctrl+click keep working.
 */
type EventRowProps = {
  event: Event
  past: boolean
  participants: Participant[] | null
  participantsLoading: boolean
}

function EventRow({ event, past, participants, participantsLoading }: EventRowProps) {
  const navigate = useNavigate()
  const href = `/events/${encodeURIComponent(event.id)}`

  return (
    <TableRow
      onClick={(clickEvent) => {
        // Let the link handle its own clicks (incl. opening in a new tab).
        if ((clickEvent.target as HTMLElement).closest('a')) return
        void navigate(href)
      }}
      className={cn('cursor-pointer', past && 'text-muted-foreground')}
    >
      <TableCell className="whitespace-normal">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link to={href} className="font-medium hover:underline focus-visible:underline">
            {event.name}
          </Link>
          {past && <Badge variant="outline">Terminé</Badge>}
        </div>
        {/* On small screens the date and location columns are hidden and shown here instead. */}
        <div className="mt-1 space-y-0.5 text-xs text-muted-foreground md:hidden">
          <p>{formatDateRange(event.startsAt, event.endsAt)}</p>
          <p className={event.location ? undefined : 'italic'}>{formatLocation(event.location)}</p>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        {formatDateRange(event.startsAt, event.endsAt)}
      </TableCell>
      <TableCell
        className={cn('hidden md:table-cell', !event.location && 'italic text-muted-foreground')}
      >
        {formatLocation(event.location)}
      </TableCell>
      <TableCell className="text-right">
        <Occupancy
          capacity={event.capacity}
          participants={participants}
          loading={participantsLoading}
        />
      </TableCell>
    </TableRow>
  )
}

type OccupancyProps = {
  capacity: number
  participants: Participant[] | null
  loading: boolean
}

function Occupancy({ capacity, participants, loading }: OccupancyProps) {
  if (capacity === 0) return <span className="text-muted-foreground">Non définie</span>
  if (loading) return <Skeleton className="ml-auto h-4 w-16" />
  if (!participants) return <span className="tabular-nums">{capacity} places</span>

  const { coming, remaining, isFull } = getCapacitySummary(capacity, participants)
  return (
    <div className="flex flex-col-reverse items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
      {isFull ? (
        <Badge variant="destructive">Complet</Badge>
      ) : (
        <span className="text-xs text-muted-foreground">
          {remaining} restante{remaining > 1 ? 's' : ''}
        </span>
      )}
      <span className="font-medium tabular-nums">
        {coming} / {capacity}
      </span>
    </div>
  )
}

function LoadingRows() {
  return Array.from({ length: 5 }, (_, index) => (
    <TableRow key={index}>
      {Array.from({ length: 4 }, (_, cell) => (
        <TableCell key={cell} className={cell === 1 || cell === 2 ? 'hidden md:table-cell' : undefined}>
          <Skeleton className="h-4 w-full max-w-40" />
        </TableCell>
      ))}
    </TableRow>
  ))
}
