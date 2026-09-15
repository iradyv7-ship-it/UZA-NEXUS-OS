# UZA Nexus web. Build context: frontend/
#
# Next.js standalone output, so the runtime image carries the server and only the
# node_modules the build actually traced — not the whole workspace.
#
# UZA_API_URL is baked at build time by next.config.mjs (it uses `env:`, which inlines
# rather than reading at runtime), so it is passed as a build arg. In compose the API is
# reachable as http://api:3000 on the internal network and is never published to the host.

FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY web/package.json ./web/
# `--ignore-scripts` is deliberate: pnpm 11 treats un-approved dependency build scripts
# as a fatal error, and nothing the web app needs runs one.
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @uza/web...

FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
ARG UZA_API_URL=http://api:3000
ENV UZA_API_URL=$UZA_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/web/node_modules ./web/node_modules
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY web ./web
WORKDIR /app/web
RUN pnpm build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3100
# Next writes the standalone server plus a pruned node_modules; static assets and public
# files are not included in it and have to be copied alongside.
COPY --from=build /app/web/.next/standalone ./
COPY --from=build /app/web/.next/static ./web/.next/static
COPY --from=build /app/web/public ./web/public
EXPOSE 3100
CMD ["node", "web/server.js"]
