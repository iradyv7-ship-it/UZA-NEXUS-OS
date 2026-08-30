import { nextSequence } from '../../platform/ids/next-sequence';
import { Injectable } from '@nestjs/common';
import { UzaError, type Actor, type Destination } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../platform/authorization/authorization.service';
import { OutboxService } from '../../platform/outbox/outbox.service';
import { OrderPaymentService } from '../consumers/order-payment.service';
import { shipmentRef as makeShipmentRef } from '../logistics-ids';

export interface CreateShipmentInput {
  readonly packageRefs: readonly string[];
  readonly container: string;
  readonly carrier: string;
  readonly etd: string;
  readonly eta: string;
  readonly partnerId?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Container assignment — the last real control point over an order before it sails.
 *
 * THREE independent booking gates, checked IN THIS ORDER, each throwing a distinct,
 * human-actionable error. They are NEVER merged into one check:
 *   1. GATE_VARIANCE_UNRESOLVED — no package may carry an unresolved commercial hold
 *   2. GATE_PRELOADING_UNPAID   — the pre-loading installment must be settled
 *   3. GATE_MIXED_DESTINATION   — a container is destination-pure (CF-018)
 *
 * A precondition before the three: goods must be QC-released (`GATE_QC_NOT_RELEASED`).
 * That is the separate QC gate — checked here on the physical qcReleased flag, which is
 * distinct from the commercial varianceHold checked by gate 1 (CF-014).
 *
 * `daysWaitingForConsolidation` is stamped on EVERY shipment from day one (the
 * container-utilisation founder decision) so the destination-pure policy can be judged.
 */
@Injectable()
export class ContainerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
    private readonly outbox: OutboxService,
    private readonly orderPayments: OrderPaymentService,
  ) {}

  async createShipment(actor: Actor, input: CreateShipmentInput) {
    await this.authz.authorize(actor, 'shipment', 'create');

    if (input.packageRefs.length === 0) {
      throw new UzaError({
        code: 'GATE_MIXED_DESTINATION',
        message: 'A container needs at least one package.',
        responsibleRole: actor.role,
      });
    }

    const packages = await this.prisma.package.findMany({
      where: { ref: { in: [...input.packageRefs] } },
    });
    if (packages.length !== input.packageRefs.length) {
      const found = new Set(packages.map((p) => p.ref));
      const missing = input.packageRefs.filter((r) => !found.has(r));
      throw new UzaError({
        code: 'GATE_QC_NOT_RELEASED',
        message: `Unknown package(s): ${missing.join(', ')}`,
        responsibleRole: actor.role,
      });
    }

    // Precondition (QC gate, distinct from the commercial gate 1): unreleased goods can't load.
    const unreleased = packages.filter((p) => !p.qcReleased);
    if (unreleased.length > 0) {
      throw new UzaError({
        code: 'GATE_QC_NOT_RELEASED',
        responsibleRole: 'china_warehouse',
        nextAction: 'Release these packages through QC before loading.',
        context: { packages: unreleased.map((p) => p.ref).join(', ') },
      });
    }

    // GATE 1 — volumetric variance resolved. Reads the COMMERCIAL hold (varianceHold),
    // never the QC flag. Cleared by ReceivingService.resolveVariance (warehouse.varianceResolved).
    const held = packages.filter((p) => p.varianceHold);
    if (held.length > 0) {
      throw new UzaError({
        code: 'GATE_VARIANCE_UNRESOLVED',
        responsibleRole: 'venture_manager',
        nextAction:
          'A decision is needed on who carries the extra freight (client_pays / uza_absorbs / reduce_qty).',
        context: { packages: held.map((p) => p.ref).join(', ') },
      });
    }

    // GATE 2 — pre-loading installment paid. Read from the projected OrderPaymentState,
    // built from finance's payment.verified — never from finance's tables.
    const orderRefs = [...new Set(packages.map((p) => p.orderRef))];
    for (const orderRef of orderRefs) {
      if (!(await this.orderPayments.isPreLoadingPaid(orderRef))) {
        throw new UzaError({
          code: 'GATE_PRELOADING_UNPAID',
          responsibleRole: 'finance',
          nextAction: `Collect and verify the pre-loading installment on ${orderRef} before booking.`,
          context: { orderRef },
        });
      }
    }

    // GATE 3 — single destination. Containers are destination-pure (CF-018).
    const destinations = [
      ...new Set(packages.map((p) => p.destination).filter((d): d is Destination => d !== null)),
    ];
    const unassigned = packages.filter((p) => p.destination === null);
    if (unassigned.length > 0) {
      throw new UzaError({
        code: 'GATE_MIXED_DESTINATION',
        responsibleRole: 'china_warehouse',
        nextAction: 'Allocate a destination to every package before booking.',
        context: { packages: unassigned.map((p) => p.ref).join(', ') },
      });
    }
    if (destinations.length > 1) {
      throw new UzaError({
        code: 'GATE_MIXED_DESTINATION',
        responsibleRole: 'china_warehouse',
        nextAction: 'Split the load: one container carries one destination.',
        context: { destinations: destinations.join(', ') },
      });
    }
    const destination = destinations[0]!;

    // daysWaitingForConsolidation: from the earliest lot receipt among the packages to now.
    const lotRefs = [...new Set(packages.map((p) => p.lotRef))];
    const receipts = await this.prisma.warehouseReceipt.findMany({
      where: { lotRef: { in: lotRefs } },
    });
    const earliest = receipts.reduce<Date | null>(
      (min, r) => (min === null || r.createdAt < min ? r.createdAt : min),
      null,
    );
    const daysWaiting = earliest
      ? Math.max(0, Math.floor((Date.now() - earliest.getTime()) / DAY_MS))
      : 0;

    return this.outbox.emit(actor.userId, async (tx, emit) => {
      const seq = await nextSequence(tx.shipment, (n) => makeShipmentRef(n));
      const ref = makeShipmentRef(seq);
      const shipment = await tx.shipment.create({
        data: {
          ref,
          container: input.container,
          carrier: input.carrier,
          destination,
          etd: input.etd,
          eta: input.eta,
          partnerId: input.partnerId ?? null,
          status: 'planned',
          daysWaitingForConsolidation: daysWaiting,
        },
      });
      await tx.package.updateMany({
        where: { ref: { in: [...input.packageRefs] } },
        data: { shipmentRef: ref },
      });

      await emit('container.assigned', {
        shipmentRef: ref,
        container: input.container,
        destination,
        packageCount: packages.length,
      });

      return { shipment, daysWaitingForConsolidation: daysWaiting };
    });
  }
}
