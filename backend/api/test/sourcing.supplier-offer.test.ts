import { randomUUID } from 'node:crypto';
import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import { prisma, resetDb } from './db';
import { resetSourcingQualityDb } from './sourcing-quality-db';
import {
  suppliers,
  offers,
  cecilia,
  agent,
  francois,
  UNIT_COST,
  acceptedOffer,
} from './sourcing-quality-fixtures';

beforeEach(async () => {
  await resetDb();
  await resetSourcingQualityDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe('sourcing — supplier self-service channel (staff-relayed)', () => {
  it('submits a proactive offer with no RFQ behind it, and derives inlandSeparable from basis', async () => {
    const supplier = await suppliers.register(cecilia, {
      nameEn: 'Ningbo EV Traders',
      nameZh: '宁波电动车贸易',
    });

    const fob = await offers.submit(cecilia, {
      supplierRef: supplier.ref,
      unitCostMinor: UNIT_COST,
      qty: 3,
      moq: 1,
      leadTimeDays: 10,
      unitCbm: 2.0,
      unitKg: 180,
      basis: 'FOB',
      supplierContact: 'WeChat: ningbo_ev_li',
    });

    expect(fob.ref).toMatch(/^OFF-CN-\d{4}-\d{4}$/);
    expect(fob.basis).toBe('FOB');
    expect(fob.inlandSeparable).toBe(false);
    expect(fob.channel).toBe('staff_relay');
    expect(fob.relayedBy).toBe(cecilia.userId);
    expect(fob.status).toBe('submitted');
  });

  it('attaches images, an inspection report and a battery-health certificate, bound to the offer', async () => {
    const { offer } = await acceptedOffer();
    // acceptedOffer already accepted it; attach evidence anyway (order doesn't matter for storage).
    const image = await offers.addAttachment(cecilia, offer.ref, {
      kind: 'image',
      uri: 's3://offers/off-1/photo1.jpg',
    });
    const report = await offers.addAttachment(cecilia, offer.ref, {
      kind: 'inspection_report',
      uri: 's3://offers/off-1/report.pdf',
    });
    const battery = await offers.addAttachment(cecilia, offer.ref, {
      kind: 'battery_health_certificate',
      uri: 's3://offers/off-1/battery.pdf',
      note: 'SOH 92%',
    });

    expect(image.offerRef).toBe(offer.ref);
    expect(report.kind).toBe('inspection_report');
    expect(battery.kind).toBe('battery_health_certificate');

    const read = await offers.read(cecilia, offer.ref);
    expect(read.attachments).toHaveLength(3);
    expect(new Set(read.attachments.map((a) => a.kind))).toEqual(
      new Set(['image', 'inspection_report', 'battery_health_certificate']),
    );
  });

  it('accept/decline is a status transition, idempotent on replay, refused once already decided', async () => {
    const supplier = await suppliers.register(cecilia, {
      nameEn: 'Ningbo EV Traders',
      nameZh: '宁波电动车贸易',
    });
    const offer = await offers.submit(cecilia, {
      supplierRef: supplier.ref,
      unitCostMinor: UNIT_COST,
      qty: 2,
      moq: 1,
      leadTimeDays: 10,
      unitCbm: 2.0,
      unitKg: 180,
    });

    const accepted = await offers.accept(cecilia, offer.ref, 'CEC-1');
    expect(accepted.status).toBe('accepted');

    // Idempotent replay: accepting an already-accepted offer is a no-op, not an error.
    const again = await offers.accept(cecilia, offer.ref, 'CEC-1');
    expect(again.status).toBe('accepted');

    // Cannot decline something already accepted.
    await expect(offers.decline(cecilia, offer.ref, 'CEC-1')).rejects.toThrow();
  });

  it('offline replay: the same clientRequestId returns the existing offer and creates no duplicate', async () => {
    const supplier = await suppliers.register(cecilia, {
      nameEn: 'Ningbo EV Traders',
      nameZh: '宁波电动车贸易',
    });
    const key = randomUUID();
    const first = await offers.submit(cecilia, {
      supplierRef: supplier.ref,
      unitCostMinor: UNIT_COST,
      qty: 2,
      moq: 1,
      leadTimeDays: 10,
      unitCbm: 2.0,
      unitKg: 180,
      clientRequestId: key,
    });
    const second = await offers.submit(cecilia, {
      supplierRef: supplier.ref,
      unitCostMinor: UNIT_COST,
      qty: 2,
      moq: 1,
      leadTimeDays: 10,
      unitCbm: 2.0,
      unitKg: 180,
      clientRequestId: key,
    });
    expect(second.ref).toBe(first.ref);
    const rows = await prisma.supplierOffer.findMany({ where: { clientRequestId: key } });
    expect(rows).toHaveLength(1);
  });

  it('denies a role without supplierQuote:read from reading an offer at all (audited)', async () => {
    // Every role that may read a supplier offer (china_sourcing, ceo) is also cleared to see
    // the cost, so a sales agent is refused outright rather than shown a masked record —
    // authorisation happens at the service layer before any field masking.
    const { offer } = await acceptedOffer();
    await expect(offers.read(agent, offer.ref)).rejects.toThrow();
    const deny = await prisma.auditLog.findFirst({
      where: { actorId: agent.userId, resource: 'supplierQuote', decision: 'deny' },
    });
    expect(deny).not.toBeNull();
  });

  it('denies a role without supplierQuote:create from submitting an offer (audited)', async () => {
    const supplier = await suppliers.register(cecilia, {
      nameEn: 'Ningbo EV Traders',
      nameZh: '宁波电动车贸易',
    });
    await expect(
      offers.submit(francois, {
        supplierRef: supplier.ref,
        unitCostMinor: UNIT_COST,
        qty: 1,
        moq: 1,
        leadTimeDays: 10,
        unitCbm: 1,
        unitKg: 100,
      }),
    ).rejects.toThrow();
    const deny = await prisma.auditLog.findFirst({
      where: { actorId: francois.userId, resource: 'supplierQuote', decision: 'deny' },
    });
    expect(deny).not.toBeNull();
  });
});
