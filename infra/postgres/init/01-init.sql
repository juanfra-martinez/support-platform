-- Runs once, on first initialization of the PostgreSQL data directory.
-- Executed by the official postgres image against the POSTGRES_DB database.

-- Extensions used for UUID/crypto helpers and case-insensitive text. Prisma
-- generates UUIDs application-side, but enabling these keeps the database
-- self-sufficient for raw SQL, future migrations and ad-hoc queries.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
