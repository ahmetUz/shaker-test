import { toast } from 'sonner'
import { PARTICIPANT_STATUSES, type Participant, type ParticipantStatus } from '@/api'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { statusLabel } from '@/lib/format'
import { getErrorMessage, useUpdateParticipantStatus } from '@/queries'
import { canChangeStatus } from '@/rules'

type Props = {
  eventId: string
  capacity: number
  participants: Participant[]
  participant: Participant
}

/** Each row owns its mutation, so several rows can be updated independently. */
export function StatusSelect({ eventId, capacity, participants, participant }: Props) {
  const updateStatus = useUpdateParticipantStatus(eventId)

  const handleChange = (value: string) => {
    const status = value as ParticipantStatus
    updateStatus.mutate(
      { participantId: participant.id, status },
      {
        onSuccess: () => toast.success(`${participant.name} : ${statusLabel(status)}`),
        onError: (error) => toast.error(getErrorMessage(error)),
      },
    )
  }

  return (
    <Select
      // An unknown status has no matching option: the placeholder shows it instead.
      value={participant.status === 'unknown' ? '' : participant.status}
      onValueChange={handleChange}
      disabled={updateStatus.isPending}
    >
      <SelectTrigger size="sm" className="w-40" aria-label={`Statut de ${participant.name}`}>
        <SelectValue placeholder={statusLabel('unknown')} />
      </SelectTrigger>
      <SelectContent>
        {PARTICIPANT_STATUSES.map((status) => {
          const check = canChangeStatus(capacity, participants, participant, status)
          return (
            <SelectItem key={status} value={status} disabled={!check.allowed}>
              {statusLabel(status)}
              {!check.allowed && <span className="text-xs text-muted-foreground">(complet)</span>}
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
