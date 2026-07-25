import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { COMMISSION_RATE, pct, type Actor, type EventEnvelope, type Minor } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../platform/authorization/authorization.service';
import { NotificationService } from '../../platform/notification/notification.service';
import { OutboxService } from '../../platform/outbox/outbox.service';

const ORDER_CANCELLED_CONSUMER = 'finance.order-cancelled';

type Tx = Prisma.TransactionClient;

/**
 * The commission ledger. Founder rule (CF-010): an agent earns 2% (`COMMISSION_RATE`) on a
 * CONFIRMED order — confirmed meaning the deposit installment was verified by Finance, NOT
 * order creation and NOT delivery.
 *
 * Every movement is a ROW, never a balance edit. Accrual is a positive row; a clawback on
 * cancellation (CF-030) is a SECOND, negative row — both survive, so a dispute is answered
 * by pointing at the ledger, never by a corrected number with no history. The running
 * balance is the signed sum of the rows.
 *
 * `dedupeKey` (a nullable UNIQUE column) gives DB-level idempotency for the singular
 * accrual/clawback per order; payout rows leave it null so an agent may be paid many times.
 */
@Injectable()
export class CommissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
    private readonly notify: NotificationService,
    private readonly outbox: OutboxService,
  ) {}

  /**
   * Write an accrual row inside an existing transaction. Called by PaymentService when the
   * confirmation installment is verified. Idempotent via the unique dedupeKey and the
   * invoice.commissionAccrued flag the caller checks. Publishing `commission.accrued` is
   * the caller's (it is emitted in the same outbox transaction as payment.verified).
   */
  async accrue(
    tx: Tx,
    input: { agentId: string; orderRef: string; amountMinor: Minor },
  ) {
    return tx.commissionEntry.create({
      data: {
        agentId: input.agentId,
        orderRef: input.orderRef,
        amountMinor: input.amountMinor,
        type: 'accrual',
        dedupeKey: `accrual:${input.orderRef}`,
      },
    });
  }

  /**
   * CF-030 — clawback on cancellation. Consumes trade's `order.cancelled`. Reverses the
   * accrual with an equal-and-opposite NEGATIVE row (the accrual row stays), publishes
   * `commission.clawedBack`, and notifies BOTH the agent and Finance. Idempotent on
   * eventId via ProcessedEvent and on the unique clawback dedupeKey. An order with no
   * accrued commission (cancelled before the deposit was verified) is a recorded no-op.
   */
  async handleOrderCancelled(envelope: EventEnvelope<'order.cancelled'>) {
    const already = await this.prisma.processedEvent.findUnique({
      where: { eventId_consumer: { eventId: envelope.eventId, consumer: ORDER_CANCELLED_CONSUMER } },
    });
    if (already) return { status: 'duplicate' as const, orderRef: envelope.payload.orderRef };

    const { orderRef, reason } = envelope.payload;

    // The outbox owns the transaction so the clawback event commits with the ledger row.
    return this.prisma.$transaction(async (tx) => {
      await tx.processedEvent.create({
        data: { eventId: envelope.eventId, consumer: ORDER_CANCELLED_CONSUMER },
      });

      const invoice = await tx.invoice.findUnique({ where: { orderRef } });
      // No invoice, or no commission ever accrued → nothing to reverse. Record & move on.
      if (!invoice || !invoice.commissionAccrued || invoice.commissionClawedBack) {
        return { status: 'no_accrual' as const, orderRef };
      }

      const accrual = await tx.commissionEntry.findFirst({
        where: { orderRef, type: 'accrual' },
      });
      if (!accrual) return { status: 'no_accrual' as const, orderRef };

      const amountMinor = accrual.amountMinor;
      await tx.commissionEntry.create({
        data: {
          agentId: accrual.agentId,
          orderRef,
          amountMinor: -amountMinor,
          type: 'clawback',
          reason,
          sourceEventId: envelope.eventId,
          dedupeKey: `clawback:${orderRef}`,
        },
      });
      await tx.invoice.update({ where: { ref: invoice.ref }, data: { commissionClawedBack: true } });

      // Enqueue the clawback event in the SAME transaction as the ledger row, with a
      // deterministic eventId derived from the source so a redelivery cannot double-emit.
      await this.outbox.enqueue(
        tx,
        'commission.clawedBack',
        { agentId: accrual.agentId, orderRef, amountMinor: amountMinor as Minor, reason },
        envelope.actorId,
        { eventId: `${envelope.eventId}:clawback` },
      );

      // Notify BOTH the agent and Finance — a clawback is never silent.
      await this.notify.dispatchMany(
        orderRef,
        [
          {
            audience: 'agent',
            recipientId: accrual.agentId,
            body: `Commission of ${amountMinor} minor reversed on ${orderRef}: ${reason}`,
          },
          {
            audience: 'finance',
            recipientId: 'finance',
            body: `Clawback of ${amountMinor} minor against ${accrual.agentId} on ${orderRef}: ${reason}`,
          },
        ],
        tx,
      );

      return { status: 'clawed_back' as const, orderRef, agentId: accrual.agentId, amountMinor };
    });
  }

  /**
   * Record a commission payout to an agent — a THIRD ledger row (negative, reducing the
   * owed balance). Finance-authorised (commission:payout via commission:*).
   *
   * FOUNDER DEPENDENCY (flagged, not a code task): the agent agreement must be SIGNED
   * before the first payout. That gate is a business/legal artefact, not enforced here.
   */
  async recordPayout(actor: Actor, input: { agentId: string; orderRef: string; amountMinor: Minor }) {
    await this.authz.authorize(actor, 'commission', 'payout');
    return this.prisma.commissionEntry.create({
      data: {
        agentId: input.agentId,
        orderRef: input.orderRef,
        amountMinor: -Math.abs(input.amountMinor),
        type: 'payout',
      },
    });
  }

  /** The running balance owed to an agent — the signed sum of their ledger rows. */
  async balanceFor(actor: Actor, agentId: string) {
    await this.authz.authorize(actor, 'commission', 'read', { agentId });
    const rows = await this.prisma.commissionEntry.findMany({ where: { agentId } });
    const balanceMinor = rows.reduce((a, r) => a + r.amountMinor, 0) as Minor;
    return { agentId, balanceMinor, entries: rows.length };
  }

  /** The full ledger for an agent — the answer to any commission dispute. */
  async ledgerFor(actor: Actor, agentId: string) {
    await this.authz.authorize(actor, 'commission', 'read', { agentId });
    return this.prisma.commissionEntry.findMany({
      where: { agentId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** The commission a confirmation payment accrues: 2% of the order total. */
  static accrualFor(totalMinor: Minor): Minor {
    return pct(totalMinor, COMMISSION_RATE);
  }
}
