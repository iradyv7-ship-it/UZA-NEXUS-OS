# UZA Nexus outbox publisher. Build context: backend/
#
# Runs from TypeScript under tsx, the same way `pnpm dev` does — see api/Dockerfile for
# why no build step is added here. The worker imports `drainOutbox` and the generated
# Prisma client from api, so the runtime image needs api's source AND its generated
# Prisma client present — not just the worker's own code.

FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY contracts/package.json ./contracts/
COPY api/package.json ./api/
COPY worker/package.json ./worker/
# See api/Dockerfile for why --ignore-scripts is deliberate here too.
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @uza/worker... --filter @uza/contracts

FROM node:22-alpine AS runtime
RUN corepack enable
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/worker/node_modules ./worker/node_modules
COPY --from=deps /app/api/node_modules ./api/node_modules
COPY --from=deps /app/contracts/node_modules ./contracts/node_modules
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY contracts ./contracts
COPY api ./api
COPY worker ./worker

# Generate the Prisma client the worker reaches through the workspace link — the same
# generated client api itself uses.
WORKDIR /app/api
RUN pnpm exec prisma generate

WORKDIR /app/worker
CMD ["pnpm", "exec", "tsx", "src/main.ts"]
