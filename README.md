# Event Participants

Small event management app focused on participant management and business rules.

Stack: React, TypeScript, React Query, TailwindCSS (+ shadcn/ui, React Router, Zod, Vite, Vitest).

## Setup

Requires Node 20.19+ (or 22.13+).

```bash
npm install
cp .env.example .env.local   # VITE_API_BASE_URL points to the MockAPI project
npm run dev
```

| Script | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Typecheck and build for production |
| `npm run typecheck` | Run the TypeScript compiler |
| `npm run test` | Run unit tests |
| `npm run lint` | Lint the codebase |

## Architecture

```
src/
  api.ts       HTTP client + Zod schemas that normalize raw API data into safe domain types
  rules.ts     Pure business rules (coming statuses, capacity, search): no React, fully unit-tested
  queries.ts   React Query hooks: query keys, server-side re-check before writes, optimistic updates
  pages/       Route-level components (events list, event page, not found)
  components/  Event page building blocks + shadcn/ui primitives
  lib/         Display formatting (dates, labels)
```

Each layer only depends on the one below it: components never call `fetch`, and rules never know about React or HTTP. Business rules can therefore be tested in isolation and reused both by the UI (to disable impossible actions) and by the mutations (to refuse them).

## Business rules

- **Coming** = `registered`, `confirmed` or `attended`. Only coming participants take a spot; `canceled` ones do not.
- **A spot is needed only when entering a coming status** from a non-coming one (or on creation). Switching between coming statuses (`registered` → `confirmed`) or leaving one (`→ canceled`) is always allowed, even when the event is full.
- **Capacity is enforced at two levels:**
  1. **UI**: the "Ajouter" button and the status options that would need a spot are disabled when the event is full.
  2. **Before each write**: the mutation re-reads the event and its participants from the server (bypassing the cache) and re-checks the rule. This catches changes made in another tab or by another user since the page was loaded.
- **Events list occupancy** (`coming / capacity`, remaining spots, "Complet" badge) comes from a single `/participants` request grouped by event, not one request per event. Every participant write invalidates it, so the list is up to date when you come back to it. If that request fails, the list still shows the capacity.
- **Delete** asks for confirmation and suggests the `Annulé` status to keep a record.

## Edge cases handled

- **Dirty mock data**: statuses like `"status 1"` are normalized to `unknown` (shown as "Statut inconnu", not counted toward capacity), numeric `location`s become "Lieu non précisé", timestamps in seconds are converted, invalid/missing capacities become `0` (so they can never be exceeded and nobody can be added).
- **Event already over capacity** (data edited outside the app): a warning is shown; no new spot can be given, but participants can still be canceled or deleted to get back under the limit.
- **`?eventId=1` is a substring filter in MockAPI** (it also returns event 10): participants are fetched via the nested route `/events/:id/participants` and filtered strictly.
- **MockAPI returns 404 instead of `[]`** when an event has no participants: treated as an empty list.
- **Participants are a child resource of events in MockAPI**: `DELETE /participants/:id` always answers 404, so writes use `/events/:eventId/participants/:id`. A 404 on delete is then treated as success (already deleted elsewhere).
- **Concurrent status changes**: each row has its own mutation; on failure only that participant is rolled back, and the list is refetched once the last change settles so parallel updates do not overwrite each other.
- **Unknown event id** → "Événement introuvable" page (404 is not retried); network/server errors show a retry button.
- **Search** is case- and accent-insensitive, trims whitespace, and only filters the display: capacity is always computed on the full list.
- **Creation form**: trimmed name, required, max 100 characters; warning (non-blocking) for a likely duplicate name; warning when marking someone as attended before the event starts; the dialog cannot be closed while the request is in flight.
- Broken avatar URLs fall back to initials.

## Assumptions

- Creating a participant directly as `canceled` has no product value, so only coming statuses are offered on creation.
- Marking someone `attended` before the event starts is allowed (the brief does not forbid it) but flagged with a warning.
- Homonyms exist, so duplicate names are only a warning, not a blocking rule.
- Events are sorted with upcoming ones first (soonest on top), then past ones (most recent on top). All mock events are in the past, so they all show "Terminé".
- The UI is in French (the product's audience); code and docs are in English.

## What I would improve with more time

- **Enforce capacity on the server.** The client-side re-check narrows the race window but cannot close it: two users can still pass the check at the same time. This needs a backend transaction or a conditional write; MockAPI cannot do it.
- **Status filter and sorting** on the participants list, plus pagination/virtualization for large events (the API supports `page`/`limit`). Loading every participant for the events list only works while the dataset is small; a real API should return a participant count per event.
- **Component and end-to-end tests** (React Testing Library + MSW, Playwright) for the full flows; currently the API layer, business rules and mutation re-checks are unit-tested.
- **Edit participant details** (name) and **undo** for delete/cancel via the toast.
- A waiting list when the event is full instead of a hard block.
