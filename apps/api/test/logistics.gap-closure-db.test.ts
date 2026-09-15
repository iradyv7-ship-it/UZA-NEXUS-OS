import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import { prisma, resetDb } from './db';
import { resetLogisticsDb } from './logistics-db';
import {
  containers,
  release,
  shipmentDetails,
  consignees,
  partnerRates,
  loadableLot,
  receiveLot,
  vm,
  agent,
  warehouse,
} from './logistics-fixtures';

/**
 * DB-backed tests for the 2026-09-14 gap-closure audit: shipment vessel/voyage/entry-port/
 * planned-vs-actual dates (item 1), Consignee (item 2), LOOSE cargo (item 3), venture tagging
 * (item 4), the container-confirmed notification fan-out (item 6), and the append-only
 * PartnerRateCard log (item 7). Same fixtures/pattern as the rest of this module's suite —
 * requires the same reachable Postgres `resetDb()`/`resetLogisticsDb()` already need.
 */
beforeEach(async () => {
  await resetDb();
  await resetLogisticsDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

const book = (refs: string[], extra: Partial<Parameters<typeof containers.createShipment>[1]> = {}) =>
  containers.createShipment(vm, {
    packageRefs: refs,
    container: 'MSKU-1234567',
    carrier: 'Maersk',
    etdPlanned: '2026-08-01',
    etaPlanned: '2026-09-15',
    partnerId: 'IMARI',
    ...extra,
  });

describe('item 1 — vessel/voyage/entry-port, planned-vs-actual etd/eta', () => {
  it('books with planned dates + venture + entry port, and derived timing reflects the plan', async () => {
    const { refs } = await loadableLot({ destination: 'KIGALI' });
    const { shipment } = await book(refs, {
      vesselName: 'MV Ever Given',
      voyageNumber: '123W',
      entryPort: 'MOMBASA',
      ventureCode: 'BULK',
    });
    expect(shipment.vesselName).toBe('MV Ever Given');
    expect(shipment.voyageNumber).toBe('123W');
    expect(shipment.entryPort).toBe('MOMBASA');
    expect(shipment.ventureCode).toBe('BULK');
    expect(shipment.etdPlanned).toBe('2026-08-01');
    expect(shipment.etaPlanned).toBe('2026-09-15');
    expect(shipment.etdActual).toBeNull();
    expect(shipment.etaActual).toBeNull();
  });

  it('recording an actual date writes ONLY the actual column, never the planned one', async () => {
    const { refs } = await loadableLot({ destination: 'KIGALI' });
    const { shipment } = await book(refs);

    const updated = await shipmentDetails.updateDetails(vm, shipment.ref, {
      etdActual: '2026-08-03',
    });
    expect(updated.etdActual).toBe('2026-08-03');
    expect(updated.etdPlanned).toBe('2026-08-01'); // untouched

    const { timing } = await shipmentDetails.readWithTiming(vm, shipment.ref);
    expect(timing.departureDate).toBe('2026-08-03'); // prefers the actual
    expect(timing.departureConfirmed).toBe(true);
  });

  it('correcting the container number re-fires the confirmation notification', async () => {
    const { refs } = await loadableLot({ destination: 'KIGALI' });
    const { shipment } = await book(refs);
    await prisma.notification.deleteMany({}); // clear the booking-time fan-out

    await shipmentDetails.updateDetails(vm, shipment.ref, { container: 'MSKU-9999999' });

    const notes = await prisma.notification.findMany({ where: { subjectRef: shipment.ref } });
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.some((n) => n.body.includes('MSKU-9999999'))).toBe(true);
  });
});

describe('item 6 — container-confirmed notification fan-out on booking', () => {
  it('notifies the client (customer audience) and customer care (front_office) on booking', async () => {
    const { refs } = await loadableLot({ destination: 'KIGALI' });
    const { shipment } = await book(refs, { ventureCode: 'BULK', vesselName: 'MV Ever Given' });

    const notes = await prisma.notification.findMany({ where: { subjectRef: shipment.ref } });
    const audiences = new Set(notes.map((n) => n.audience));
    expect(audiences.has('customer')).toBe(true);
    expect(audiences.has('front_office')).toBe(true);

    const customerNote = notes.find((n) => n.audience === 'customer')!;
    expect(customerNote.body).toContain('Great news');
    expect(customerNote.body).not.toBe(notes.find((n) => n.audience === 'front_office')!.body);
  });
});

describe('item 3 — LOOSE cargo sellable line', () => {
  it('requires a positive pricePerCbmMinor before a package can be LOOSE', async () => {
    const { packages } = await receiveLot();
    await expect(
      release.setCargoDetails(warehouse, packages[0]!.ref, { cargoType: 'LOOSE' }),
    ).rejects.toThrow();
  });

  it('computes the sellable line total from pricePerCbmMinor * measured cbm', async () => {
    const { packages } = await receiveLot({ packages: [{ kg: 500, cbm: 2.0 }] });
    const updated = await release.setCargoDetails(warehouse, packages[0]!.ref, {
      cargoType: 'LOOSE',
      pricePerCbmMinor: 150000,
      goodsDescription: 'Household effects',
      photoUrl: 'https://example.com/photo.jpg',
    });
    expect(updated.cargoType).toBe('LOOSE');
    expect(updated.looseCargoPriceMinor).toBe(300000); // 150000 * 2.0
    expect(updated.goodsDescription).toBe('Household effects');
  });

  it('CONSOLIDATED packages never carry a loose-cargo price', async () => {
    const { packages } = await receiveLot();
    const updated = await release.setCargoDetails(warehouse, packages[0]!.ref, {
      goodsDescription: 'Assorted hardware',
    });
    expect(updated.cargoType).toBe('CONSOLIDATED');
    expect(updated.looseCargoPriceMinor).toBeNull();
  });
});

describe('release.listLoadable — feeds the ops-workspace booking form', () => {
  it('lists only QC-released, hold-free, destinated, not-yet-shipped packages', async () => {
    const { refs } = await loadableLot({ destination: 'GOMA' });
    const loadable = await release.listLoadable(vm);
    expect(loadable.map((p) => p.ref).sort()).toEqual([...refs].sort());
  });

  it('excludes a package once it is booked onto a shipment', async () => {
    const { refs } = await loadableLot({ destination: 'GOMA' });
    await book(refs);
    const loadable = await release.listLoadable(vm);
    expect(loadable).toHaveLength(0);
  });
});

describe('item 2 — Consignee', () => {
  it('creates a consignee and attaches it as the shipment default receiving party', async () => {
    const { refs } = await loadableLot({ destination: 'KIGALI' });
    const { shipment } = await book(refs);

    const consignee = await consignees.create(vm, {
      name: 'Jean Uwimana',
      phone: '+250700000000',
      address: 'KG 7 Ave, Kigali',
      tinNumber: 'TIN-123',
    });
    expect(consignee.ref).toMatch(/^CNE-/);

    const updated = await consignees.attachToShipment(vm, shipment.ref, consignee.ref);
    expect(updated.consigneeRef).toBe(consignee.ref);
  });

  it('rejects a consignee missing required fields', async () => {
    await expect(
      consignees.create(vm, { name: '', phone: '', address: '' }),
    ).rejects.toThrow();
  });

  it('attaching an unknown consignee ref 404s rather than silently linking nothing', async () => {
    const { refs } = await loadableLot({ destination: 'KIGALI' });
    const { shipment } = await book(refs);
    await expect(
      consignees.attachToShipment(vm, shipment.ref, 'CNE-99999'),
    ).rejects.toThrow();
  });
});

describe('item 7 — append-only PartnerRateCard', () => {
  it('appends a new row per call and never overwrites the previous one', async () => {
    await partnerRates.recordWeeklyRate(vm, {
      partnerId: 'IMARI',
      destination: 'KIGALI',
      ratePerRevenueTonMinor: 5000000,
      note: 'week 1',
    });
    await partnerRates.recordWeeklyRate(vm, {
      partnerId: 'IMARI',
      destination: 'KIGALI',
      ratePerRevenueTonMinor: 5200000,
      note: 'week 2',
    });

    const history = await partnerRates.history(vm, 'IMARI');
    expect(history).toHaveLength(2); // both rows kept — append-only, nothing overwritten
    expect(new Set(history.map((h) => h.ratePerRevenueTonMinor))).toEqual(
      new Set([5000000, 5200000]),
    );

    const current = await partnerRates.currentRate(vm, 'IMARI', 'KIGALI');
    expect(current!.ratePerRevenueTonMinor).toBe(5200000); // the most recent
  });

  it('rejects a non-positive rate', async () => {
    await expect(
      partnerRates.recordWeeklyRate(vm, {
        partnerId: 'IMARI',
        destination: 'KIGALI',
        ratePerRevenueTonMinor: 0,
      }),
    ).rejects.toThrow();
  });
});

describe('authorisation — the new pieces are enforced at the service layer, not the route', () => {
  it('a sales agent cannot record a partner rate', async () => {
    await expect(
      partnerRates.recordWeeklyRate(agent, {
        partnerId: 'IMARI',
        destination: 'KIGALI',
        ratePerRevenueTonMinor: 100,
      }),
    ).rejects.toMatchObject({ code: 'ACCESS_DENIED_ROLE' });
  });
});
