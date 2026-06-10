# Enterprise Support Ticket Platform

[![CI](https://github.com/YOUR_GITHUB_USER/support-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_GITHUB_USER/support-platform/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A production-shaped, event-driven support desk built to demonstrate senior-level
engineering across the stack: **Angular 22** SPA, **NestJS 11** API + worker,
**PostgreSQL 16**, **RabbitMQ 3.13**, orchestrated with **Docker Compose**.

Organizations manage support tickets across three roles — administrators, agents
and customers — with notifications, an audit trail and operational metrics built
asynchronously from a real event stream.

---

## Table of contents

- [Highlights](#highlights)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Getting started (Docker)](#getting-started-docker)
- [Local development](#local-development)
- [Testing](#testing)
- [Security hardening](#security-hardening)
- [Environment variables](#environment-variables)
- [API overview](#api-overview)
- [Design decisions](#design-decisions)
- [License](#license)

---

## Highlights

- **Event-driven core.** Domain changes are published to RabbitMQ via a
  **transactional outbox** and projected by three independent, idempotent
  consumers (notifications, audit, analytics) with bounded retries and a
  dead-letter queue.
- **Clean separation.** The API (HTTP + producer) and the worker (consumers) are
  separate processes from one codebase, independently scalable.
- **Modern Angular.** Standalone, zoneless, signal-based state, reactive forms,
  functional guards/interceptors, lazy routes, and a reusable Material 3 UI kit.
- **Secure by default.** JWT access/refresh with rotation and reuse detection,
  RBAC, Helmet, CORS allow-listing, global + per-route rate limiting, strict DTO
  validation, and a consistent response/error envelope.
- **Tested and documented.** Unit tests for critical services, HTTP integration
  tests for the auth and ticket-creation flows, and full setup/architecture docs.

## Architecture

```
                         ┌─────────────┐
   browser ──/──────────▶│  frontend   │  nginx (SPA + /api reverse proxy)
                         └──────┬──────┘
                          /api  │
                         ┌──────▼──────┐   outbox relay (publish)
                         │   backend   │ ───────────────┐
                         │  NestJS API │                │
                         └──────┬──────┘                ▼
                                │ write          ┌───────────────────┐
                         ┌──────▼──────┐         │     RabbitMQ      │
                         │ PostgreSQL  │◀────────│  support.events   │
                         └──────▲──────┘         └─────────┬─────────┘
                                │ project                  │ consume
                         ┌──────┴──────┐                   │
                         │   worker    │◀──────────────────┘
                         │  consumers  │  notification · audit · analytics
                         └─────────────┘
```

### Write path and the outbox

A request that changes state (e.g. *create ticket*) does the domain write **and**
inserts an event row in the `event_outbox` table inside a single Prisma
transaction. The event is therefore published if and only if the data commits —
no lost or phantom events. A relay task forwards outbox rows to the
`support.events` topic exchange.

### Consumers

The worker hosts three consumers, each owning one queue and reacting to its own
bindings:

| Queue                | Binds                                                   | Builds                       |
| -------------------- | ------------------------------------------------------- | ---------------------------- |
| `notification.queue` | ticket.created/updated/assigned/closed, comment.created | per-user notifications       |
| `audit.queue`        | `#` (every event)                                       | immutable audit trail        |
| `analytics.queue`    | ticket.created/assigned/closed                          | daily per-org metric rollups |
| `dlq`                | `#` on `support.events.dlx`                              | terminal failure sink        |

Every consumer runs through a shared runner that guarantees:

- **Idempotency** — a `processed_events` row (unique on `eventId + consumer`) is
  written in the same transaction as the projection, so duplicate deliveries are
  no-ops.
- **Bounded retry, isolated** — a failed message is re-published only to its own
  queue with an incremented retry header; one consumer's failure never replays
  another's work.
- **Dead-lettering** — once retries are exhausted the message (plus its error) is
  routed to the dead-letter exchange. The original delivery is always acked so a
  poison message can't block the queue.

### Request pipeline (API)

`correlation-id → throttler guard → JWT auth guard → roles guard → validation
pipe → controller → service` and on the way out, a response interceptor wraps
results in `{ data }` / `{ data, meta }`, while a global exception filter maps
errors (including Prisma codes) to a single error envelope.

## Tech stack

| Layer            | Technology                                                          |
| ---------------- | ------------------------------------------------------------------- |
| Frontend         | Angular 22 (standalone, zoneless, signals), Angular Material 22 (M3) |
| Backend          | NestJS 11, Prisma 6, Passport JWT, class-validator, Swagger          |
| Database         | PostgreSQL 16                                                        |
| Messaging        | RabbitMQ 3.13 (topic exchange, DLX), @golevelup/nestjs-rabbitmq      |
| Infrastructure   | Docker, Docker Compose, nginx                                       |
| Testing          | Jest + Supertest (backend), Karma + Jasmine (frontend)              |

## Repository layout

```
support-platform/
├── docker-compose.yml        # postgres · rabbitmq · migrate · backend · worker · frontend · seed
├── .env.example              # deployment configuration (copy to .env)
├── README.md
├── docs/ENVIRONMENT.md       # full environment variable reference
├── infra/postgres/init/      # DB bootstrap (extensions, UTC)
├── backend/                  # NestJS API + worker (shared codebase)
│   ├── src/
│   │   ├── auth/ users/ organizations/ tickets/ comments/ notifications/ audit/
│   │   ├── messaging/        # outbox publisher + relay + event contracts/topology
│   │   ├── consumers/        # notification / audit / analytics / dead-letter + runner
│   │   ├── worker/           # worker module + RabbitMQ wiring
│   │   ├── health/           # liveness + readiness probes
│   │   ├── common/           # guards, interceptors, filters, decorators, utils
│   │   ├── config/           # typed config + Joi validation
│   │   ├── app.setup.ts      # shared security/bootstrap (used by app and e2e)
│   │   ├── main.ts           # API entrypoint
│   │   └── worker.ts         # worker entrypoint
│   ├── prisma/               # schema + seed
│   └── test/                 # e2e (auth, ticket creation)
└── frontend/                 # Angular SPA
    ├── src/app/
    │   ├── core/ models/ services/ interceptors/ guards/ shared/ layouts/ features/
    │   └── app.config.ts app.routes.ts
    └── nginx.conf
```

## Getting started (Docker)

Requires Docker with the Compose plugin.

```bash
cp .env.example .env          # then edit the JWT secrets
docker compose up --build     # postgres, rabbitmq, schema migration, backend, worker, frontend

# first run only — load a demo organization, users and tickets:
docker compose --profile seed run --rm seed
```

| Surface          | URL                                            |
| ---------------- | ---------------------------------------------- |
| Web app          | http://localhost:8080                          |
| API + Swagger    | http://localhost:3000/api · /api/docs          |
| API health       | http://localhost:3000/api/health · /ready      |
| Worker health    | http://localhost:3001/health · /ready          |
| RabbitMQ console | http://localhost:15672                         |

Demo accounts (after seeding) — password `Password123!`:
`admin@acme.test`, `agent@acme.test`, `customer@acme.test`.

## Local development

Run PostgreSQL and RabbitMQ (e.g. `docker compose up postgres rabbitmq`), then:

```bash
# backend (API)
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma db push          # sync schema
npm run prisma:seed         # optional demo data
npm run start:dev           # API on :3000

# worker (separate terminal, same .env)
npm run start:worker:dev    # consumers + health on :3001

# frontend (separate terminal)
cd ../frontend
npm install
npm start                   # :4200, proxies /api -> :3000
```

## Testing

```bash
# Backend — unit tests (services, consumers, guards)
cd backend
npm test
npm run test:cov            # with coverage

# Backend — HTTP integration tests (auth + ticket creation flows)
npm run test:e2e

# Frontend — component/service tests
cd ../frontend
npm test
```

**What's covered**

- *Backend unit* — idempotency (exactly-once + duplicate handling), the consumer
  runner (success / retry / dead-letter), the notification projection (recipient
  selection, author exclusion), plus the existing auth and tickets service specs.
- *Backend integration* — register validation, login → token pair, `/auth/me`
  authorization, and the full ticket-creation flow asserting the `ticket.created`
  event is enqueued in the same transaction. These boot the real Nest pipeline
  (validation, JWT guard, RBAC, response envelope) over HTTP with the database
  and broker mocked at the boundary.
- *Frontend* — `AuthService` signal state and token storage, `authGuard`
  redirect behaviour, and `StatusChipComponent` rendering/colour mapping.

## Security hardening

- **Authentication** — short-lived JWT access tokens; refresh tokens are stored
  only as SHA-256 hashes and rotated on use, with **reuse detection** that revokes
  the whole token family on replay.
- **Authorization** — role-based access (ADMIN / AGENT / CUSTOMER) enforced by a
  guard; data is additionally scoped by organization.
- **Transport/headers** — Helmet; CORS restricted to configured origins with
  credentials; `trust proxy` so rate limiting sees the real client IP behind nginx.
- **Rate limiting** — a global throttler plus tighter per-route limits on
  `/auth/login`, `/auth/register` and `/auth/refresh` to blunt brute force.
- **Input** — a strict global `ValidationPipe` (`whitelist` + `forbidNonWhitelisted`
  + transform) rejects unknown or malformed fields; passwords are bcrypt-hashed.

All of the above are applied centrally in `backend/src/app.setup.ts`, which both
the running app and the e2e tests use, so the tested pipeline is the shipped one.

## Environment variables

See [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md) for the complete reference. The
deployment defaults live in [`.env.example`](.env.example); copy it to `.env`
and change the JWT secrets before running.

## API overview

REST under `/api`, documented at `/api/docs` (Swagger). Responses use a
consistent envelope: `{ data }` for a resource, `{ data, meta }` for paginated
lists, and a structured error body (`statusCode`, `error`, `message`, `path`,
`correlationId`, `timestamp`) on failure. Highlights:

- `POST /api/auth/register · login · refresh · logout`, `GET /api/auth/me`
- `GET/POST /api/tickets`, `GET/PATCH /api/tickets/:id`, `PATCH /api/tickets/:id/assign`
- `GET/POST /api/tickets/:id/comments`
- `GET /api/notifications`, `/unread-count`, `PATCH /api/notifications/:id/read`
- `GET/POST/PATCH/DELETE /api/users` and `/api/organizations` (admin)
- `GET /api/audit` (admin)

## Design decisions

- **Transactional outbox over dual-write** — guarantees data and events stay
  consistent without distributed transactions.
- **Worker as a second entrypoint** — same code and contracts as the API, run as
  its own container so consumers scale independently of HTTP traffic.
- **Schema via `prisma db push`** in the migrate job — the repo ships the schema
  as the source of truth without committed migration files; a production pipeline
  would commit migrations and switch the command to `prisma migrate deploy`.
- **Bounded in-queue retries** (no delay) — simple and dependency-free; true
  backoff would use the RabbitMQ delayed-message plugin or a TTL retry queue.

## License

[MIT](LICENSE) © Juan Francisco Martínez Morales
