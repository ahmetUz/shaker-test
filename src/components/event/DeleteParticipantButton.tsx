import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Participant } from '@/api'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { getErrorMessage, useDeleteParticipant } from '@/queries'
import { isComing } from '@/rules'

type Props = { eventId: string; participant: Participant }

export function DeleteParticipantButton({ eventId, participant }: Props) {
  const deleteParticipant = useDeleteParticipant(eventId)

  const handleDelete = () => {
    deleteParticipant.mutate(participant.id, {
      onSuccess: () => toast.success(`${participant.name} a été supprimé.`),
      onError: (error) => toast.error(getErrorMessage(error)),
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Supprimer ${participant.name}`}
          disabled={deleteParticipant.isPending}
        >
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer {participant.name} ?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action est définitive.
            {isComing(participant.status) && ' Sa place sera libérée.'} Pour garder une trace,
            préférez le statut « Annulé ».
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Garder</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleDelete}>
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
