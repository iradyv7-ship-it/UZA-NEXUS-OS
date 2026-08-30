import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import { prisma, resetDb } from './db';
import { resetLogisticsDb } from './logistics-db';
import { containers, tracking, loadableLot, vm } from './logistics-fixtures';

beforeEach(async () => {
  await resetDb();
  await resetLogisticsDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

const bookShipment = async () => {
  const { refs } = await loadableLot({ destination: 'KIGALI' });
  const { shipment } = await containers.createShipment(vm, {
    packageRefs: refs,
    container: 'MSKU-1',
    carrier: 'Maersk',
    etd: '2026-08-01',
    eta: '2026-09-15',
    partnerId: 'IMARI',
  });
  return shipment;
};

// CF-022 — tracking events declare provenance; an estimate is never presented as confirmed.
describe('CF-022 — tracking events separate confirmed from estimated', () => {
  it('tags carrier/partner/uza as confirmed and estimated as not', async () => {
    const s = await bookShipment();
    const confirmed = await tracking.track(vm, s.ref, 'vessel departed', 'carrier');
    const guessed = await tracking.track(vm, s.ref, 'expected arrival', 'estimated');

    expect(confirmed.source).toBe('carrier');
    expect(confirmed.confirmed).toBe(true);
    expect(guessed.source).toBe('estimated');
    expect(guessed.confirmed).toBe(false);

    const timeline = await tracking.timeline(vm, s.ref);
    const est = timeline.find((e) => e.source === 'estimated')!;
    expect(est.confirmed).toBe(false); // a customer read can never show this as fact
    const car = timeline.find((e) => e.source === 'carrier')!;
    expect(car.confirmed).toBe(true);
  });
});

// CF-023 — a delay notifies FIVE distinct parties, each a role-appropriate message.
describe('CF-023 — delay fans out to five distinct parties', () => {
  it('notifies client, agent, owner, front office and partner, and publishes shipment.delayed', async () => {
    const s = await bookShipment();
    const out = await tracking.delayShipment(vm, s.ref, '2026-10-01', 'typhoon at origin port', {
      agentId: 'AGT-GOM-0021',
      ownerId: 'VM-1',
      frontOfficeId: 'FO-1',
    });

    const audiences = new Set(out.notified);
    expect(audiences).toEqual(
      new Set(['customer', 'agent', 'project_owner', 'front_office', 'logistics_partner']),
    );

    const notes = await prisma.notification.findMany({ where: { subjectRef: s.ref } });
    expect(notes).toHaveLength(5);
    // Five DISTINCT audiences...
    expect(new Set(notes.map((n) => n.audience)).size).toBe(5);
    // ...each a DISTINCT, role-appropriate message (no copy-paste single body).
    expect(new Set(notes.map((n) => n.body)).size).toBe(5);

    const updated = await prisma.shipment.findUniqueOrThrow({ where: { ref: s.ref } });
    expect(updated.status).toBe('delayed');
    expect(updated.eta).toBe('2026-10-01');

    const events = await prisma.outboxEvent.findMany({ where: { name: 'shipment.delayed' } });
    expect(events).toHaveLength(1);
    const payload = events[0]!.payload as Record<string, unknown>;
    expect(payload.oldEta).toBe('2026-09-15');
    expect(payload.newEta).toBe('2026-10-01');
  });
});
