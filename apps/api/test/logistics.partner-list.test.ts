import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import { MASK, inScope, type Actor } from '@uza/contracts';
import { prisma, resetDb } from './db';
import { resetLogisticsDb } from './logistics-db';
import {
  containers,
  freight,
  partnerPortal,
  loadableLot,
  vm,
  partner,
  M,
} from './logistics-fixtures';

beforeEach(async () => {
  await resetDb();
  await resetLogisticsDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

// Book a shipment on a distinct order/PO so two shipments never collide on refs.
const bookShipment = async (opts: { orderRef: string; poRef: string; container: string }) => {
  const { refs } = await loadableLot({
    orderRef: opts.orderRef,
    poRef: opts.poRef,
    destination: 'KIGALI',
    packages: [{ kg: 3000, cbm: 1.0 }],
  });
  const { shipment } = await containers.createShipment(vm, {
    packageRefs: refs,
    container: opts.container,
    carrier: 'Maersk',
    etd: '2026-08-01',
    eta: '2026-09-15',
    partnerId: 'IMARI',
  });
  await freight.recordBilledWeight(vm, shipment.ref, 3.0, M(3000));
  return { shipment, refs };
};

// The partner shipments LIST (constitution rule 12): assigned shipments only, cost masked.
// Enforced with authorize() + shipmentScopeWhere (a mirror of inScope) + maskFields.
describe('partner shipments list — scope in, cost masked', () => {
  it('lists ONLY the caller’s in-scope shipments, never one outside scope', async () => {
    const a = await bookShipment({
      orderRef: 'ORD-BULK-2026-0001',
      poRef: 'PO-CN-2026-0001',
      container: 'MSKU-A',
    });
    const b = await bookShipment({
      orderRef: 'ORD-BULK-2026-0002',
      poRef: 'PO-CN-2026-0002',
      container: 'MSKU-B',
    });

    // Imari is assigned only to shipment A.
    const imari = partner([a.shipment.ref]);
    const rows = (await partnerPortal.listShipments(imari, { limit: 20, offset: 0 })) as Record<
      string,
      unknown
    >[];

    const refs = rows.map((r) => r.ref);
    expect(refs).toContain(a.shipment.ref);
    expect(refs).not.toContain(b.shipment.ref);
  });

  it('masks freight cost on every listed shipment (freightPaid/billed/measured revenue ton → ***)', async () => {
    const a = await bookShipment({
      orderRef: 'ORD-BULK-2026-0001',
      poRef: 'PO-CN-2026-0001',
      container: 'MSKU-A',
    });
    const imari = partner([a.shipment.ref]);

    const rows = (await partnerPortal.listShipments(imari, { limit: 20, offset: 0 })) as Record<
      string,
      unknown
    >[];
    const row = rows.find((r) => r.ref === a.shipment.ref)!;

    expect(row.freightPaidMinor).toBe(MASK);
    expect(row.billedRevenueTon).toBe(MASK);
    expect(row.measuredRevenueTon).toBe(MASK);
    expect(row.container).toBe('MSKU-A'); // logistics detail stays visible
  });

  it('an internal role listing the same shipment sees the freight cost (not masked)', async () => {
    const a = await bookShipment({
      orderRef: 'ORD-BULK-2026-0001',
      poRef: 'PO-CN-2026-0001',
      container: 'MSKU-A',
    });
    const rows = (await partnerPortal.listShipments(vm, { limit: 20, offset: 0 })) as Record<
      string,
      unknown
    >[];
    const row = rows.find((r) => r.ref === a.shipment.ref)!;
    expect(row.freightPaidMinor).toBe(300000);
  });

  it('a partner with no assigned shipments lists nothing (empty scope ⇒ empty page)', async () => {
    await bookShipment({
      orderRef: 'ORD-BULK-2026-0001',
      poRef: 'PO-CN-2026-0001',
      container: 'MSKU-A',
    });
    const outsider = partner([]);
    const rows = await partnerPortal.listShipments(outsider, { limit: 20, offset: 0 });
    expect(rows).toHaveLength(0);
  });

  it('honours limit/offset with a stable updatedAt-desc sort', async () => {
    const a = await bookShipment({
      orderRef: 'ORD-BULK-2026-0001',
      poRef: 'PO-CN-2026-0001',
      container: 'MSKU-A',
    });
    const b = await bookShipment({
      orderRef: 'ORD-BULK-2026-0002',
      poRef: 'PO-CN-2026-0002',
      container: 'MSKU-B',
    });

    // Pin distinct updatedAt so the sort is deterministic (b newest).
    await prisma.$executeRawUnsafe(
      'UPDATE "Shipment" SET "updatedAt" = $1::timestamptz WHERE ref = $2',
      new Date(Date.UTC(2026, 0, 1, 0, 0)).toISOString(),
      a.shipment.ref,
    );
    await prisma.$executeRawUnsafe(
      'UPDATE "Shipment" SET "updatedAt" = $1::timestamptz WHERE ref = $2',
      new Date(Date.UTC(2026, 0, 1, 0, 1)).toISOString(),
      b.shipment.ref,
    );

    const imari = partner([a.shipment.ref, b.shipment.ref]);
    const page1 = (await partnerPortal.listShipments(imari, { limit: 1, offset: 0 })) as Record<
      string,
      unknown
    >[];
    const page2 = (await partnerPortal.listShipments(imari, { limit: 1, offset: 1 })) as Record<
      string,
      unknown
    >[];

    expect(page1).toHaveLength(1);
    expect(page1[0]!.ref).toBe(b.shipment.ref); // newest first
    expect(page2[0]!.ref).toBe(a.shipment.ref);
    expect(page2[0]!.ref).not.toBe(page1[0]!.ref); // pages do not overlap
  });
});

describe('partner shipments list agrees with inScope (the predicate is a mirror, not a re-implementation)', () => {
  it('every listed shipment passes inScope for the caller, and an out-of-scope ref is absent', async () => {
    const a = await bookShipment({
      orderRef: 'ORD-BULK-2026-0001',
      poRef: 'PO-CN-2026-0001',
      container: 'MSKU-A',
    });
    const b = await bookShipment({
      orderRef: 'ORD-BULK-2026-0002',
      poRef: 'PO-CN-2026-0002',
      container: 'MSKU-B',
    });

    const imari = partner([a.shipment.ref]);
    const rows = (await partnerPortal.listShipments(imari, { limit: 100, offset: 0 })) as Record<
      string,
      unknown
    >[];

    // 1. Soundness: nothing the by-ref read would deny appears in the list.
    for (const row of rows) {
      expect(inScope(imari, { kind: 'shipment', ref: row.ref as string })).toBe(true);
    }
    // 2. Completeness (for this fixture): the in-scope ref is present, the out-of-scope one absent.
    expect(rows.map((r) => r.ref)).toContain(a.shipment.ref);
    expect(rows.map((r) => r.ref)).not.toContain(b.shipment.ref);

    // 3. Cross-check against the canonical single-record rule directly.
    expect(inScope(imari, { kind: 'shipment', ref: b.shipment.ref })).toBe(false);
  });

  it('a role with no shipment:read grant is denied 403 before the predicate runs', async () => {
    // Rewritten 30 Aug 2026 — the previous version used a 'customer' actor (no longer a
    // Nexus login role) and, despite its own title, actually asserted the OPPOSITE of what
    // it claimed: 'customer' held shipment:read, so it hit the empty-scope path (an empty
    // list), never the 403 the title describes. sales_agent genuinely holds no shipment:read
    // grant at all, so this now actually tests what its title says.
    await bookShipment({
      orderRef: 'ORD-BULK-2026-0001',
      poRef: 'PO-CN-2026-0001',
      container: 'MSKU-A',
    });
    const agentActor: Actor = {
      userId: 'AGT-GOM-0021',
      role: 'sales_agent',
      office: 'GOM',
      scope: { customerIds: ['CUS-CD-000001'] },
    };
    await expect(
      partnerPortal.listShipments(agentActor, { limit: 20, offset: 0 }),
    ).rejects.toMatchObject({ code: 'ACCESS_DENIED_ROLE' });
  });
});
