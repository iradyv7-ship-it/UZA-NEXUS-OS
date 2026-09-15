import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { EventEnvelope } from '@uza/contracts';
import { prisma, resetDb } from './db';
import { OutboxService } from '../src/platform/outbox/outbox.service';
import { processOutboxEvent, drainOutbox } from '../src/platform/outbox/outbox-processor';

const outbox = new OutboxService(prisma as never);

const envelope = (eventId: string): EventEnvelope => ({
  eventId,
  name: 'order.created',
  actorId: 'AGT-GOM-0021',
  occurredAt: new Date().toISOString(),
  payload: {
    orderRef: 'ORD-BULK-2026-0003',
    customerRef: 'CUS-CD-000001',
    agentId: 'AGT-GOM-0021',
    totalMinor: 1000 as never,
    tier: 'new',
  },
});

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe('worker idempotency (keyed on eventId)', () => {
  it('runs a handler at most once per (eventId, consumer), even on redelivery', async () => {
    const eventId = randomUUID();
    let handled = 0;
    const handler = async () => {
      handled += 1;
    };

    const first = await processOutboxEvent(prisma, 'test-consumer', envelope(eventId), handler);
    const second = await processOutboxEvent(prisma, 'test-consumer', envelope(eventId), handler);
    const third = await processOutboxEvent(prisma, 'test-consumer', envelope(eventId), handler);

    expect(first).toBe('processed');
    expect(second).toBe('skipped');
    expect(third).toBe('skipped');
    expect(handled).toBe(1); // handler ran exactly once despite three deliveries

    const processed = await prisma.processedEvent.count({ where: { eventId } });
    expect(processed).toBe(1);
  });

  it('independent consumers each process the same event exactly once', async () => {
    const eventId = randomUUID();
    let a = 0;
    let b = 0;
    await processOutboxEvent(prisma, 'consumer-a', envelope(eventId), async () => {
      a += 1;
    });
    await processOutboxEvent(prisma, 'consumer-a', envelope(eventId), async () => {
      a += 1;
    });
    await processOutboxEvent(prisma, 'consumer-b', envelope(eventId), async () => {
      b += 1;
    });
    expect(a).toBe(1);
    expect(b).toBe(1);
  });

  it('drainOutbox publishes each pending row once and marks it published', async () => {
    // Seed two committed events via the outbox.
    await outbox.emit('AGT-GOM-0021', async (_tx, emit) => {
      await emit('order.created', envelope(randomUUID()).payload as never);
    });
    await outbox.emit('AGT-GOM-0021', async (_tx, emit) => {
      await emit('order.created', envelope(randomUUID()).payload as never);
    });

    let delivered = 0;
    const publishedFirst = await drainOutbox(prisma, 'bus', async () => {
      delivered += 1;
    });
    const publishedSecond = await drainOutbox(prisma, 'bus', async () => {
      delivered += 1;
    });

    expect(publishedFirst).toBe(2);
    expect(publishedSecond).toBe(0); // nothing left pending
    expect(delivered).toBe(2);
    expect(await prisma.outboxEvent.count({ where: { status: 'published' } })).toBe(2);
  });
});
