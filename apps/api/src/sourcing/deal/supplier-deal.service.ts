import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { gradeInspection, type Actor } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../platform/authorization/authorization.service';
import { supplierDealRef } from '../sourcing-ids';
import { findByClientRequestId } from '../sync';
import { BOOKING_FEE_PER_UNIT_MINOR } from '../deal-policy';

export interface ReserveDeal {
  readonly offerRef: string;
  /** Human actor confirming the booking fee was actually paid. Never AI, never inferred
   *  from `actor.userId` alone — mirrors Payment.verifiedBy's explicit-field discipline. */
  readonly confirmedBy: string;
  readonly clientRequestId?: string;
}

export interface RecordDealInspection {
  readonly critical: number;
  readonly major: number;
  readonly minor: number;
  /** Optional pointer at a real quality-module Inspection.ref, when the standard
   *  visit/inspection pipeline was used for this unit. Loose (non-FK): a deal may predate
   *  any PurchaseOrder. */
  readonly inspectionRef?: string;
  readonly clientRequestId?: string;
}

const NOT_YET_INSPECTABLE = new Set(['balance_due', 'paid', 'cancelled']);

/**
 * The two-stage-payment state machine on a confirmed supplier deal:
 *
 *     reserved --(passing inspection)--> inspected --(human approval)--> balance_due --(human confirms)--> paid
 *        ^                                   |
 *        +----------- (failing inspection) --+--> inspection_failed --(re-inspect)--> back to reserved/inspected
 *
 * Mirrors CLAUDE.md rule 1 ("payment gates procurement... never by an agent, never by AI")
 * one level earlier, at the supplier deposit: a booking fee reserves a unit, and the
 * remaining balance is reachable ONLY after a PASSING inspection — `markBalanceDue` is the
 * gate, not a side effect of recording the inspection. Both money-confirmation steps
 * (`reserve`, `confirmBalancePaid`) require an explicit human `confirmedBy`/`balanceConfirmedBy`
 * and are authorised on `po:approve` (finance, china_sourcing, ceo per @uza/contracts
 * ROLE_GRANTS) — the same unused-until-now grant finance already holds for supplier
 * purchase orders, reused here rather than requesting a new one.
 *
 * Offline-safe via a per-transition ledger (`SupplierDealEvent`, keyed by
 * `clientRequestId`): a retried transition over a bad connection returns the deal's current
 * state rather than re-applying (and, for money, never double-confirms a payment).
 */
