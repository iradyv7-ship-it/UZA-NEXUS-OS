import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import IORedis from 'ioredis';
import type { EventEnvelope, Minor, UzaEventName } from '@uza/contracts';
import { prisma, resetDb } from './db';
import { resetTradeDb } from './trade-db';
import { resetFinanceDb } from './finance-db';
import { resetSourcingQualityDb } from './sourcing-quality-db';
import { resetLogisticsDb } from './logistics-db';
import { drainOutbox, type OutboxHandler } from '../src/platform/outbox/outbox-processor';
import { EVENT_JOB_OPTS } from '../src/platform/outbox/event-bus.constants';
import {
  buildDispatchMap,
  dispatchEnvelope,
  EventDispatchError,
} from '../src/integration/dispatch-map';

// Real consumer + publisher service instances (same PrismaClient as ./db), exactly as the
// other suites wire them. The dispatch map is built from THESE instances, so the test
// drives the same registry the running app builds — not a synthetic stand-in.
import { orders, approvedChain, vm } from './trade-fixtures';
import {
  invoices,
  commissions,
  claims,
  payments,
  // front_office records the payment now that 'customer' isn't a Nexus login role — see
  // packages/contracts/src/permissions.ts.
  frontOffice as payer,
  finance,
} from './finance-fixtures';
import { scores, suppliedPo } from './sourcing-quality-fixtures';
import { orderPayments, qualityGate, receiving, warehouse } from './logistics-fixtures';

// One dispatch map from the real services — the object under test.
const dispatchMap = buildDispatchMap({
  order: orders,
  invoice: invoices,
  commission: commissions,
  claim: claims,
  supplierScore: scores,
  orderPayment: orderPayments,
  qualityGate,
});

// ---------------------------------------------------------------------------
// A real BullMQ transport per test: the worker publisher's enqueue + a consumer
// running the real dispatchEnvelope. A unique queue name isolates each test from
// any running app/worker process and from cross-run leftovers in Redis.
// ---------------------------------------------------------------------------
const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
let queueName: string;
let queue: Queue;
let worker: Worker;
let qConn: IORedis;
let wConn: IORedis;
let completed = 0;
let failed = 0;

async function resetAll(): Promise<void> {
  await resetDb();
  await resetTradeDb();
  await resetFinanceDb();
  await resetSourcingQualityDb();
  await resetLogisticsDb();
}

beforeEach(async () => {
  await resetAll();
  completed = 0;
  failed = 0;
  queueName = `uza.events.itest.${randomUUID()}`;
  qConn = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  wConn = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  queue = new Queue(queueName, { connection: qConn as unknown as ConnectionOptions });

  // The consumer: exactly what apps/api's EventConsumerService does — deliver each job's
  // envelope through the real fan-out. Letting dispatch throw fails the job (retry policy).
  worker = new Worker(
    queueName,
    async (job) => {
      await dispatchEnvelope(dispatchMap, job.data as EventEnvelope);
    },
    { connection: wConn as unknown as ConnectionOptions },
  );
  worker.on('completed', () => {
    completed += 1;
  });
  worker.on('failed', () => {
    failed += 1;
  });
  await worker.waitUntilReady();
});

afterEach(async () => {
  await worker.close();
  await queue.obliterate({ force: true }).catch(() => undefined);
  await queue.close();
  await qConn.quit();
  await wConn.quit();
});

// The real publisher half: drain committed outbox rows and enqueue each to the queue with
// the same job options the worker publisher uses (jobId = eventId, attempts, backoff).
async function publishPending(): Promise<number> {
  const enqueue: OutboxHandler = async (envelope: EventEnvelope) => {
    await queue.add(envelope.name, envelope, { ...EVENT_JOB_OPTS, jobId: envelope.eventId });
  };
  return drainOutbox(prisma, 'outbox-publisher', enqueue);
}

async function waitFor(predicate: () => Promise<boolean>, timeoutMs = 20_000): Promise<void> {
  const start = Date.now();
  for (;;) {
    if (await predicate()) return;
    if (Date.now() - start > timeoutMs) throw new Error('waitFor: condition not met in time');
    await new Promise((r) => setTimeout(r, 100));
  }
}

/** Reconstruct the delivered envelope for an event from its committed outbox row. */
async function envelopeOf(name: UzaEventName): Promise<EventEnvelope> {
  const row = await prisma.outboxEvent.findFirstOrThrow({ where: { name } });
  return {
    eventId: row.eventId,
    name: row.name as UzaEventName,
    actorId: row.actorId,
    occurredAt: row.occurredAt.toISOString(),
    payload: row.payload as EventEnvelope['payload'],
  };
}

