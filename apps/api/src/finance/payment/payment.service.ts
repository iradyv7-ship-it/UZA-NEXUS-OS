import { nextSequence } from '../../platform/ids/next-sequence';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Prisma, PaymentStatus } from '@prisma/client';
import {
  MIN_DEPOSIT,
  UzaError,
  type Actor,
  type InstallmentTrigger,
  type Minor,
} from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../platform/authorization/authorization.service';
import { OutboxService } from '../../platform/outbox/outbox.service';
import { NotificationService } from '../../platform/notification/notification.service';
import { CommissionService } from '../commission/commission.service';
import { paymentRef } from '../finance-ids';
import { financeScopeWhere } from '../list-scope';

export interface ProofUpload {
  readonly invoiceRef: string;
  readonly amountMinor: Minor;
  readonly proofRef: string;
  /** Which named installment this payment is meant to settle. */
  readonly targetTrigger: InstallmentTrigger;
}

export interface ListPage {
  readonly limit: number;
  readonly offset: number;
}

export interface PaymentListFilters {
  readonly status?: PaymentStatus;
  readonly invoiceRef?: string;
}

/**
 * Payments — capture, then verification. These are TWO separate acts on purpose:
 *
 *  - `uploadProof` only CAPTURES a claimed payment (status `pending_verification`) and
 *    publishes `payment.proofUploaded`. A customer or agent can do this. It changes no
 *    money state and activates nothing.
 *  - `verify` is FINANCE-ONLY (`payment:approve`). No front-office clerk, no venture
 *    manager, no AI can move a payment out of pending. It settles a NAMED installment
 *    (not an arbitrary amount); a short payment is REJECTED naming the shortfall, never
 *    silently accepted as partial (CF-007). On the `confirmation` installment it accrues
 *    2% commission and publishes `payment.verified` with trigger `confirmation` — which is
 *    the ONLY thing that activates procurement (CF-008/009). It publishes `payment.verified`
 *    for every settled installment so trade can mark each one paid.
 */
