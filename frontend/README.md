# Support Platform — Web Client

Angular 22 front end for the Enterprise Support Ticket Platform. Talks to the
Phase 2 NestJS API and presents an enterprise support-desk console.

## Highlights

- **Angular 22, standalone, zoneless** — no NgModules, signal-based state, and
  `provideZonelessChangeDetection()` for fine-grained reactivity.
- **Signals everywhere** — `AuthService` exposes the session as signals; lists
  hold their state in signals; no manual change detection.
- **Functional interceptors & guards** — token attach + transparent refresh,
  centralised error toasts, `authGuard` / `roleGuard`.
- **Reusable UI kit** — a configuration-driven `DataTable` (server-side
  pagination, sorting, projected cell templates), `StatusChip`, `PageHeader`,
  `EmptyState`, `LoadingBar`, `ConfirmDialog`.
- **Material 3 theme** — azure/cyan palette with a single semantic colour
  language for ticket status and priority, reused across chips, cards and tables.

## Stack

| Concern          | Choice                                        |
| ---------------- | --------------------------------------------- |
| Framework        | Angular 22 (standalone + zoneless)            |
| UI               | Angular Material 22 (M3 theming)              |
| State            | Angular signals                               |
| Forms            | Reactive forms                                |
| Routing          | Lazy-loaded routes + functional guards        |
| HTTP             | `provideHttpClient` + functional interceptors |

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Start the Phase 2 API first (defaults to http://localhost:3000)
#    The dev server proxies /api -> localhost:3000 (see proxy.conf.json)

# 3. Run the app
npm start
```

Open `http://localhost:4200`.

### Demo accounts

All seeded users share the password `Password123!`:

| Role     | Email                | Sees                                  |
| -------- | -------------------- | ------------------------------------- |
| Admin    | `admin@acme.test`    | Everything incl. Users, Organizations |
| Agent    | `agent@acme.test`    | Dashboard + all tickets, can assign   |
| Customer | `customer@acme.test` | Dashboard + their own tickets         |

## Project structure

```
src/app/
  core/auth/        Token storage (persistence boundary)
  models/           Typed contracts mirroring the API
  services/         API integration + signal state (auth, tickets, users, …)
  interceptors/     auth (attach + refresh), error (toast)
  guards/           authGuard, roleGuard
  shared/           Reusable components + pipes (data-table, status-chip, …)
  layouts/          main-layout (sidenav shell), auth-layout
  features/
    auth/           login, register
    dashboard/      stat cards + recent tickets
    tickets/        list, detail (comments/assign/status), create-edit dialog
    users/          list + create-edit dialog (admin)
    organizations/  list + create-edit dialog (admin)
  app.config.ts     Providers (router, http, animations, session restore)
  app.routes.ts     Lazy routes guarded by auth + role
```

## How it talks to the API

`ApiService` is the single HTTP facade: it prefixes the configured base URL,
unwraps the `{ data }` / `{ data, meta }` envelope into plain resources or a
`PaginatedResult<T>`, and serialises query objects (dropping empty values). Every
feature service is a thin, typed wrapper over it.

The `authInterceptor` attaches the access token and, on a 401, performs a single
shared refresh (queuing concurrent requests) before retrying; if refresh fails
the user is signed out. The `errorInterceptor` sits outside it and turns anything
that still fails into a readable toast.
