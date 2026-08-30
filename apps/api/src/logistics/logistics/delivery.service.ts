import { nextSequence } from '../../platform/ids/next-sequence';
import { Injectable, NotFoundException } from '@nestjs/common';
import { UzaError, type Actor } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../platform/authorization/authorization.service';
import { OutboxService } from '../../platform/outbox/outbox.service';
import { OrderPaymentService } from '../consumers/order-payment.service';
import { deliveryRef as makeDeliveryRef } from '../logistics-ids';

export interface DeliverInput {
  readonly shipmentRef: string;
  readonly packageRefs: readonly string[];
  readonly podRef: string;
  readonly office?: string;
}

/**
 * Delivery with proof of delivery.
 *
 * The release gate (CF-028): goods release requires FULL payment — not arrival, RELEASE.
 * The determination is read from the projected OrderPaymentState (built from finance's
 * payment.verified), never from finance's tables. An order with any outstanding balance
 * keeps its goods in the warehouse (`GATE_BALANCE_OUTSTANDING`).
 *
 * Emits `delivery.completed`.
 */
@Injectable()
export class DeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
    private readonly outbox: OutboxService,
    private readonly orderPayments: OrderPaymentService,
  ) {}

  async deliver(actor: Actor, input: DeliverInput) {
    const shipment = await this.prisma.shipment.findUnique({ where: { ref: input.shipmentRef } });
    if (!shipment) throw new NotFoundException(`shipment ${input.shipmentRef} not found`);

    // Authorise at the service layer, scoped to the shipment (partner scope enforced here).
    await this.authz.authorize(actor, 'delivery', 'create', {
      shipmentRef: input.shipmentRef,
      kind: 'shipment',
      ref: input.shipmentRef,
    });

    const packages = await this.prisma.package.findMany({
      where: { ref: { in: [...input.packageRefs] } },
    });
    if (packages.length !== input.packageRefs.length) {
      const found = new Set(packages.map((p) => p.ref));
      const missing = input.packageRefs.filter((r) => !found.has(r));
      throw new UzaError({
        code: 'GATE_BALANCE_OUTSTANDING',
        message: `Unknown package(s): ${missing.join(', ')}`,
        responsibleRole: actor.role,
      });
    }

    // RELEASE GATE — every order behind the packages must be fully paid.
    const orderRefs = [...new Set(packages.map((p) => p.orderRef))];
    for (const orderRef of orderRefs) {
      const eligibility = await this.orderPayments.releaseEligibility(orderRef);
      if (!eligibility.fullyPaid) {
        throw new UzaError({
          code: 'GATE_BALANCE_OUTSTANDING',
          responsibleRole: 'finance',
          nextAction: `Collect the outstanding balance on ${orderRef} before releasing the goods.`,
          context: { orderRef, outstandingFraction: eligibility.outstandingFraction },
        });
      }
    }

    const customerRef = packages[0]!.customerRef;
    const orderRef = packages[0]!.orderRef;
    const office = input.office ?? actor.office ?? 'GOM';

    return this.outbox.emit(actor.userId, async (tx, emit) => {
      const seq = await nextSequence(tx.delivery, (n) => makeDeliveryRef(office, n));
      const ref = makeDeliveryRef(office, seq);
      const delivery = await tx.delivery.create({
        data: {
          ref,
          shipmentRef: input.shipmentRef,
          orderRef,
          customerRef,
          packageRefs: [...input.packageRefs],
          podRef: input.podRef,
          status: 'delivered',
        },
      });
      await tx.package.updateMany({
        where: { ref: { in: [...input.packageRefs] } },
        data: { delivered: true },
      });
      await tx.shipment.update({
        where: { ref: input.shipmentRef },
        data: { status: 'delivered' },
      });

      await emit('delivery.completed', {
        deliveryRef: ref,
        orderRef,
        shipmentRef: input.shipmentRef,
      });
      return delivery;
    });
  }
}
