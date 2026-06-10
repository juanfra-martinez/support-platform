# Environment Variables

Two layers of configuration:

1. **Deployment (`./.env`)** — read by `docker compose`. Copy from
   [`../.env.example`](../.env.example). Compose derives `DATABASE_URL` and
   `RABBITMQ_URI` from these and injects them into the backend/worker containers.
2. **Application (`backend/.env`)** — read by NestJS when running the API or
   worker outside Docker. Copy from `backend/.env.example`. Validated at boot by
   a Joi schema (`backend/src/config/env.validation.ts`); the process exits if a
   required value is missing or malformed.

In Docker you only edit the root `.env`; the application variables are supplied
by `docker-compose.yml`.

---

## Deployment variables (root `.env`)

| Variable               | Required | Default                  | Description                                                  |
| ---------------------- | -------- | ------------------------ | ------------------------------------------------------------ |
| `POSTGRES_USER`        | yes      | `support`                | PostgreSQL superuser created by the image.                   |
| `POSTGRES_PASSWORD`    | yes      | `support`                | PostgreSQL password. **Change for any shared environment.**  |
| `POSTGRES_DB`          | yes      | `support_platform`       | Database created on first init.                              |
| `RABBITMQ_USER`        | yes      | `support`                | RabbitMQ default user.                                       |
| `RABBITMQ_PASSWORD`    | yes      | `support`                | RabbitMQ password. **Change for any shared environment.**    |
| `JWT_ACCESS_SECRET`    | yes      | —                        | Secret for signing access tokens. Min 16 chars; use 32+.     |
| `JWT_ACCESS_EXPIRES_IN`| no       | `15m`                    | Access-token lifetime (`s`/`m`/`h`/`d`).                     |
| `JWT_REFRESH_SECRET`   | yes      | —                        | Secret for signing refresh tokens. Min 16 chars; use 32+.    |
| `JWT_REFRESH_EXPIRES_IN`| no      | `7d`                     | Refresh-token lifetime.                                      |
| `BCRYPT_SALT_ROUNDS`   | no       | `12`                     | bcrypt cost factor (10–15).                                  |
| `CONSUMER_MAX_RETRIES` | no       | `3`                      | In-queue retries before a message is dead-lettered.          |
| `CORS_ORIGIN`          | no       | `http://localhost:8080`  | Allowed browser origin(s); comma-separate for several.       |
| `FRONTEND_PORT`        | no       | `8080`                   | Host port for the web app.                                   |
| `BACKEND_PORT`         | no       | `3000`                   | Host port for the API.                                       |
| `POSTGRES_PORT`        | no       | `5432`                   | Host port for PostgreSQL.                                    |
| `RABBITMQ_PORT`        | no       | `5672`                   | Host port for AMQP.                                          |
| `RABBITMQ_MGMT_PORT`   | no       | `15672`                  | Host port for the RabbitMQ management UI.                    |

## Application variables (`backend/.env`)

Used when running the API/worker directly (not through Compose).

| Variable                  | Required | Default                  | Used by | Description                                            |
| ------------------------- | -------- | ------------------------ | ------- | ------------------------------------------------------ |
| `NODE_ENV`                | no       | `development`            | both    | `development` \| `production` \| `test`.               |
| `PORT`                    | no       | `3000`                   | API     | HTTP port for the API.                                 |
| `WORKER_PORT`             | no       | `3001`                   | worker  | HTTP port exposing the worker's health probes.         |
| `API_GLOBAL_PREFIX`       | no       | `api`                    | API     | Path prefix for all routes.                            |
| `CORS_ORIGIN`             | no       | `http://localhost:4200`  | API     | Allowed origin(s); comma-separated list supported.     |
| `DATABASE_URL`            | yes      | —                        | both    | PostgreSQL connection string.                          |
| `JWT_ACCESS_SECRET`       | yes      | —                        | both\*  | Access-token signing secret (min 16 chars).            |
| `JWT_ACCESS_EXPIRES_IN`   | no       | `15m`                    | API     | Access-token lifetime.                                 |
| `JWT_REFRESH_SECRET`      | yes      | —                        | both\*  | Refresh-token signing secret (min 16 chars).           |
| `JWT_REFRESH_EXPIRES_IN`  | no       | `7d`                     | API     | Refresh-token lifetime.                                |
| `BCRYPT_SALT_ROUNDS`      | no       | `12`                     | API     | bcrypt cost factor (10–15).                            |
| `THROTTLE_TTL`            | no       | `60`                     | API     | Global rate-limit window, seconds.                     |
| `THROTTLE_LIMIT`          | no       | `120`                    | API     | Global requests allowed per window.                    |
| `RABBITMQ_URI`            | yes      | —                        | both    | AMQP connection string.                                |
| `RABBITMQ_EXCHANGE`       | no       | `support.events`         | both    | Topic exchange name.                                   |
| `OUTBOX_POLL_INTERVAL_MS` | no       | `3000`                   | API     | Outbox relay poll interval.                            |
| `OUTBOX_BATCH_SIZE`       | no       | `50`                     | API     | Max outbox rows published per tick.                    |
| `OUTBOX_MAX_ATTEMPTS`     | no       | `5`                      | API     | Publish attempts before an outbox row is marked FAILED.|
| `CONSUMER_MAX_RETRIES`    | no       | `3`                      | worker  | In-queue retries before dead-lettering.                |

\* The shared config schema validates the JWT secrets for both processes, so the
worker is given them too even though it does not issue tokens.

## Generating strong secrets

```bash
# 32-byte base64 secret, suitable for JWT_ACCESS_SECRET / JWT_REFRESH_SECRET
openssl rand -base64 32
```

## Notes

- Connection strings in Docker use the service names `postgres` and `rabbitmq`
  as hosts; locally they are `localhost`.
- The API and worker validate configuration at startup and fail fast on missing
  required values — a misconfigured deployment never starts in a half-broken state.
