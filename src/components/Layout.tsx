import { Link, Outlet } from 'react-router'

export function Layout() {
  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <Link to="/" className="text-lg font-semibold">
            Events
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
