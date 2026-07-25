import { Injectable, NotFoundException } from '@nestjs/common';
import {
  PAYMENT_SCHEDULES,
  splitInstallments,
  type Actor,
  type EventEnvelope,
  type Minor,
} from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../platform/authorization/authorization.service';
import { invoiceRef, installmentRef } from '../finance-ids';

const ORDER_CREATED_CONSUMER = 'finance.order-created';

/**
 * Invoices — the money head of the corridor. Finance OWNS the invoice: it is created by
 * consuming trade's `order.created`, never by trade. The finance-side installment
 * schedule is derived LOCALLY from the event payload (scheduleFor + splitInstallments —
 * the same deterministic policy trade used) so payments are validated against named,
 * expected amounts without ever reading trade's Installment table.
 *
 * The `order.created` handler is idempotent on eventId via ProcessedEvent AND on the
 * unique `sourceEventId`/`orderRef` columns — a redelivered event cannot double-invoice.
 */
@Injectable()
export class InvoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
  ) {}

  /**
   * Consume `order.created` → create the Invoice and the finance-side installment
   * schedule. No event is published (invoicing is a private consequence of an order).
   * Idempotent: a redelivered event is a no-op.
   */
  async handleOrderCreated(envelope: EventEnvelope<'order.created'>) {
    const already = await this.prisma.processedEvent.findUnique({
      where: { eventId_consumer: { eventId: envelope.eventId, consumer: ORDER_CREATED_CONSUMER } },
    });
    if (already) return { status: 'duplicate' as const, orderRef: envelope.payload.orderRef };

    const { orderRef, customerRef, agentId, totalMinor, tier } = envelope.payload;

    return this.prisma.$transaction(async (tx) => {
      await tx.processedEvent.create({
        data: { eventId: envelope.eventId, consumer: ORDER_CREATED_CONSUMER },
      });

      // Derive the schedule independently — the SAME policy trade applied to the order.
      // The tier arrives on the event, so the schedule is read straight from policy.
      const schedule = PAYMENT_SCHEDULES[tier];
      const parts = splitInstallments(totalMinor, schedule);

      const seq = (await tx.invoice.count()) + 1;
      const ref = invoiceRef(seq);
      const invoice = await tx.invoice.create({
        data: {
          ref,
          orderRef,
          customerRef,
          agentId: agentId || null,
          totalMinor,
          tier,
          sourceEventId: envelope.eventId,
        },
      });

      for (const part of parts) {
        await tx.invoiceInstallment.create({
          data: {
            ref: installmentRef(orderRef, part.trigger),
            invoiceRef: ref,
            orderRef,
            trigger: part.trigger,
            pct: part.pct,
            amountMinor: part.amountMinor,
          },
        });
      }

      return { status: 'invoiced' as const, invoiceRef: ref, orderRef, installments: parts.length };
    });
  }

  async read(actor: Actor, ref: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { ref },
      include: { installments: true },
    });
    if (!invoice) throw new NotFoundException(`invoice ${ref} not found`);
    await this.authz.authorize(actor, 'invoice', 'read', {
      customerId: invoice.customerRef,
      agentId: invoice.agentId ?? undefined,
    });
    return this.authz.mask(actor, { ...invoice });
  }

  /**
   * CF-028 — goods release requires FULL payment (not delivery, release). This is the
   * fully-paid determination logistics' delivery step will read in Sprint 3. An order is
   * release-eligible only when every finance installment is settled; otherwise the
   * outstanding balance and the unsettled triggers are named so a human can act.
   */
  async releaseEligibility(actor: Actor, orderRef: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { orderRef },
      include: { installments: true },
    });
    if (!invoice) throw new NotFoundException(`invoice for order ${orderRef} not found`);
    await this.authz.authorize(actor, 'invoice', 'read', {
      customerId: invoice.customerRef,
      agentId: invoice.agentId ?? undefined,
    });

    const outstanding = invoice.installments.filter((i) => i.status !== 'settled');
    const outstandingMinor = outstanding.reduce((a, i) => a + i.amountMinor, 0) as Minor;
    return {
      orderRef,
      invoiceRef: invoice.ref,
      fullyPaid: outstanding.length === 0,
      outstandingMinor,
      outstandingTriggers: outstanding.map((i) => i.trigger),
    };
  }
}
