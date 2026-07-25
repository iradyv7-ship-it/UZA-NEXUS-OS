/**
 * Public surface the worker consumes. Kept tiny and free of NestJS so apps/worker can
 * import the outbox processing logic and the generated Prisma client without pulling in
 * the HTTP layer.
 */
export { PrismaClient } from '@prisma/client';
export {
  processOutboxEvent,
  drainOutbox,
  type OutboxHandler,
} from './platform/outbox/outbox-processor';