@Injectable()
export class SupplierDealService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
  ) {}

  /** Replay guard for a STATE TRANSITION on an existing deal (as opposed to `sync.ts`,
   *  which guards new-row creation). Returns the current deal if this clientRequestId
   *  already produced a transition; otherwise runs `apply` inside a transaction that also
   *  writes the ledger row, and returns its result. */
  private async withReplayGuard<R>(
    dealRef: string,
    kind: string,
    clientRequestId: string | undefined,
    detail: Prisma.InputJsonValue | undefined,
    apply: (tx: Prisma.TransactionClient) => Promise<R>,
  ): Promise<R> {
    if (clientRequestId) {
      const already = await this.prisma.supplierDealEvent.findUnique({
        where: { clientRequestId },
      });
      if (already) {
        const deal = await this.prisma.supplierDeal.findUnique({ where: { ref: dealRef } });
        if (!deal) throw new NotFoundException(`supplier deal ${dealRef} not found`);
        return deal as R;
      }
    }
    return this.prisma.$transaction(async (tx) => {
      const result = await apply(tx);
      await tx.supplierDealEvent.create({
        data: { dealRef, kind, detail, clientRequestId: clientRequestId ?? null },
      });
      return result;
    });
  }

  /**
   * Reserve a unit: confirms the booking fee was paid and opens the deal. Requires the
   * offer to be `accepted` (SupplierOfferService.accept). `totalMinor` and `bookingFeeMinor`
   * are computed once here and never recomputed — same "never overwrite a locked figure"
   * discipline as Quotation.marginPct.
   */
  async reserve(actor: Actor, input: ReserveDeal) {
    await this.authz.authorize(actor, 'po', 'approve');
    if (!input.confirmedBy) {
      throw new BadRequestException('confirmedBy is required: a human must confirm the booking fee');
    }

    const offer = await this.prisma.supplierOffer.findUnique({ where: { ref: input.offerRef } });
    if (!offer) throw new NotFoundException(`supplier offer ${input.offerRef} not found`);
    if (offer.status !== 'accepted') {
      throw new BadRequestException(
        `offer ${input.offerRef} must be accepted before it can be reserved (status: ${offer.status})`,
      );
    }

    const existing = await findByClientRequestId(this.prisma.supplierDeal, input.clientRequestId);
    if (existing) return existing;

    const totalMinor = offer.qty * offer.unitCostMinor;
    const bookingFeeMinor = offer.qty * BOOKING_FEE_PER_UNIT_MINOR;
    const balanceMinor = totalMinor - bookingFeeMinor;

    return this.prisma.$transaction(async (tx) => {
      const seq = (await tx.supplierDeal.count()) + 1;
      const ref = supplierDealRef(seq);
      const deal = await tx.supplierDeal.create({
        data: {
          ref,
          offerRef: offer.ref,
          supplierRef: offer.supplierRef,
          qty: offer.qty,
          unitCostMinor: offer.unitCostMinor,
          totalMinor,
          bookingFeeMinor,
          bookingFeePaidAt: new Date(),
          bookingFeeConfirmedBy: input.confirmedBy,
          balanceMinor,
          status: 'reserved',
          basis: offer.basis,
          inlandSeparable: offer.inlandSeparable,
          clientRequestId: input.clientRequestId ?? null,
        },
      });
      await tx.supplierDealEvent.create({
        data: {
          dealRef: ref,
          kind: 'reserved',
          detail: { confirmedBy: input.confirmedBy, bookingFeeMinor } as Prisma.InputJsonValue,
          clientRequestId: input.clientRequestId ?? null,
        },
      });
      return deal;
    });
  }

  /**
   * Record an inspection outcome against the deal. The result is DERIVED via the SAME
   * `gradeInspection` boundary the quality module grades against (never re-derived) —
   * critical > 0 fails, no override. A failing result moves the deal to
   * `inspection_failed` (visible, blocking) rather than silently leaving it `reserved`.
   * Re-callable from `reserved` or `inspection_failed` (re-inspection); refused once the
   * deal has moved to `balance_due`/`paid`/`cancelled`.
   */
  async recordInspectionResult(actor: Actor, dealRef: string, input: RecordDealInspection) {
    await this.authz.authorize(actor, 'po', 'update');

    const deal = await this.prisma.supplierDeal.findUnique({ where: { ref: dealRef } });
    if (!deal) throw new NotFoundException(`supplier deal ${dealRef} not found`);
    if (NOT_YET_INSPECTABLE.has(deal.status)) {
      throw new BadRequestException(
        `deal ${dealRef} is already ${deal.status}; its inspection cannot be re-recorded`,
      );
    }

    const result = gradeInspection(input.critical, input.major);
    const status = result === 'fail' ? 'inspection_failed' : 'inspected';

    return this.withReplayGuard(
      dealRef,
      'inspection_recorded',
      input.clientRequestId,
      { result, critical: input.critical, major: input.major, minor: input.minor } as Prisma.InputJsonValue,
      (tx) =>
        tx.supplierDeal.update({
          where: { ref: dealRef },
          data: {
            status,
            inspectionResult: result,
            inspectionRef: input.inspectionRef ?? deal.inspectionRef,
          },
        }),
    );
  }

  /**
   * Human approval: open the balance step. Requires a PASSING inspection — strictly
   * `pass`, not `conditional` — the money-release gate this task asked for
   * ("the inspection result should be what gates whether the balance step is even
   * reachable"). `po:approve` again: finance, china_sourcing, ceo.
   */
  async markBalanceDue(actor: Actor, dealRef: string, clientRequestId?: string) {
    await this.authz.authorize(actor, 'po', 'approve');

    const deal = await this.prisma.supplierDeal.findUnique({ where: { ref: dealRef } });
    if (!deal) throw new NotFoundException(`supplier deal ${dealRef} not found`);
    if (deal.status === 'balance_due' || deal.status === 'paid') return deal; // idempotent

    if (deal.status !== 'inspected' || deal.inspectionResult !== 'pass') {
      throw new BadRequestException(
        `deal ${dealRef} cannot move to balance_due: requires a passing inspection ` +
          `(status: ${deal.status}, inspectionResult: ${deal.inspectionResult ?? 'none'})`,
      );
    }

    return this.withReplayGuard(dealRef, 'balance_due_marked', clientRequestId, undefined, (tx) =>
      tx.supplierDeal.update({ where: { ref: dealRef }, data: { status: 'balance_due' } }),
    );
  }

  /** Human confirms the balance was actually paid. Never AI. */
  async confirmBalancePaid(
    actor: Actor,
    dealRef: string,
    confirmedBy: string,
    clientRequestId?: string,
  ) {
    await this.authz.authorize(actor, 'po', 'approve');
    if (!confirmedBy) {
      throw new BadRequestException('confirmedBy is required: a human must confirm the balance payment');
    }

    const deal = await this.prisma.supplierDeal.findUnique({ where: { ref: dealRef } });
    if (!deal) throw new NotFoundException(`supplier deal ${dealRef} not found`);
    if (deal.status === 'paid') return deal; // idempotent
    if (deal.status !== 'balance_due') {
      throw new BadRequestException(
        `deal ${dealRef} cannot be paid: balance is not yet due (status: ${deal.status})`,
      );
    }

    return this.withReplayGuard(
      dealRef,
      'balance_paid',
      clientRequestId,
      { confirmedBy } as Prisma.InputJsonValue,
      (tx) =>
        tx.supplierDeal.update({
          where: { ref: dealRef },
          data: { status: 'paid', balancePaidAt: new Date(), balanceConfirmedBy: confirmedBy },
        }),
    );
  }

  async read(actor: Actor, ref: string) {
    await this.authz.authorize(actor, 'po', 'read');
    const deal = await this.prisma.supplierDeal.findUnique({
      where: { ref },
      include: { events: true },
    });
    if (!deal) throw new NotFoundException(`supplier deal ${ref} not found`);
    // Project money fields onto CONFIDENTIAL_FIELDS names where they line up
    // (supplierUnitCost, poTotal) so existing masking applies. `bookingFeeMinor`/
    // `balanceMinor` have no analog in @uza/contracts CONFIDENTIAL_FIELDS yet — filed in
    // docs/contract-requests/2026-09-14-supplier-deal-ids-policy-and-masking.md. Until
    // accepted, a role holding `po:read` without a poTotal-level grant (only
    // china_warehouse today) sees these two UNMASKED — a real, open gap, not hidden here.
    const view = {
      ref: deal.ref,
      offerRef: deal.offerRef,
      supplierRef: deal.supplierRef,
      qty: deal.qty,
      status: deal.status,
      basis: deal.basis,
      inlandSeparable: deal.inlandSeparable,
      inspectionRef: deal.inspectionRef,
      inspectionResult: deal.inspectionResult,
      bookingFeePaidAt: deal.bookingFeePaidAt,
      bookingFeeConfirmedBy: deal.bookingFeeConfirmedBy,
      balancePaidAt: deal.balancePaidAt,
      balanceConfirmedBy: deal.balanceConfirmedBy,
      supplierUnitCost: deal.unitCostMinor,
      poTotal: deal.totalMinor,
      bookingFeeMinor: deal.bookingFeeMinor,
      balanceMinor: deal.balanceMinor,
    };
    // `events` appended after masking, same reasoning as SupplierOfferService.read: it
    // carries no scalar of its own to mask and keeping it out of the generic preserves its
    // array type for callers.
    return { ...this.authz.mask(actor, view), events: deal.events };
  }
}