describe('worker fan-out — events reach consumer modules through the real bus', () => {
  it('order.created → finance invoice; payment.verified → trade activation + finance accrual + logistics projection', async () => {
    // --- arrange: a real approved quotation + confirmed order (emits order.created) ------
    const { quotation } = await approvedChain({ qty: 100, completedOrders: 0 });
    const order = await orders.create(vm, quotation.ref);
    expect(order.status).toBe('awaiting_payment');

    // --- STEP 1: publish order.created; assert a finance Invoice appears via fan-out -----
    await publishPending();
    await waitFor(
      async () => (await prisma.invoice.count({ where: { orderRef: order.ref } })) === 1,
    );

    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { orderRef: order.ref } });
    expect(invoice.agentId).toBe(order.agentId); // agent carried through the event, not read from trade
    const conf = await prisma.invoiceInstallment.findFirstOrThrow({
      where: { invoiceRef: invoice.ref, trigger: 'confirmation' },
    });

    // --- STEP 2: finance verifies the confirmation payment (writes accrual inline, emits
    //             payment.verified). Publish it; assert trade + logistics react via fan-out.
    const proof = await payments.uploadProof(payer, {
      invoiceRef: invoice.ref,
      targetTrigger: 'confirmation',
      amountMinor: conf.amountMinor as Minor,
      proofRef: 'PROOF-CONF',
    });
    const verify = await payments.verify(finance, proof.ref);
    expect(verify.trigger).toBe('confirmation');
    // The accrual is a PUBLISH-side effect of verify(), committed with the event.
    expect(
      await prisma.commissionEntry.count({ where: { orderRef: order.ref, type: 'accrual' } }),
    ).toBe(1);

    await publishPending();

    // trade consumer: the order flips to procurement_active (payment gates procurement).
    await waitFor(async () => {
      const o = await prisma.order.findUnique({ where: { ref: order.ref } });
      return o?.status === 'procurement_active';
    });
    // logistics consumer: the payment projection records the confirmation trigger.
    await waitFor(async () => {
      const s = await prisma.orderPaymentState.findUnique({ where: { orderRef: order.ref } });
      return !!s && s.paidTriggers.includes('confirmation');
    });

    const finalOrder = await prisma.order.findUniqueOrThrow({ where: { ref: order.ref } });
    expect(finalOrder.status).toBe('procurement_active');
    const projection = await prisma.orderPaymentState.findUniqueOrThrow({
      where: { orderRef: order.ref },
    });
    expect(projection.paidTriggers).toContain('confirmation');
    // Both fan-out consumers recorded their own idempotency rows under their own keys.
    expect(
      await prisma.processedEvent.count({
        where: { consumer: { in: ['trade.payment-verified', 'logistics.payment-verified'] } },
      }),
    ).toBe(2);
  });

  it('warehouse.receiptRecorded → sourcing supplier score moves, and a redelivery does NOT move it twice', async () => {
    // --- arrange: a real sourced PO, then a warehouse receipt with a real variance -------
    const { supplier, po } = await suppliedPo();
    const before = (await prisma.supplier.findUniqueOrThrow({ where: { ref: supplier.ref } }))
      .score;

    // variance 0.08 (> CBM_TOLERANCE 0.05, < CBM_HARD_STOP 0.10) → a scored discrepancy.
    await receiving.receivePackages(warehouse, {
      orderRef: 'ORD-BULK-2026-0001',
      customerRef: 'CUS-CD-000001',
      poRef: po.ref,
      declaredCbm: 5.0,
      declaredKg: 1200,
      packages: [
        { kg: 600, cbm: 2.7 },
        { kg: 600, cbm: 2.7 },
      ], // measured 5.4 → +8% variance
    });

    // --- STEP 3: publish; assert the supplier score dropped via fan-out -----------------
    await publishPending();
    await waitFor(
      async () =>
        (await prisma.supplier.findUniqueOrThrow({ where: { ref: supplier.ref } })).score < before,
    );

    const after = (await prisma.supplier.findUniqueOrThrow({ where: { ref: supplier.ref } })).score;
    expect(after).toBeLessThan(before);
    const scoreEventsAfterFirst = await prisma.supplierScoreEvent.count({
      where: { supplierRef: supplier.ref },
    });
    expect(scoreEventsAfterFirst).toBe(1);

    // --- STEP 4: re-publish the SAME event (same eventId); assert it does NOT apply twice.
    const receipt = await envelopeOf('warehouse.receiptRecorded');
    const completedBefore = completed;
    await queue.add(receipt.name, receipt, { ...EVENT_JOB_OPTS, jobId: receipt.eventId });
    await waitFor(async () => completed > completedBefore); // the redelivered job ran to completion

    const afterRedelivery = (
      await prisma.supplier.findUniqueOrThrow({ where: { ref: supplier.ref } })
    ).score;
    expect(afterRedelivery).toBe(after); // score unchanged — the handler self-guarded
    expect(await prisma.supplierScoreEvent.count({ where: { supplierRef: supplier.ref } })).toBe(1);
    expect(failed).toBe(0);
  });

  it('failure policy: a throwing handler surfaces as a retryable EventDispatchError; sibling handlers still ran', async () => {
    // payment.verified fans out to trade AND logistics. Make the trade handler throw
    // (no such order) while logistics succeeds. dispatchEnvelope must run both, then throw
    // an EventDispatchError so the BullMQ job is retried — never silently swallowed.
    const envelope: EventEnvelope<'payment.verified'> = {
      eventId: randomUUID(),
      name: 'payment.verified',
      actorId: 'FIN-1',
      occurredAt: new Date().toISOString(),
      payload: {
        paymentRef: 'PAY-X',
        orderRef: 'ORD-DOES-NOT-EXIST',
        trigger: 'confirmation',
        paidFraction: 0.5,
      },
    };

    await expect(dispatchEnvelope(dispatchMap, envelope)).rejects.toBeInstanceOf(
      EventDispatchError,
    );

    // The logistics sibling still recorded its projection (independent, idempotent).
    const projection = await prisma.orderPaymentState.findUnique({
      where: { orderRef: 'ORD-DOES-NOT-EXIST' },
    });
    expect(projection?.paidTriggers).toContain('confirmation');
    // Trade recorded no processed-event row (its transaction rolled back on the throw), so a
    // retry will re-run only the trade handler.
    expect(
      await prisma.processedEvent.count({
        where: { eventId: envelope.eventId, consumer: 'trade.payment-verified' },
      }),
    ).toBe(0);
    expect(
      await prisma.processedEvent.count({
        where: { eventId: envelope.eventId, consumer: 'logistics.payment-verified' },
      }),
    ).toBe(1);
  });
});
