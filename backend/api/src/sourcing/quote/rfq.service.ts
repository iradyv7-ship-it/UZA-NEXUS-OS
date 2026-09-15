import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Actor, Minor } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../platform/authorization/authorization.service';
import { rfqRef, supplierQuoteRef } from '../sourcing-ids';
import { findByClientRequestId } from '../sync';

export interface NewRfq {
  readonly projectRef: string;
  readonly detail?: Prisma.InputJsonValue;
  readonly clientRequestId?: string;
}

export interface NewQuote {
  readonly supplierRef: string;
  readonly projectRef: string;
  readonly rfqRef?: string;
  readonly unitCostMinor: Minor;
  readonly moq: number;
  readonly leadTimeDays: number;
  readonly unitCbm: number;
  readonly unitKg: number;
  /**
   * Cost basis. EXW keeps inland cost separable. FOB buries inland cost in the quote;
   * when the supplier will not split it, pass basis 'FOB' — the service then forces
   * `inlandSeparable=false` so this quote is never compared like-for-like against an EXW
   * one. Defaults to EXW / separable.
   */
  readonly basis?: 'EXW' | 'FOB';
  readonly clientRequestId?: string;
}

/**
 * RFQs and supplier quotes. A quote records its COST BASIS: an FOB quote has inland cost
 * buried, so `inlandSeparable` is forced false for it — otherwise supplier price
 * comparison is meaningless. Every quote also appends a SupplierPricePoint so the
 * supplier's price history survives independently of the quote.
 */
@Injectable()
export class RfqService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
  ) {}

  async createRfq(actor: Actor, input: NewRfq) {
    await this.authz.authorize(actor, 'rfq', 'create');

    const existing = await findByClientRequestId(this.prisma.rfq, input.clientRequestId);
    if (existing) return existing;

    return this.prisma.$transaction(async (tx) => {
      const seq = (await tx.rfq.count()) + 1;
      return tx.rfq.create({
        data: {
          ref: rfqRef(seq),
          projectRef: input.projectRef,
          detail: input.detail,
          clientRequestId: input.clientRequestId ?? null,
        },
      });
    });
  }

  async addQuote(actor: Actor, input: NewQuote) {
    await this.authz.authorize(actor, 'supplierQuote', 'create');

    const existing = await findByClientRequestId(this.prisma.supplierQuote, input.clientRequestId);
    if (existing) return existing;

    const supplier = await this.prisma.supplier.findUnique({ where: { ref: input.supplierRef } });
    if (!supplier) throw new NotFoundException(`supplier ${input.supplierRef} not found`);

    // FOB buries inland cost: the flag is derived from the basis, never trusted from the
    // caller, so an FOB quote can never masquerade as inland-separable.
    const basis = input.basis ?? 'EXW';
    const inlandSeparable = basis === 'EXW';

    return this.prisma.$transaction(async (tx) => {
      const seq = (await tx.supplierQuote.count()) + 1;
      const quote = await tx.supplierQuote.create({
        data: {
          ref: supplierQuoteRef(seq),
          supplierRef: input.supplierRef,
          projectRef: input.projectRef,
          rfqRef: input.rfqRef ?? null,
          unitCostMinor: input.unitCostMinor,
          moq: input.moq,
          leadTimeDays: input.leadTimeDays,
          unitCbm: input.unitCbm,
          unitKg: input.unitKg,
          basis,
          inlandSeparable,
          clientRequestId: input.clientRequestId ?? null,
        },
      });
      await tx.supplierPricePoint.create({
        data: {
          supplierRef: input.supplierRef,
          quoteRef: quote.ref,
          unitCostMinor: input.unitCostMinor,
          basis,
          inlandSeparable,
        },
      });
      return quote;
    });
  }

  async read(actor: Actor, ref: string) {
    await this.authz.authorize(actor, 'supplierQuote', 'read');
    const quote = await this.prisma.supplierQuote.findUnique({ where: { ref } });
    if (!quote) throw new NotFoundException(`supplier quote ${ref} not found`);
    // Project unitCostMinor onto `supplierUnitCost` so masking applies for roles not in
    // CONFIDENTIAL_FIELDS (a sales agent must never see supplier cost).
    const view = {
      ref: quote.ref,
      supplierRef: quote.supplierRef,
      projectRef: quote.projectRef,
      rfqRef: quote.rfqRef,
      moq: quote.moq,
      leadTimeDays: quote.leadTimeDays,
      unitCbm: quote.unitCbm,
      unitKg: quote.unitKg,
      basis: quote.basis,
      inlandSeparable: quote.inlandSeparable,
      supplierUnitCost: quote.unitCostMinor,
    };
    return this.authz.mask(actor, view);
  }
}
