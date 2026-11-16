import { ArrowLeft, CalendarDays, MapPin, Search } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { isNotFoundError, type Participant } from '@/api'
import { AddParticipantDialog } from '@/components/event/AddParticipantDialog'
import { CapacityCard } from '@/components/event/CapacityCard'
import {
  ParticipantsTable,
  ParticipantsTableSkeleton,
} from '@/components/event/ParticipantsTable'
import { QueryError } from '@/components/QueryError'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateRange, formatLocation } from '@/lib/format'
import { useEvent, useEventParticipants } from '@/queries'
import { getCapacitySummary, searchParticipants } from '@/rules'
import { NotFoundPage } from './NotFoundPage'

export function EventPage() {
  const { eventId = '' } = useParams()
  const eventQuery = useEvent(eventId)
  const participantsQuery = useEventParticipants(eventId)

  if (eventQuery.isError && isNotFoundError(eventQuery.error)) {
    return <NotFoundPage title="Événement introuvable" />
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/">
          <ArrowLeft />
          Tous les événements
        </Link>
      </Button>

      {eventQuery.isError ? (
        <QueryError
          title="Impossible de charger l'événement"
          error={eventQuery.error}
          onRetry={() => void eventQuery.refetch()}
        />
      ) : eventQuery.isPending ? (
        <EventHeaderSkeleton />
      ) : (
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold">{eventQuery.data.name}</h1>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" />
              {formatDateRange(eventQuery.data.startsAt, eventQuery.data.endsAt)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" />
              {formatLocation(eventQuery.data.location)}
            </span>
          </div>
        </header>
      )}

      {participantsQuery.isError ? (
        <QueryError
          title="Impossible de charger les participants"
          error={participantsQuery.error}
          onRetry={() => void participantsQuery.refetch()}
        />
      ) : eventQuery.isSuccess && participantsQuery.isSuccess ? (
        <ParticipantsSection
          eventId={eventId}
          capacity={eventQuery.data.capacity}
          startsAt={eventQuery.data.startsAt}
          participants={participantsQuery.data}
        />
      ) : eventQuery.isError ? null : (
        <Card className="py-0">
          <ParticipantsTableSkeleton />
        </Card>
      )}
    </div>
  )
}

type SectionProps = {
  eventId: string
  capacity: number
  startsAt: Date | null
  participants: Participant[]
}

function ParticipantsSection({ eventId, capacity, startsAt, participants }: SectionProps) {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)

  const summary = useMemo(() => getCapacitySummary(capacity, participants), [capacity, participants])
  const visibleParticipants = useMemo(
    () => searchParticipants(participants, deferredQuery),
    [participants, deferredQuery],
  )
  const isSearching = deferredQuery.trim() !== ''
  const unknownCount = participants.filter((p) => p.status === 'unknown').length
  const canceledCount = participants.filter((p) => p.status === 'canceled').length

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem] lg:items-start">
      <Card className="order-2 gap-0 lg:order-1">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3 pb-4">
          <CardTitle>
            Participants{' '}
            <span className="font-normal text-muted-foreground">({participants.length})</span>
          </CardTitle>
          <AddParticipantDialog
            eventId={eventId}
            participants={participants}
            startsAt={startsAt}
            isFull={summary.isFull}
          />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher un participant…"
              aria-label="Rechercher un participant"
              className="pl-8"
            />
          </div>
          {isSearching && (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {visibleParticipants.length} résultat{visibleParticipants.length > 1 ? 's' : ''} sur{' '}
              {participants.length}
            </p>
          )}
          <ParticipantsTable
            eventId={eventId}
            capacity={capacity}
            startsAt={startsAt}
            participants={participants}
            visibleParticipants={visibleParticipants}
            isSearching={isSearching}
          />
        </CardContent>
      </Card>

      <div className="order-1 lg:order-2">
        <CapacityCard summary={summary} unknownCount={unknownCount} canceledCount={canceledCount} />
      </div>
    </div>
  )
}

function EventHeaderSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-4 w-96 max-w-full" />
    </div>
  )
}
