import { AlertTriangle, UserPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import type { Participant, ParticipantStatus } from '@/api'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { statusLabel } from '@/lib/format'
import { getErrorMessage, useCreateParticipant } from '@/queries'
import { COMING_STATUSES, findParticipantByName, isAttendedBeforeStart } from '@/rules'

const NAME_MAX_LENGTH = 100

type Props = {
  eventId: string
  participants: Participant[]
  startsAt: Date | null
  isFull: boolean
}

/**
 * Only coming statuses are offered: creating someone directly as canceled has
 * no product value. The button is disabled when the event is full; the server
 * state is re-checked on submit anyway (see `createParticipantChecked`).
 */
export function AddParticipantDialog({ eventId, participants, startsAt, isFull }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [status, setStatus] = useState<ParticipantStatus>('registered')
  const createParticipant = useCreateParticipant(eventId)

  const trimmedName = name.trim()
  const duplicate = findParticipantByName(participants, trimmedName)
  const attendedTooEarly = isAttendedBeforeStart(status, startsAt)

  const reset = () => {
    setName('')
    setStatus('registered')
    createParticipant.reset()
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (createParticipant.isPending) return
    setOpen(nextOpen)
    if (!nextOpen) reset()
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (trimmedName === '') return

    createParticipant.mutate(
      { name: trimmedName, status },
      {
        onSuccess: (participant) => {
          toast.success(`${participant.name} a été ajouté.`)
          setOpen(false)
          reset()
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button disabled={isFull} title={isFull ? "L'événement est complet" : undefined}>
          <UserPlus />
          Ajouter un participant
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Ajouter un participant</DialogTitle>
            <DialogDescription>Le participant occupera une place de l'événement.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="participant-name">Nom</Label>
            <Input
              id="participant-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={NAME_MAX_LENGTH}
              autoComplete="off"
              autoFocus
              required
            />
            {duplicate && (
              <p className="text-xs text-amber-600 dark:text-amber-500">
                Un participant nommé « {duplicate.name} » existe déjà pour cet événement.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="participant-status">Statut</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as ParticipantStatus)}>
              <SelectTrigger id="participant-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMING_STATUSES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {statusLabel(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {attendedTooEarly && (
              <p className="text-xs text-amber-600 dark:text-amber-500">
                L'événement n'a pas encore commencé.
              </p>
            )}
          </div>

          {createParticipant.isError && (
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertDescription>{getErrorMessage(createParticipant.error)}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={createParticipant.isPending}>
                Annuler
              </Button>
            </DialogClose>
            <Button type="submit" disabled={trimmedName === '' || createParticipant.isPending}>
              {createParticipant.isPending ? 'Ajout…' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