@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
    private readonly outbox: OutboxService,
    private readonly notify: NotificationService,
    private readonly commission: CommissionService,
  ) {}

  /** Capture a payment proof against an invoice. Publishes `payment.proofUploaded`. */
  async uploadProof(actor: Actor, input: ProofUpload) {
    const invoice = await this.prisma.invoice.findUnique({ where: { ref: input.invoiceRef } });
    if (!invoice) throw new NotFoundException(`invoice ${input.invoiceRef} not found`);

    // A customer may upload proof for their OWN invoice; finance may too. Scoped here.
    await this.authz.authorize(actor, 'payment', 'create', {
      customerId: invoice.customerRef,
      agentId: invoice.agentId ?? undefined,
    });

    return this.outbox.emit(actor.userId, async (tx, emit) => {
      const seq = await nextSequence(tx.payment, (n) => paymentRef(n));
      const ref = paymentRef(seq);
      const payment = await tx.payment.create({
        data: {
          ref,
          invoiceRef: invoice.ref,
          orderRef: invoice.orderRef,
          customerRef: invoice.customerRef,
          amountMinor: input.amountMinor,
          proofRef: input.proofRef,
          targetTrigger: input.targetTrigger,
        },
      });
      await emit('payment.proofUploaded', {
        paymentRef: ref,
        invoiceRef: invoice.ref,
        amountMinor: input.amountMinor,
      });
      // Finance is told a proof is waiting for a human decision.
      await this.notify.dispatch(
        ref,
        {
          audience: 'finance',
          recipientId: 'finance',
          body: `Payment proof ${ref} awaiting verification`,
        },
        tx,
      );
      return payment;
    });
  }

  /**
   * FINANCE-ONLY verification. Settles the named installment, rejects a short payment,
   * accrues commission on confirmation, and publishes `payment.verified`.
   */
  async verify(actor: Actor, ref: string) {
    // The single hard gate: only a finance-role actor holds `payment:approve`.
    await this.authz.authorize(actor, 'payment', 'approve');

    const payment = await this.prisma.payment.findUnique({ where: { ref } });
    if (!payment) throw new NotFoundException(`payment ${ref} not found`);
    if (payment.status !== 'pending_verification') {
      throw new BadRequestException(`payment ${ref} is already ${payment.status}`);
    }

    const invoice = await this.prisma.invoice.findUnique({ where: { ref: payment.invoiceRef } });
    if (!invoice) throw new NotFoundException(`invoice ${payment.invoiceRef} not found`);

    // Verification settles a NAMED installment — the one this payment targets — not an
    // arbitrary amount. It must still be due.
    const installment = await this.prisma.invoiceInstallment.findFirst({
      where: { orderRef: invoice.orderRef, trigger: payment.targetTrigger, status: 'due' },
    });
    if (!installment) {
      throw new BadRequestException(
        `no due installment with trigger ${payment.targetTrigger} on order ${invoice.orderRef}`,
      );
    }

    // CF-007: a short payment is rejected with a message naming the shortfall — never
    // silently booked as partial.
    if (payment.amountMinor < installment.amountMinor) {
      const shortfallMinor = installment.amountMinor - payment.amountMinor;
      throw new UzaError({
        code: 'PAYMENT_SHORT',
        responsibleRole: 'finance',
        nextAction: `Collect the remaining ${shortfallMinor} minor before verifying, or reject the payment.`,
        context: {
          paymentRef: ref,
          orderRef: invoice.orderRef,
          trigger: payment.targetTrigger,
          expectedMinor: installment.amountMinor,
          paidMinor: payment.amountMinor,
          shortfallMinor,
        },
      });
    }

    const isConfirmation = payment.targetTrigger === 'confirmation';
    // Deposit floor guard on the confirmation installment (mirrors order creation).
    if (isConfirmation && installment.pct < MIN_DEPOSIT) {
      throw new UzaError({
        code: 'DEPOSIT_BELOW_MINIMUM',
        responsibleRole: 'finance',
        context: { orderRef: invoice.orderRef, deposit: installment.pct, minimum: MIN_DEPOSIT },
      });
    }

    return this.outbox.emit(actor.userId, async (tx, emit) => {
      await tx.invoiceInstallment.update({
        where: { ref: installment.ref },
        data: { status: 'settled', settledByPaymentRef: ref },
      });
      await tx.payment.update({
        where: { ref },
        data: {
          status: 'verified',
          verifiedBy: actor.userId,
          verifiedAt: new Date(),
          settledInstallmentRef: installment.ref,
        },
      });

      // Recompute paid fraction and invoice status from the settled installments.
      const all = await tx.invoiceInstallment.findMany({ where: { invoiceRef: invoice.ref } });
      const settled = all.filter((i) => i.status === 'settled');
      const paidFraction = round4(settled.reduce((a, i) => a + i.pct, 0));
      const fullyPaid = settled.length === all.length;
      await tx.invoice.update({
        where: { ref: invoice.ref },
        data: { status: fullyPaid ? 'paid' : 'part_paid' },
      });

      // Commission accrues at CONFIRMATION only, once, and only when there is an agent.
      let accruedMinor = 0;
      if (isConfirmation && invoice.agentId && !invoice.commissionAccrued) {
        const amountMinor = CommissionService.accrualFor(invoice.totalMinor as Minor);
        await this.commission.accrue(tx, {
          agentId: invoice.agentId,
          orderRef: invoice.orderRef,
          amountMinor,
        });
        await tx.invoice.update({ where: { ref: invoice.ref }, data: { commissionAccrued: true } });
        await emit('commission.accrued', {
          agentId: invoice.agentId,
          orderRef: invoice.orderRef,
          amountMinor,
        });
        await this.notify.dispatch(
          invoice.orderRef,
          {
            audience: 'agent',
            recipientId: invoice.agentId,
            body: `Commission of ${amountMinor} minor accrued on confirmed order ${invoice.orderRef}`,
          },
          tx,
        );
        accruedMinor = amountMinor;
      }

      // `payment.verified` is published for EVERY settled installment. Trade activates
      // procurement ONLY on trigger `confirmation`; nothing else does.
      await emit('payment.verified', {
        paymentRef: ref,
        orderRef: invoice.orderRef,
        trigger: payment.targetTrigger as InstallmentTrigger,
        paidFraction,
      });

      return {
        status: 'verified' as const,
        paymentRef: ref,
        orderRef: invoice.orderRef,
        trigger: payment.targetTrigger,
        paidFraction,
        fullyPaid,
        accruedMinor,
      };
    });
  }

  /** Reject a captured payment (finance-only). No installment is settled. */
  async reject(actor: Actor, ref: string, reason: string) {
    await this.authz.authorize(actor, 'payment', 'approve');
    const payment = await this.prisma.payment.findUnique({ where: { ref } });
    if (!payment) throw new NotFoundException(`payment ${ref} not found`);
    if (payment.status !== 'pending_verification') {
      throw new BadRequestException(`payment ${ref} is already ${payment.status}`);
    }
    return this.prisma.payment.update({
      where: { ref },
      data: { status: 'rejected', rejectionReason: reason },
    });
  }

  async read(actor: Actor, ref: string) {
    const payment = await this.prisma.payment.findUnique({ where: { ref } });
    if (!payment) throw new NotFoundException(`payment ${ref} not found`);
    await this.authz.authorize(actor, 'payment', 'read', {
      customerId: payment.customerRef,
    });
    return this.authz.mask(actor, { ...payment });
  }

  /**
   * The caller's in-scope payments — the Finance verification queue when filtered
   * `status=pending_verification`. Role grant is checked first (no object → 403 if the
   * role holds no `payment:read`; a `customer` has only `payment:create`, so a customer
   * list is denied exactly as its by-ref read would be); object-scope is a WHERE predicate
   * via `financeScopeWhere`, mirroring `inScope` so a listed payment is always one the
   * by-ref read would also admit. Optional `status`/`invoiceRef` filters AND on top of
   * scope — they only NARROW, never widen. Stable sort: updatedAt desc. Payment rows carry
   * no CONFIDENTIAL_FIELDS, so `mask` is a no-op — applied for uniformity across read paths.
   */
  async list(actor: Actor, filters: PaymentListFilters, page: ListPage) {
    await this.authz.authorize(actor, 'payment', 'read');
    const where: Prisma.PaymentWhereInput = {
      AND: [
        financeScopeWhere(actor),
        ...(filters.status ? [{ status: filters.status }] : []),
        ...(filters.invoiceRef ? [{ invoiceRef: filters.invoiceRef }] : []),
      ],
    };
    const rows = await this.prisma.payment.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: page.limit,
      skip: page.offset,
    });
    return rows.map((row) => this.authz.mask(actor, { ...row }));
  }
}

const round4 = (n: number): number => Math.round(n * 10000) / 10000;
