import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import { minor } from '@uza/contracts';
import { prisma, resetDb } from './db';
import { OutboxService } from '../src/platform/outbox/outbox.service';

const outbox = new OutboxService(prisma as never);

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe('transactional outbox', () => {
  it('writes the event in the SAME transaction as the state change (commit path)', async () => {
    await outbox.emit('AGT-GOM-0021', async (tx, emit) => {
      const org = await tx.organisation.create({ data: { name: 'Committed Co' } });
      await emit('order.created', {
        orderRef: 'ORD-BULK-2026-0001',
        customerRef: 'CUS-CD-000001',
        agentId: 'AGT-GOM-0021',
        totalMinor: minor(1000),
        tier: 'new',
      });
      return org;
    });

    expect(await prisma.organisation.count()).toBe(1);
    const events = await prisma.outboxEvent.findMany();
    expect(events).toHaveLength(1);
    expect(events[0]!.name).toBe('order.created');
    expect(events[0]!.status).toBe('pending'); // published only by the worker
  });

  it('does NOT publish the event when its transaction rolls back', async () => {
    const boom = new Error('state change failed after emit');

    await expect(
      outbox.emit('AGT-GOM-0021', async (tx, emit) => {
        // A real state change...
        await tx.organisation.create({ data: { name: 'Rolled Back Co' } });
        // ...and the event that describes it, in the same transaction...
        await emit('order.created', {
          orderRef: 'ORD-BULK-2026-0002',
          customerRef: 'CUS-CD-000001',
          agentId: 'AGT-GOM-0021',
          totalMinor: minor(2000),
          tier: 'new',
        });
        // ...then the unit of work fails. Both must vanish together.
        throw boom;
      }),
    ).rejects.toThrow(boom);

    // The state change rolled back...
    expect(await prisma.organisation.count()).toBe(0);
    // ...and critically, NO event was written, so the worker can never publish it.
    expect(await prisma.outboxEvent.count()).toBe(0);
  });
});
