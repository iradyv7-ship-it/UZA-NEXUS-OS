/**
 * Outbox publisher + BullMQ consumer.
 *
 * Two idempotency layers:
 *   1. The publisher drains OutboxEvent rows and marks each `published`, so a committed
 *      event is enqueued exactly once under normal operation.
 *   2. The consumer records `(eventId, consumer)` in ProcessedEvent BEFORE running its
 *      handler, so even a redelivered job runs the handler at most once. This is the
 *      idempotency the charter requires ("every handler is idempotent on eventId").
 *
 * Platform-core owns no business events, so the consumer's job here is to fan an
 * envelope out to subscribers (other modules). Until those exist it logs — the durable
 * record already lives in the outbox and processed-events tables.
 */
import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import IORedis from 'ioredis';
import type { EventEnvelope } from '@uza/contracts';
import { PrismaClient, drainOutbox, processOutboxEvent, type OutboxHandler } from '@uza/api';

const QUEUE = 'uza.events';
const CONSUMER = 'bullmq-fanout';
const POLL_MS = Number(process.env.OUTBOX_POLL_MS ?? 2000);

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
const prisma = new PrismaClient();

async function main(): Promise<void> {
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null }) as unknown as ConnectionOptions;
  const queue = new Queue(QUEUE, { connection });

  // Publisher: committed outbox rows -> BullMQ jobs (marks each row published once).
  const enqueueToBus: OutboxHandler = async (envelope: EventEnvelope) => {
    await queue.add(envelope.name, envelope, {
      jobId: envelope.eventId, // BullMQ de-dupes by jobId as a first line of defence
      removeOnComplete: true,
      removeOnFail: false,
    });
  };

  const publisher = setInterval(() => {
    void drainOutbox(prisma, 'outbox-publisher', enqueueToBus).catch((e) =>
      console.error('[publisher] drain failed', e),
    );
  }, POLL_MS);

  // Consumer: idempotent fan-out to subscribers.
  const worker = new Worker(
    QUEUE,
    async (job) => {
      const envelope = job.data as EventEnvelope;
      const result = await processOutboxEvent(prisma, CONSUMER, envelope, deliver);
      console.log(`[consumer] ${envelope.name} ${envelope.eventId} -> ${result}`);
    },
    { connection },
  );

  worker.on('failed', (job, err) => console.error(`[consumer] job ${job?.id} failed`, err));
  console.log(`UZA worker up. Polling outbox every ${POLL_MS}ms, consuming "${QUEUE}".`);

  const shutdown = async () => {
    clearInterval(publisher);
    await worker.close();
    await queue.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

/** Real subscribers (other modules) attach here in later sprints. */
const deliver: OutboxHandler = async (envelope: EventEnvelope) => {
  // no-op fan-out for now; durable record already exists in outbox + processed_events
  void envelope;
};

main().catch((e) => {
  console.error('worker failed to start', e);
  process.exit(1);
});
