import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="space-y-4 text-center">
      <h1 className="text-2xl font-semibold">Page introuvable</h1>
      <Button asChild variant="outline">
        <Link to="/">Retour aux événements</Link>
      </Button>
    </div>
  )
}
