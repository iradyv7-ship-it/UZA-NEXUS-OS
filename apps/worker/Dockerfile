# UZA Nexus outbox publisher.
#
# Runs from TypeScript via tsx (esbuild), matching `pnpm --filter @uza/worker dev`/`start` —
# same reasoning as apps/api/Dockerfile: no build step to add, no behavior change made
# during a deployment.
#
# This process imports `@uza/api`'s tiny public surface (outbox-public.ts) to reuse
# drainOutbox and the generated Prisma client, so the runtime image needs apps/api's
# source AND its generated Prisma client present — not just apps/worker's own code.
#
# Two stages so the runtime image does not carry the pnpm store or build toolchain.

FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/contracts/package.json ./packages/contracts/
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/
# See apps/api/Dockerfile for why --ignore-scripts is deliberate here too.
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @uza/worker... --filter @uza/contracts

FROM node:22-alpine AS runtime
RUN corepack enable
# openssl is required by Prisma's query engine on alpine.
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/contracts/node_modules ./packages/contracts/node_modules
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/contracts ./packages/contracts
COPY apps/api ./apps/api
COPY apps/worker ./apps/worker

# Generates into apps/api's node_modules/.prisma/client, which apps/worker resolves
# through the workspace link — same generated client apps/api itself uses.
WORKDIR /app/apps/api
RUN pnpm exec prisma generate

WORKDIR /app/apps/worker
CMD ["pnpm", "exec", "tsx", "src/main.ts"]
