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
  /** Only used when there is no `quoteRef` to derive it from (a quote's basis always
   *  wins — never trusted from the caller once a quote exists). Defaults to EXW. */
  readonly basis?: 'EXW' | 'FOB';
  readonly clientRequestId?: string;
}

/**
 * Purchase orders to suppliers. `declaredCbm`/`declaredKg` are the FACTORY's numbers —
 * the first of the three volumetric figures the corridor never overwrites (declared,
 * measured, billed). Issuing a PO publishes `po.issued` through the transactional outbox,
 * committed in the same transaction as the insert. Offline-safe: a replayed
 * clientRequestId returns the existing PO and does NOT re-emit.
 *
 * `basis`/`inlandSeparable` are copied from the linked SupplierQuote (when `quoteRef` is
 * given) so the FOB-buries-inland fact survives past the quote onto the PO — otherwise a
 * downstream reader (freight arrangement, cost reconciliation) loses it entirely. Checked
 * against `container.service.ts`/`freight.service.ts` (logistics-warehouse's module, out of
 * this module's ownership to edit): neither branches on incoterm today, and that is
 * actually CORRECT — a SupplierQuote/PO basis is only ever EXW or FOB (never CIF/DAP), so a
 * quoted/PO'd price NEVER includes ocean freight either way; UZA (or a freight company it
 * engages) always books the sea leg itself regardless of basis. The real gap was upstream,
 * here: the PO didn't retain which basis it was, so `assignOriginForwarder` had nothing to
 * key off. FOB specifically means the exporter's inland+export leg to the port of loading is
 * buried in `unitCostMinor` (inlandSeparable=false); this is recorded on the PO now.
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

    // The quote's basis always wins — never trusted from the caller once a quote exists,
    // same discipline as RfqService.addQuote deriving inlandSeparable from basis.
    let basis: 'EXW' | 'FOB' = input.basis ?? 'EXW';
    if (input.quoteRef) {
      const quote = await this.prisma.supplierQuote.findUnique({ where: { ref: input.quoteRef } });
      if (!quote) throw new NotFoundException(`supplier quote ${input.quoteRef} not found`);
      basis = quote.basis;
    }
    const inlandSeparable = basis === 'EXW';

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
          basis,
          inlandSeparable,
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

  /**
   * Record who books the sea leg. Only meaningful on an issued PO — the FOB/EXW
   * distinction is already carried on the row (see class doc). `forwarderRef` is a free
   * readable reference (e.g. an internal partner id); `forwarderName` a display name
   * ("can be a Chinese freight company", per the founder's own wording).
   */
  async assignOriginForwarder(
    actor: Actor,
    poRef: string,
    input: { forwarderRef?: string; forwarderName: string },
  ) {
    await this.authz.authorize(actor, 'po', 'update');
    const po = await this.prisma.purchaseOrder.findUnique({ where: { ref: poRef } });
    if (!po) throw new NotFoundException(`purchase order ${poRef} not found`);
    return this.prisma.purchaseOrder.update({
      where: { ref: poRef },
      data: {
        originForwarderRef: input.forwarderRef ?? null,
        originForwarderName: input.forwarderName,
      },
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
      basis: po.basis,
      inlandSeparable: po.inlandSeparable,
      originForwarderRef: po.originForwarderRef,
      originForwarderName: po.originForwarderName,
      // UZA/its forwarder always books the ocean leg itself, regardless of basis — a
      // SupplierQuote/PO price is never CIF/DAP. FOB additionally means the exporter
      // covers inland+export docs to the port of loading (buried, inlandSeparable=false).
      freightNote:
        po.basis === 'FOB'
          ? 'FOB: exporter delivers to the port of loading; UZA books the ocean leg from there.'
          : 'EXW: UZA (via its forwarder) arranges the full inland + export + ocean chain from the factory gate.',
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
