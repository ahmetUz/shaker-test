import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { getErrorMessage } from '@/queries'

type Props = {
  title: string
  error: unknown
  onRetry: () => void
}

export function QueryError({ title, error, onRetry }: Props) {
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center gap-3">
        <span>{getErrorMessage(error)}</span>
        <Button size="sm" variant="outline" onClick={onRetry}>
          Réessayer
        </Button>
      </AlertDescription>
    </Alert>
  )
}
