import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import { prisma, resetDb } from './db';
import { resetLogisticsDb } from './logistics-db';
import {
  orderPayments,
  qualityGate,
  paymentVerified,
  inspectionRecorded,
  qualityFailed,
  ORDER_REF,
  PO_REF,
} from './logistics-fixtures';

beforeEach(async () => {
  await resetDb();
  await resetLogisticsDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});

// Consumers project upstream events into local state. Handlers are idempotent on eventId
// (a redelivery cannot corrupt the projection), mirroring finance's release-eligibility
// determination from events rather than reading finance's tables.
describe('order payment projection (payment.verified)', () => {
  it('records paid triggers and the cumulative fraction; is idempotent on eventId', async () => {
    const conf = paymentVerified({
      orderRef: ORDER_REF,
      trigger: 'confirmation',
      paidFraction: 0.5,
    });
    await orderPayments.handlePaymentVerified(conf);
    const dup = await orderPayments.handlePaymentVerified(conf); // same eventId
    expect(dup.status).toBe('duplicate');

    await orderPayments.handlePaymentVerified(
      paymentVerified({ orderRef: ORDER_REF, trigger: 'pre_loading', paidFraction: 1.0 }),
    );

    expect(await orderPayments.isPreLoadingPaid(ORDER_REF)).toBe(true);
    const elig = await orderPayments.releaseEligibility(ORDER_REF);
    expect(elig.fullyPaid).toBe(true);
    expect(elig.paidTriggers.sort()).toEqual(['confirmation', 'pre_loading']);

    const state = await prisma.orderPaymentState.findUniqueOrThrow({
      where: { orderRef: ORDER_REF },
    });
    expect(state.paidFraction).toBe(1.0);
  });

  it('pre-loading is not paid and the order is not fully paid until the events arrive', async () => {
    await orderPayments.handlePaymentVerified(
      paymentVerified({ orderRef: ORDER_REF, trigger: 'confirmation', paidFraction: 0.5 }),
    );
    expect(await orderPayments.isPreLoadingPaid(ORDER_REF)).toBe(false);
    const elig = await orderPayments.releaseEligibility(ORDER_REF);
    expect(elig.fullyPaid).toBe(false);
    expect(elig.outstandingFraction).toBeCloseTo(0.5, 4);
  });

  it('a late lower cumulative fraction cannot regress the projection', async () => {
    await orderPayments.handlePaymentVerified(
      paymentVerified({ orderRef: ORDER_REF, trigger: 'pre_loading', paidFraction: 1.0 }),
    );
    await orderPayments.handlePaymentVerified(
      paymentVerified({ orderRef: ORDER_REF, trigger: 'confirmation', paidFraction: 0.5 }),
    );
    const elig = await orderPayments.releaseEligibility(ORDER_REF);
    expect(elig.paidFraction).toBe(1.0);
  });
});

describe('quality projection (inspection.recorded / quality.failed)', () => {
  it('a quality failure blocks release; a later pass clears it; both idempotent on eventId', async () => {
    const fail = qualityFailed({ poRef: PO_REF });
    await qualityGate.handleQualityFailed(fail);
    const dup = await qualityGate.handleQualityFailed(fail);
    expect(dup.status).toBe('duplicate');
    await expect(qualityGate.assertReleasable([PO_REF])).rejects.toMatchObject({
      code: 'GATE_QC_NOT_RELEASED',
    });

    const pass = inspectionRecorded({ poRef: PO_REF, result: 'pass' });
    await qualityGate.handleInspectionRecorded(pass);
    const dup2 = await qualityGate.handleInspectionRecorded(pass);
    expect(dup2.status).toBe('duplicate');
    await expect(qualityGate.assertReleasable([PO_REF])).resolves.toBeUndefined();
  });

  it('a recorded fail result blocks release just like an explicit quality.failed', async () => {
    await qualityGate.handleInspectionRecorded(
      inspectionRecorded({ poRef: PO_REF, result: 'fail', critical: 1 }),
    );
    await expect(qualityGate.assertReleasable([PO_REF])).rejects.toMatchObject({
      code: 'GATE_QC_NOT_RELEASED',
    });
  });
});
