import { CalendarX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import type { Event } from '@/api'
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
import { useEvents } from '@/queries'

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
                <TableHead>Date</TableHead>
                <TableHead>Lieu</TableHead>
                <TableHead className="text-right">Capacité</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending ? (
                <LoadingRows />
              ) : sortedEvents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-12 text-center text-muted-foreground">
                    <CalendarX className="mx-auto mb-2 size-6" />
                    Aucun événement pour le moment.
                  </TableCell>
                </TableRow>
              ) : (
                sortedEvents.map((event) => (
                  <EventRow key={event.id} event={event} past={isPast(event, now)} />
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}

function EventRow({ event, past }: { event: Event; past: boolean }) {
  return (
    <TableRow className={past ? 'text-muted-foreground' : undefined}>
      <TableCell className="font-medium">
        <Link
          to={`/events/${encodeURIComponent(event.id)}`}
          className="hover:underline focus-visible:underline"
        >
          {event.name}
        </Link>
        {past && (
          <Badge variant="outline" className="ml-2">
            Terminé
          </Badge>
        )}
      </TableCell>
      <TableCell>{formatDateRange(event.startsAt, event.endsAt)}</TableCell>
      <TableCell className={event.location ? undefined : 'italic text-muted-foreground'}>
        {formatLocation(event.location)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {event.capacity > 0 ? `${event.capacity} places` : 'Non définie'}
      </TableCell>
    </TableRow>
  )
}

function LoadingRows() {
  return Array.from({ length: 5 }, (_, index) => (
    <TableRow key={index}>
      {Array.from({ length: 4 }, (_, cell) => (
        <TableCell key={cell}>
          <Skeleton className="h-4 w-full max-w-40" />
        </TableCell>
      ))}
    </TableRow>
  ))
}
