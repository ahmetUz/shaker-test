import { useParams } from 'react-router'

export function EventPage() {
  const { eventId } = useParams()
  return <h1 className="text-2xl font-semibold">Événement {eventId}</h1>
}
