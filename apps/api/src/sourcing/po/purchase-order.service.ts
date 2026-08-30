import { nextSequence } from '../../platform/ids/next-sequence';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Actor, Minor } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../platform/authorization/authorization.service';
import { OutboxService } from '../../platform/outbox/outbox.service';
import { makeRef, COUNTRY, currentYear } from '../sourcing-ids';
import { findByClientRequestId } from '../sync';

export interface NewPurchaseOrder {
  readonly supplierRef: string;
  readonly orderRef: string;
  readonly quoteRef?: string;
  readonly qty: number;
  readonly unitCostMinor: Minor;
  /** Factory-DECLARED per-unit volumetrics; multiplied by qty into declaredCbm/Kg. */
  readonly unitCbm: number;
  readonly unitKg: number;
  readonly clientRequestId?: string;
}

/**
 * Purchase orders to suppliers. `declaredCbm`/`declaredKg` are the FACTORY's numbers —
 * the first of the three volumetric figures the corridor never overwrites (declared,
 * measured, billed). Issuing a PO publishes `po.issued` through the transactional outbox,
 * committed in the same transaction as the insert. Offline-safe: a replayed
 * clientRequestId returns the existing PO and does NOT re-emit.
 */
@Injectable()
export class PurchaseOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
    private readonly outbox: OutboxService,
  ) {}

  async create(actor: Actor, input: NewPurchaseOrder) {
    await this.authz.authorize(actor, 'po', 'create');

    const existing = await findByClientRequestId(this.prisma.purchaseOrder, input.clientRequestId);
    if (existing) return existing;

    const supplier = await this.prisma.supplier.findUnique({ where: { ref: input.supplierRef } });
    if (!supplier) throw new NotFoundException(`supplier ${input.supplierRef} not found`);

    const poTotalMinor = (input.qty * input.unitCostMinor) as Minor;
    const declaredCbm = round(input.qty * input.unitCbm, 3);
    const declaredKg = round(input.qty * input.unitKg, 1);

    return this.outbox.emit(actor.userId, async (tx, emit) => {
      const seq = await nextSequence(tx.purchaseOrder, (n) =>
        makeRef('po', { country: COUNTRY, year: currentYear(), seq: n }),
      );
      const ref = makeRef('po', { country: COUNTRY, year: currentYear(), seq });
      const po = await tx.purchaseOrder.create({
        data: {
          ref,
          supplierRef: input.supplierRef,
          orderRef: input.orderRef,
          quoteRef: input.quoteRef ?? null,
          qty: input.qty,
          unitCostMinor: input.unitCostMinor,
          poTotalMinor,
          declaredCbm,
          declaredKg,
          clientRequestId: input.clientRequestId ?? null,
        },
      });
      await emit('po.issued', {
        poRef: ref,
        supplierRef: input.supplierRef,
        orderRef: input.orderRef,
      });
      return po;
    });
  }

  async read(actor: Actor, ref: string) {
    await this.authz.authorize(actor, 'po', 'read');
    const po = await this.prisma.purchaseOrder.findUnique({ where: { ref } });
    if (!po) throw new NotFoundException(`purchase order ${ref} not found`);
    // Project onto the field names CONFIDENTIAL_FIELDS masks against (supplierUnitCost,
    // poTotal carry Minor values, matching the repo's masking convention). A logistics
    // partner sees declared volumetrics and nothing behind them.
    const view = {
      ref: po.ref,
      supplierRef: po.supplierRef,
      orderRef: po.orderRef,
      quoteRef: po.quoteRef,
      qty: po.qty,
      status: po.status,
      declaredCbm: po.declaredCbm,
      declaredKg: po.declaredKg,
      supplierUnitCost: po.unitCostMinor,
      poTotal: po.poTotalMinor,
    };
    return this.authz.mask(actor, view);
  }
}

const round = (n: number, dp: number): number => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};
