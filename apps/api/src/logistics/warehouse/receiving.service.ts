import { nextSequence } from '../../platform/ids/next-sequence';
import { Injectable } from '@nestjs/common';
import {
  CBM_TOLERANCE,
  CBM_HARD_STOP,
  revenueTon,
  UzaError,
  type Actor,
  type VarianceDecision,
} from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../platform/authorization/authorization.service';
import { OutboxService } from '../../platform/outbox/outbox.service';
import { lotRef, packageRef } from '../logistics-ids';

export interface PackageSpec {
  readonly kg: number;
  readonly cbm: number;
}

export interface ReceiveInput {
  readonly orderRef: string;
  readonly customerRef: string;
  readonly poRef: string;
  /** The factory numbers, copied from the PO. Never mutated here. */
  readonly declaredCbm: number;
  readonly declaredKg: number;
  readonly packages: readonly PackageSpec[];
  /** Optional device-generated id for offline capture idempotency (François, poor signal). */
  readonly clientRequestId?: string;
}

const VARIANCE_DECISIONS: readonly VarianceDecision[] = [
  'client_pays',
  'uza_absorbs',
  'reduce_qty',
];

/**
 * Warehouse receiving — the first of the three volumetric numbers made real.
 *
 * Volumetrics are three numbers, never one: `declared` (factory, from the PO),
 * `measured` (François, here), `billed` (forwarder, later on the shipment). This service
 * writes ONLY the measured numbers and never overwrites the declared ones.
 *
 * Declared-vs-measured is a SUPPLIER problem: `warehouse.receiptRecorded` carries the
 * variance so sourcing can score the factory. Beyond CBM_HARD_STOP the goods freeze
 * (`varianceHold=true` on every package) until a human resolves it (CF-013).
 */
@Injectable()
export class ReceivingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
    private readonly outbox: OutboxService,
  ) {}

  /**
   * Record a lot's packages and reconcile measured-vs-declared. Emits
   * `warehouse.receiptRecorded` in the same transaction as the writes.
   */
  async receivePackages(actor: Actor, input: ReceiveInput) {
    await this.authz.authorize(actor, 'package', 'create');

    if (input.packages.length === 0) {
      throw new UzaError({
        code: 'GATE_VARIANCE_UNRESOLVED',
        message: 'A receipt needs at least one package.',
        responsibleRole: actor.role,
      });
    }
    if (input.declaredCbm <= 0) {
      throw new UzaError({
        code: 'GATE_VARIANCE_UNRESOLVED',
        message: 'Declared CBM from the PO must be positive to compute variance.',
        responsibleRole: actor.role,
      });
    }

    // Offline replay: a resynced capture returns the existing receipt and emits nothing.
    if (input.clientRequestId) {
      const dup = await this.prisma.warehouseReceipt.findUnique({
        where: { clientRequestId: input.clientRequestId },
        include: { packages: true },
      });
      if (dup) return { receipt: dup, packages: dup.packages, replayed: true as const };
    }

    const measuredCbm = round3(input.packages.reduce((a, p) => a + p.cbm, 0));
    const measuredKg = round1(input.packages.reduce((a, p) => a + p.kg, 0));
    const measuredRevenueTon = revenueTon(measuredCbm, measuredKg);
    const variance = round4((measuredCbm - input.declaredCbm) / input.declaredCbm);
    const discrepancy = Math.abs(variance) > CBM_TOLERANCE;
    const hardStop = variance > CBM_HARD_STOP;

    return this.outbox.emit(actor.userId, async (tx, emit) => {
      const lotSeq = await nextSequence(tx.warehouseReceipt, (n) => lotRef(input.orderRef, n));
      const lot = lotRef(input.orderRef, lotSeq);

      const receipt = await tx.warehouseReceipt.create({
        data: {
          ref: lot,
          orderRef: input.orderRef,
          poRef: input.poRef,
          customerRef: input.customerRef,
          lotRef: lot,
          declaredCbm: input.declaredCbm,
          declaredKg: input.declaredKg,
          measuredCbm,
          measuredKg,
          measuredRevenueTon,
          variance,
          discrepancy,
          hardStop,
          clientRequestId: input.clientRequestId ?? null,
        },
      });

      const pkgCountBefore = await tx.package.count();
      const packages = [];
      for (let i = 0; i < input.packages.length; i++) {
        const spec = input.packages[i]!;
        const ref = packageRef(input.orderRef, pkgCountBefore + i + 1);
        packages.push(
          await tx.package.create({
            data: {
              ref,
              orderRef: input.orderRef,
              customerRef: input.customerRef,
              poRef: input.poRef,
              lotRef: lot,
              kg: spec.kg,
              cbm: spec.cbm,
              zone: 'AWAITING_INSPECTION',
              // CF-013: beyond the hard stop the goods are frozen commercially. This is the
              // varianceHold (commercial), entirely independent of qcReleased (QC state).
              varianceHold: hardStop,
            },
          }),
        );
      }

      await emit('warehouse.receiptRecorded', {
        lotRef: lot,
        orderRef: input.orderRef,
        poRef: input.poRef,
        declaredCbm: input.declaredCbm,
        measuredCbm,
        measuredKg,
        measuredRevenueTon,
        variance,
        discrepancy,
        hardStop,
      });

      return { receipt, packages, replayed: false as const };
    });
  }

  /**
   * A human decides who carries the extra freight before booking: client_pays |
   * uza_absorbs | reduce_qty. Clears the commercial varianceHold on the lot's packages
   * and stamps the decision. Does NOT touch qcReleased — that is a separate gate (CF-014).
   * Emits `warehouse.varianceResolved`.
   */
  async resolveVariance(actor: Actor, lotRefValue: string, decision: VarianceDecision, note = '') {
    await this.authz.authorize(actor, 'package', 'update');
    if (!VARIANCE_DECISIONS.includes(decision)) {
      throw new UzaError({
        code: 'GATE_VARIANCE_UNRESOLVED',
        message: `Unknown variance decision "${decision}".`,
        responsibleRole: actor.role,
      });
    }

    const receipt = await this.prisma.warehouseReceipt.findUnique({
      where: { lotRef: lotRefValue },
    });
    if (!receipt) {
      throw new UzaError({
        code: 'GATE_VARIANCE_UNRESOLVED',
        message: `No warehouse receipt for lot ${lotRefValue}.`,
        responsibleRole: actor.role,
      });
    }

    return this.outbox.emit(actor.userId, async (tx, emit) => {
      await tx.warehouseReceipt.update({
        where: { lotRef: lotRefValue },
        data: { decision, decidedBy: actor.userId, decidedNote: note, decidedAt: new Date() },
      });
      // Clear the commercial hold ONLY. qcReleased is untouched.
      await tx.package.updateMany({
        where: { lotRef: lotRefValue },
        data: { varianceHold: false },
      });

      await emit('warehouse.varianceResolved', {
        orderRef: receipt.orderRef,
        decision,
        approverId: actor.userId,
        note,
      });
      return { lotRef: lotRefValue, orderRef: receipt.orderRef, decision };
    });
  }
}

const round1 = (n: number): number => Math.round(n * 10) / 10;
const round3 = (n: number): number => Math.round(n * 1000) / 1000;
const round4 = (n: number): number => Math.round(n * 10000) / 10000;
