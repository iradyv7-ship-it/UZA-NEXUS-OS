import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import { prisma, resetDb } from './db';
import { resetLogisticsDb } from './logistics-db';
import {
  containers,
  deliveries,
  orderPayments,
  loadableLot,
  vm,
  ceo,
  paymentVerified,
  ORDER_REF,
} from './logistics-fixtures';

beforeEach(async () => {
  await resetDb();
  await resetLogisticsDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

const bookShipment = async () => {
  const { refs } = await loadableLot({ orderRef: ORDER_REF, destination: 'KIGALI' });
  const { shipment } = await containers.createShipment(vm, {
    packageRefs: refs,
    container: 'MSKU-1',
    carrier: 'Maersk',
    etd: '2026-08-01',
    eta: '2026-09-15',
    partnerId: 'IMARI',
  });
  return { shipment, refs };
};

// CF-028 — goods release requires FULL payment. Not arrival, RELEASE.
describe('CF-028 — delivery is gated on full payment', () => {
  it('blocks delivery while a balance is outstanding (GATE_BALANCE_OUTSTANDING)', async () => {
    // loadableLot pays confirmation + pre_loading (fraction 1.0 for a 'new' 50/50 order),
    // so first regress the projection to a partly-paid order to prove the gate.
    const { shipment, refs } = await bookShipment();
    await prisma.orderPaymentState.update({
      where: { orderRef: ORDER_REF },
      data: { paidFraction: 0.5 }, // pre-loading paid but not the full balance
    });

    await expect(
      deliveries.deliver(ceo, { shipmentRef: shipment.ref, packageRefs: refs, podRef: 'POD-1' }),
    ).rejects.toMatchObject({ code: 'GATE_BALANCE_OUTSTANDING' });
    expect(await prisma.delivery.count()).toBe(0);
  });

  it('delivers with proof once fully paid, marks packages delivered, emits delivery.completed', async () => {
    const { shipment, refs } = await bookShipment();
    // Full payment reached (fraction 1.0 from loadableLot). Deliver.
    const delivery = await deliveries.deliver(ceo, {
      shipmentRef: shipment.ref,
      packageRefs: refs,
      podRef: 'POD-1',
      office: 'GOM',
    });
    expect(delivery.status).toBe('delivered');
    expect(delivery.podRef).toBe('POD-1');

    const pkgs = await prisma.package.findMany({ where: { ref: { in: refs } } });
    expect(pkgs.every((p) => p.delivered)).toBe(true);

    const shipped = await prisma.shipment.findUniqueOrThrow({ where: { ref: shipment.ref } });
    expect(shipped.status).toBe('delivered');

    const events = await prisma.outboxEvent.findMany({ where: { name: 'delivery.completed' } });
    expect(events).toHaveLength(1);
    const payload = events[0]!.payload as Record<string, unknown>;
    expect(payload.orderRef).toBe(ORDER_REF);
    expect(payload.shipmentRef).toBe(shipment.ref);
  });

  it('an established-tier order needs all three installments before release', async () => {
    const { shipment, refs } = await bookShipment();
    // Regress then pay only up to pre_loading (0.7 of a 30/40/30 schedule): still short.
    await prisma.orderPaymentState.update({
      where: { orderRef: ORDER_REF },
      data: { paidFraction: 0.7 },
    });
    await expect(
      deliveries.deliver(ceo, { shipmentRef: shipment.ref, packageRefs: refs, podRef: 'POD-1' }),
    ).rejects.toMatchObject({ code: 'GATE_BALANCE_OUTSTANDING' });

    // pre_release settles the balance to 1.0 → release proceeds
    await orderPayments.handlePaymentVerified(
      paymentVerified({ orderRef: ORDER_REF, trigger: 'pre_release', paidFraction: 1.0 }),
    );
    await expect(
      deliveries.deliver(ceo, { shipmentRef: shipment.ref, packageRefs: refs, podRef: 'POD-2' }),
    ).resolves.toBeDefined();
  });
});
