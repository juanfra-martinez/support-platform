# syntax=docker/dockerfile:1

# ---- Dependencies (full, including dev) ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# ---- Build: generate Prisma client + compile TS ----
# This stage keeps the full toolchain (Prisma CLI, ts-node) and is reused by the
# one-off migration/seed job in docker-compose.
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json tsconfig*.json nest-cli.json ./
COPY prisma ./prisma
COPY src ./src
RUN npx prisma generate && npm run build

# ---- Runtime: lean, production-only deps, non-root ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S nodejs && adduser -S nestjs -G nodejs

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npm cache clean --force

# Bring in the generated Prisma client (engine + types) and compiled output.
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist

USER nestjs
EXPOSE 3000 3001

# Default command runs the API; the worker overrides this in docker-compose.
CMD ["node", "dist/main.js"]
