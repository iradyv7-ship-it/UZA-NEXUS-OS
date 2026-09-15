# UZA Nexus outbox publisher.
#
# Runs from TypeScript via tsx (esbuild), matching `pnpm --filter @uza/worker dev`/`start` —
# same reasoning as backend/api/Dockerfile: no build step to add, no behavior change made
# during a deployment.
#
# This process imports `@uza/api`'s tiny public surface (outbox-public.ts) to reuse
# drainOutbox and the generated Prisma client, so the runtime image needs backend/api's
# source AND its generated Prisma client present — not just backend/worker's own code.
#
# Two stages so the runtime image does not carry the pnpm store or build toolchain.

FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/contracts/package.json ./backend/contracts/
COPY backend/api/package.json ./backend/api/
COPY backend/worker/package.json ./backend/worker/
# See backend/api/Dockerfile for why --ignore-scripts is deliberate here too.
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @uza/worker... --filter @uza/contracts

FROM node:22-alpine AS runtime
RUN corepack enable
# openssl is required by Prisma's query engine on alpine.
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/worker/node_modules ./backend/worker/node_modules
COPY --from=deps /app/backend/api/node_modules ./backend/api/node_modules
COPY --from=deps /app/backend/contracts/node_modules ./backend/contracts/node_modules
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/contracts ./backend/contracts
COPY backend/api ./backend/api
COPY backend/worker ./backend/worker

# Generates into backend/api's node_modules/.prisma/client, which backend/worker resolves
# through the workspace link — same generated client backend/api itself uses.
WORKDIR /app/backend/api
RUN pnpm exec prisma generate

WORKDIR /app/backend/worker
CMD ["pnpm", "exec", "tsx", "src/main.ts"]
