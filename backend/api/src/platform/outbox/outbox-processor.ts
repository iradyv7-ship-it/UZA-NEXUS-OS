import { Prisma, PrismaClient } from '@prisma/client';
import type { EventEnvelope, UzaEventName } from '@uza/contracts';

export type OutboxHandler = (envelope: EventEnvelope) => Promise<void>;

/**
 * Idempotent processing of a single outbox event for a named consumer.
 *
 * Exactly-once is enforced by the `(eventId, consumer)` unique constraint on
 * ProcessedEvent: we claim the event by inserting that row FIRST. If the insert hits a
 * unique violation the event was already handled by this consumer, so we skip. The
 * handler therefore runs at most once per (eventId, consumer), no matter how many times
 * the same envelope is delivered.
 */
export async function processOutboxEvent(
  prisma: PrismaClient,
  consumer: string,
  envelope: EventEnvelope,
  handler: OutboxHandler,
): Promise<'processed' | 'skipped'> {
  try {
    await prisma.processedEvent.create({
      data: { eventId: envelope.eventId, consumer },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return 'skipped'; // already processed by this consumer
    }
    throw err;
  }

  await handler(envelope);
  return 'processed';
}

/**
 * Drain pending outbox rows: for each, run the consumer's handler idempotently and,
 * on success, mark the row published. Returns the number of rows published this pass.
 * This is the loop the worker runs; it is also directly unit-testable without Redis.
 */
export async function drainOutbox(
  prisma: PrismaClient,
  consumer: string,
  handler: OutboxHandler,
  batchSize = 100,
): Promise<number> {
  const pending = await prisma.outboxEvent.findMany({
    where: { status: 'pending' },
    orderBy: { createdAt: 'asc' },
    take: batchSize,
  });

  let published = 0;
  for (const row of pending) {
    const envelope: EventEnvelope = {
      eventId: row.eventId,
      name: row.name as UzaEventName,
      actorId: row.actorId,
      occurredAt: row.occurredAt.toISOString(),
      payload: row.payload as EventEnvelope['payload'],
    };

    try {
      await processOutboxEvent(prisma, consumer, envelope, handler);
      await prisma.outboxEvent.update({
        where: { id: row.id },
        data: { status: 'published', publishedAt: new Date() },
      });
      published += 1;
    } catch (err) {
      await prisma.outboxEvent.update({
        where: { id: row.id },
        data: { attempts: { increment: 1 }, lastError: String(err) },
      });
    }
  }
  return published;
}
