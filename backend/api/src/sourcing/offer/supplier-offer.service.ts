import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Actor, Minor } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../platform/authorization/authorization.service';
import { supplierOfferRef } from '../sourcing-ids';
import { findByClientRequestId } from '../sync';

export interface NewOffer {
  readonly supplierRef: string;
  readonly projectRef?: string;
  readonly unitCostMinor: Minor;
  readonly qty: number;
  readonly moq: number;
  readonly leadTimeDays: number;
  readonly unitCbm: number;
  readonly unitKg: number;
  /** Same FOB-buries-inland discipline as SupplierQuote. Defaults to EXW / separable. */
  readonly basis?: 'EXW' | 'FOB';
  /** Free text: who at the supplier proposed this (phone/WeChat/email). No login exists
   *  for the supplier yet, so this is the only identity capture available today. */
  readonly supplierContact?: string;
  readonly clientRequestId?: string;
}

export type OfferAttachmentKind = 'image' | 'inspection_report' | 'battery_health_certificate';

export interface NewAttachment {
  readonly kind: OfferAttachmentKind;
  readonly uri: string;
  readonly note?: string;
  readonly clientRequestId?: string;
}

/**
 * Supplier self-service channel — STAFF-RELAYED today.
 *
 * The founder asked for a channel where a supplier submits a deal/offer proactively, not
 * only in response to a UZA-initiated RFQ. Suppliers have no login role in this system
 * (there is no `supplier` entry in @uza/contracts ROLE_GRANTS — confirmed gap, not an
 * oversight), so a full self-service portal needs a contract change: filed as
 * the supplier self service role contract request (2026-09-14). Until that lands, THIS
 * service is the real, working half: china_sourcing staff relay a supplier's proactive
 * offer (`channel: 'staff_relay'`), with real supplier identity captured as free-text
 * contact info, attachments (images / inspection report / battery-health certificate —
 * this sourcing channel is EV-heavy), and a review step (accept/decline) before any money
 * moves via SupplierDealService.
 *
 * Authorisation deliberately reuses the EXISTING `supplierQuote` resource grant
 * (china_sourcing holds `supplierQuote:*`) rather than inventing a new resource string that
 * would need its own ROLE_GRANTS entry I am not authorised to add — an offer is, for
 * authorisation purposes, "a supplier's proactive quote".
 */
@Injectable()
export class SupplierOfferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
  ) {}

  async submit(actor: Actor, input: NewOffer) {
    await this.authz.authorize(actor, 'supplierQuote', 'create');

    const existing = await findByClientRequestId(this.prisma.supplierOffer, input.clientRequestId);
    if (existing) return existing;

    const supplier = await this.prisma.supplier.findUnique({ where: { ref: input.supplierRef } });
    if (!supplier) throw new NotFoundException(`supplier ${input.supplierRef} not found`);

    // FOB buries inland cost: derived from basis, never trusted from the caller — same
    // discipline as RfqService.addQuote, so an FOB offer can never masquerade as
    // inland-separable.
    const basis = input.basis ?? 'EXW';
    const inlandSeparable = basis === 'EXW';

    return this.prisma.$transaction(async (tx) => {
      const seq = (await tx.supplierOffer.count()) + 1;
      return tx.supplierOffer.create({
        data: {
          ref: supplierOfferRef(seq),
          supplierRef: input.supplierRef,
          projectRef: input.projectRef ?? null,
          unitCostMinor: input.unitCostMinor,
          qty: input.qty,
          moq: input.moq,
          leadTimeDays: input.leadTimeDays,
          unitCbm: input.unitCbm,
          unitKg: input.unitKg,
          basis,
          inlandSeparable,
          channel: 'staff_relay',
          relayedBy: actor.userId,
          supplierContact: input.supplierContact ?? null,
          clientRequestId: input.clientRequestId ?? null,
        },
      });
    });
  }

  /** Attach evidence to an offer: bound to the offer, never a loose blob. */
  async addAttachment(actor: Actor, offerRef: string, input: NewAttachment) {
    await this.authz.authorize(actor, 'supplierQuote', 'update');

    const existing = await findByClientRequestId(
      this.prisma.supplierOfferAttachment,
      input.clientRequestId,
    );
    if (existing) return existing;

    const offer = await this.prisma.supplierOffer.findUnique({ where: { ref: offerRef } });
    if (!offer) throw new NotFoundException(`supplier offer ${offerRef} not found`);

    return this.prisma.supplierOfferAttachment.create({
      data: {
        offerRef,
        kind: input.kind,
        uri: input.uri,
        note: input.note ?? null,
        clientRequestId: input.clientRequestId ?? null,
      },
    });
  }

  /**
   * Review an offer. Idempotent on status: re-accepting an already-accepted offer (or
   * re-declining an already-declined one) is a no-op replay, not an error — the retry-safe
   * behaviour a poor-signal relay needs without a per-call clientRequestId ledger.
   */
  async accept(actor: Actor, offerRef: string, decidedBy: string) {
    return this.decide(actor, offerRef, 'accepted', decidedBy);
  }

  async decline(actor: Actor, offerRef: string, decidedBy: string) {
    return this.decide(actor, offerRef, 'declined', decidedBy);
  }

  private async decide(
    actor: Actor,
    offerRef: string,
    status: 'accepted' | 'declined',
    decidedBy: string,
  ) {
    await this.authz.authorize(actor, 'supplierQuote', 'update');
    const offer = await this.prisma.supplierOffer.findUnique({ where: { ref: offerRef } });
    if (!offer) throw new NotFoundException(`supplier offer ${offerRef} not found`);

    if (offer.status === status) return offer; // idempotent replay
    if (offer.status !== 'submitted') {
      throw new BadRequestException(
        `offer ${offerRef} is already ${offer.status}; cannot mark it ${status}`,
      );
    }

    return this.prisma.supplierOffer.update({
      where: { ref: offerRef },
      data: { status, decidedBy },
    });
  }

  async read(actor: Actor, ref: string) {
    await this.authz.authorize(actor, 'supplierQuote', 'read');
    const offer = await this.prisma.supplierOffer.findUnique({
      where: { ref },
      include: { attachments: true, deals: true },
    });
    if (!offer) throw new NotFoundException(`supplier offer ${ref} not found`);
    // Project unitCostMinor onto `supplierUnitCost` so masking applies (CONFIDENTIAL_FIELDS),
    // same convention as RfqService.read / PurchaseOrderService.read.
    const view = {
      ref: offer.ref,
      supplierRef: offer.supplierRef,
      projectRef: offer.projectRef,
      qty: offer.qty,
      moq: offer.moq,
      leadTimeDays: offer.leadTimeDays,
      unitCbm: offer.unitCbm,
      unitKg: offer.unitKg,
      basis: offer.basis,
      inlandSeparable: offer.inlandSeparable,
      channel: offer.channel,
      relayedBy: offer.relayedBy,
      supplierContact: offer.supplierContact,
      status: offer.status,
      decidedBy: offer.decidedBy,
      supplierUnitCost: offer.unitCostMinor,
    };
    // Nested relations are appended AFTER masking: they carry no confidential scalar of
    // their own (an attachment is a uri; a deal's own money is masked by
    // SupplierDealService.read), and keeping them out of `maskFields`' generic keeps their
    // array types intact for callers instead of widening to `T | typeof MASK`.
    return { ...this.authz.mask(actor, view), attachments: offer.attachments, deals: offer.deals };
  }
}
