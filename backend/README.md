# Support Platform API

Backend for the Enterprise Support Ticket Platform — **NestJS 11 + Prisma 6 + PostgreSQL + RabbitMQ**.

This is the `api` application from the Phase 1 architecture: it serves the REST API
and is the **producer** side of the event pipeline. Domain mutations write events
to a **transactional outbox**, and a background **relay** publishes them to the
`support.events` topic exchange. The event **consumers** (the `worker` app that
populates notifications, the audit log and analytics) are delivered in Phase 3.

## Stack

| Concern            | Choice                                   |
| ------------------ | ---------------------------------------- |
| Framework          | NestJS 11                                |
| ORM                | Prisma 6 (PostgreSQL 16)                 |
| Messaging          | RabbitMQ (`@golevelup/nestjs-rabbitmq`)  |
| Auth               | JWT access + rotating refresh tokens     |
| Validation         | `class-validator` + global `ValidationPipe` |
| Docs               | Swagger / OpenAPI at `/api/docs`         |

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env        # adjust secrets as needed

# 3. Start infrastructure (PostgreSQL + RabbitMQ)
docker compose up -d

# 4. Apply the schema and seed demo data
npm run prisma:migrate -- --name init
npm run prisma:seed

# 5. Run the API
npm run start:dev
```

API: `http://localhost:3000/api` · Swagger: `http://localhost:3000/api/docs` · RabbitMQ UI: `http://localhost:15672`

## Demo accounts

All seeded users share the password `Password123!`:

| Role     | Email                |
| -------- | -------------------- |
| Admin    | `admin@acme.test`    |
| Agent    | `agent@acme.test`    |
| Customer | `customer@acme.test` |

## API surface

| Area          | Endpoints                                                                 |
| ------------- | ------------------------------------------------------------------------- |
| Auth          | `POST /auth/register` `POST /auth/login` `POST /auth/refresh` `POST /auth/logout` `GET /auth/me` |
| Organizations | `GET/POST /organizations` `GET/PATCH/DELETE /organizations/:id` (admin)   |
| Users         | `GET/POST /users` `GET/PATCH/DELETE /users/:id` (admin)                   |
| Tickets       | `GET/POST /tickets` `GET/PATCH /tickets/:id` `PATCH /tickets/:id/assign`  |
| Comments      | `GET/POST /tickets/:ticketId/comments`                                    |
| Notifications | `GET /notifications` `GET /notifications/unread-count` `PATCH /notifications/:id/read` `PATCH /notifications/read-all` |
| Audit         | `GET /audit` (admin)                                                      |

Every list endpoint supports `?page=&limit=&sort=field:direction&search=` plus
resource-specific filters. Responses use a consistent envelope: `{ data }` for a
single resource and `{ data, meta }` for paginated collections.

## Testing

```bash
npm test            # unit tests
npm run test:cov    # with coverage
```

## Project layout

```
src/
  common/         Reusable cross-cutting concerns (filters, interceptors,
                  guards, decorators, pagination helpers)
  config/         Typed configuration + Joi env validation
  prisma/         PrismaService / global PrismaModule
  messaging/      Event contracts, transactional-outbox publisher + relay
  auth/           Authentication, JWT strategy, refresh-token rotation
  organizations/  Tenant management (admin)
  users/          User management (admin, org-scoped)
  tickets/        Core ticket domain (emits ticket.* events)
  comments/       Ticket comments (emits comment.created)
  notifications/  Read model + acknowledgement endpoints
  audit/          Admin-only audit log read model
```
