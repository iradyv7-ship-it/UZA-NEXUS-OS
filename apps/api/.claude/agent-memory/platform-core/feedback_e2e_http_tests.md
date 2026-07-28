---
name: e2e-http-tests-need-swc-child-process
description: HTTP/e2e tests must boot the app as a child process under the SWC runtime, not via in-process NestFactory in Vitest
metadata:
  type: feedback
---

For any HTTP/e2e test that needs the real NestJS app (guard, controllers, DI), boot it as a
**child process** under the SWC runtime (`spawn('node', ['-r','@swc-node/register','src/main.ts'])`),
health-poll stdout for `listening on`, drive it over `fetch`, and `kill` it in `afterAll`.
Seed data directly through Prisma / directly-constructed services (no DI).

**Why:** Vitest transforms with esbuild, which does NOT emit `emitDecoratorMetadata`. In-process
`NestFactory.create(AppModule)` inside a Vitest test therefore yields constructor injections that
are `undefined` (e.g. `this.prisma` is undefined → `Cannot read properties of undefined`). This is
the same reason the unit suites instantiate services directly. Only the SWC runtime
(`node -r @swc-node/register`, used by `pnpm start`) emits the metadata DI needs. I hit the
`undefined prisma` failure first-hand attempting the in-process approach.

**How to apply:** Reach for the child-process pattern whenever a test must exercise routing,
guards, filters, or DI wiring end-to-end. See `apps/api/test/api.e2e.test.ts` for the working
harness and `test/api-e2e-db.ts` for the full-truncate reset. Related: [[test-suite-conventions]].
