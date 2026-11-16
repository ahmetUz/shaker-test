import { AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { CapacitySummary } from '@/rules'

type Props = {
  summary: CapacitySummary
  /** Participants with a status the app does not know (not counted toward capacity). */
  unknownCount: number
  canceledCount: number
}

export function CapacityCard({ summary, unknownCount, canceledCount }: Props) {
  const { capacity, coming, remaining, isFull, isOverCapacity } = summary
  const percent = capacity > 0 ? Math.min(100, (coming / capacity) * 100) : 100

  return (
    <Card>
      <CardHeader>
        <CardTitle>Capacité</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-3xl font-semibold tabular-nums">
            {coming}
            <span className="text-lg text-muted-foreground"> / {capacity}</span>
          </p>
          <p
            className={cn(
              'text-sm font-medium',
              isFull ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {capacity === 0
              ? 'Capacité non définie'
              : isFull
                ? 'Complet'
                : `${remaining} place${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''}`}
          </p>
        </div>

        <Progress
          value={percent}
          aria-label="Taux de remplissage"
          className={cn('h-2', isFull && '[&>[data-slot=progress-indicator]]:bg-destructive')}
        />

        <p className="text-xs text-muted-foreground">
          Seuls les participants inscrits, confirmés ou présents occupent une place.
          {canceledCount > 0 && ` ${canceledCount} annulé${canceledCount > 1 ? 's' : ''}.`}
          {unknownCount > 0 &&
            ` ${unknownCount} au statut inconnu, non comptabilisé${unknownCount > 1 ? 's' : ''}.`}
        </p>

        {isOverCapacity && (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Capacité dépassée</AlertTitle>
            <AlertDescription>
              {coming - capacity} participant{coming - capacity > 1 ? 's' : ''} en trop (données
              modifiées hors de l'application). Aucune nouvelle place ne peut être attribuée tant
              que des participants ne sont pas annulés ou supprimés.
            </AlertDescription>
          </Alert>
        )}

        {capacity === 0 && (
          <Alert>
            <AlertTriangle />
            <AlertTitle>Aucune place disponible</AlertTitle>
            <AlertDescription>
              Cet événement n'a pas de capacité valide : aucune inscription n'est possible.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
