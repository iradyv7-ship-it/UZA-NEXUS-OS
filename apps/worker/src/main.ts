/**
 * Outbox PUBLISHER.
 *
 * This process has one job: drain committed `OutboxEvent(status=pending)` rows and publish
 * each to the BullMQ `uza.events` queue exactly once, marking the row `published`. The
 * `(eventId, 'outbox-publisher')` ProcessedEvent claim inside `drainOutbox` guarantees a
 * committed event is enqueued at most once even if a pass overlaps a retry.
 *
 * It deliberately does NOT consume the queue. Module fan-out (delivering an event to
 * OrderService/InvoiceService/… ) runs in apps/api, because those NestJS services need
 * constructor injection with `emitDecoratorMetadata`, which apps/api's SWC runtime emits
 * and this process's tsx (esbuild) runtime does not. Keeping a consumer here as well would
 * also let this process steal jobs from the real fan-out. Publisher here, consumer there.
 *
 * Idempotency layers overall:
 *   1. drainOutbox enqueues each committed event once.
 *   2. BullMQ de-dupes by jobId (= eventId) as a first line of defence.
 *   3. Each consumer handler claims `(eventId, consumer)` before doing work, so a
 *      redelivered job runs the handler at most once.
 */
import { Queue, type ConnectionOptions } from 'bullmq';
import IORedis from 'ioredis';
import type { EventEnvelope } from '@uza/contracts';
import {
  PrismaClient,
  drainOutbox,
  EVENTS_QUEUE,
  EVENT_JOB_OPTS,
  type OutboxHandler,
} from '@uza/api';

const POLL_MS = Number(process.env.OUTBOX_POLL_MS ?? 2000);

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
const prisma = new PrismaClient();

async function main(): Promise<void> {
  const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
  }) as unknown as ConnectionOptions;
  const queue = new Queue(EVENTS_QUEUE, { connection });

  // Publisher: committed outbox rows -> BullMQ jobs (marks each row published once).
  const enqueueToBus: OutboxHandler = async (envelope: EventEnvelope) => {
    await queue.add(envelope.name, envelope, { ...EVENT_JOB_OPTS, jobId: envelope.eventId });
  };

  const publisher = setInterval(() => {
    void drainOutbox(prisma, 'outbox-publisher', enqueueToBus).catch((e) =>
      console.error('[publisher] drain failed', e),
    );
  }, POLL_MS);

  console.log(
    `UZA outbox publisher up. Polling outbox every ${POLL_MS}ms, publishing to "${EVENTS_QUEUE}".`,
  );

  const shutdown = async () => {
    clearInterval(publisher);
    await queue.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  console.error('publisher failed to start', e);
  process.exit(1);
});
