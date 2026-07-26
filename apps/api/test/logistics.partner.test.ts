import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import { MASK } from '@uza/contracts';
import { prisma, resetDb } from './db';
import { resetLogisticsDb } from './logistics-db';
import { containers, freight, partnerPortal, loadableLot, vm, partner, M } from './logistics-fixtures';

beforeEach(async () => {
  await resetDb();
  await resetLogisticsDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

const bookShipment = async () => {
  const { refs } = await loadableLot({ destination: 'KIGALI', packages: [{ kg: 3000, cbm: 1.0 }] });
  const { shipment } = await containers.createShipment(vm, {
    packageRefs: refs, container: 'MSKU-1', carrier: 'Maersk', etd: '2026-08-01', eta: '2026-09-15', partnerId: 'IMARI',
  });
  await freight.recordBilledWeight(vm, shipment.ref, 3.0, M(3000));
  return { shipment, refs };
};

// Imari partner portal (constitution rule 12): assigned shipments only, weight/CBM yes,
// cost never. Enforced with authorize() + inScope + maskFields, not by omitting DTO fields.
describe('Imari partner portal — scope in, cost masked', () => {
  it('a partner sees weight/CBM on its assigned shipment but freight cost is masked', async () => {
    const { shipment, refs } = await bookShipment();
    const imari = partner([shipment.ref]);

    const s = (await partnerPortal.readShipment(imari, shipment.ref)) as Record<string, unknown>;
    expect(s.freightPaidMinor).toBe(MASK);
    expect(s.billedRevenueTon).toBe(MASK);
    expect(s.measuredRevenueTon).toBe(MASK);
    expect(s.container).toBe('MSKU-1'); // logistics detail is visible

    const pkgs = (await partnerPortal.readPackages(imari, shipment.ref)) as Record<string, unknown>[];
    expect(pkgs).toHaveLength(refs.length);
    expect(pkgs[0]!.kg).toBe(3000); // weight visible
    expect(pkgs[0]!.cbm).toBe(1.0); // CBM visible
  });

  it('a partner cannot read a shipment outside its scope (ACCESS_DENIED_SCOPE, audited)', async () => {
    const { shipment } = await bookShipment();
    const outsider = partner(['SHP-2026-9999']); // assigned to a different shipment

    await expect(partnerPortal.readShipment(outsider, shipment.ref)).rejects.toMatchObject({
      code: 'ACCESS_DENIED_SCOPE',
    });
    const denials = await prisma.auditLog.findMany({ where: { decision: 'deny', actorRole: 'logistics_partner' } });
    expect(denials.length).toBeGreaterThan(0);
  });

  it('an internal role reading the same shipment sees the freight cost (not masked)', async () => {
    const { shipment } = await bookShipment();
    const s = (await partnerPortal.readShipment(vm, shipment.ref)) as Record<string, unknown>;
    // china_warehouse is not a logistics_partner → the local freight-cost mask does not apply.
    expect(s.freightPaidMinor).toBe(300000);
  });
});
