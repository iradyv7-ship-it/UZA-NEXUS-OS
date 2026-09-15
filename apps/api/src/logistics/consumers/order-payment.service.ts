import { Injectable } from '@nestjs/common';
import type { EventEnvelope } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { FULLY_PAID_FRACTION } from '../logistics-policy';

const PAYMENT_VERIFIED_CONSUMER = 'logistics.payment-verified';

/**
 * Locally-projected order payment state, built by consuming finance's `payment.verified`.
 *
 * The charter is explicit: mirror finance's release-eligibility determination from the
 * EVENTS we consume, never by reading finance's tables. This projection is the single
 * source logistics reads for booking gate 2 (pre-loading installment paid) and the
 * release gate (full payment, CF-028).
 *
 * Idempotent on eventId via ProcessedEvent (consumer `logistics.payment-verified`): a
 * redelivered payment.verified cannot double-record a trigger.
 */
@Injectable()
export class OrderPaymentService {
  constructor(private readonly prisma: PrismaService) {}

  async handlePaymentVerified(envelope: EventEnvelope<'payment.verified'>) {
    const already = await this.prisma.processedEvent.findUnique({
      where: {
        eventId_consumer: { eventId: envelope.eventId, consumer: PAYMENT_VERIFIED_CONSUMER },
      },
    });
    if (already) return { status: 'duplicate' as const, orderRef: envelope.payload.orderRef };

    const { orderRef, trigger, paidFraction } = envelope.payload;

    return this.prisma.$transaction(async (tx) => {
      await tx.processedEvent.create({
        data: { eventId: envelope.eventId, consumer: PAYMENT_VERIFIED_CONSUMER },
      });

      const existing = await tx.orderPaymentState.findUnique({ where: { orderRef } });
      const triggers = new Set(existing?.paidTriggers ?? []);
      triggers.add(trigger);
      // paidFraction is cumulative in the payload; keep the greatest seen so a
      // late/duplicate lower value can never regress the projection.
      const fraction = Math.max(existing?.paidFraction ?? 0, paidFraction);

      await tx.orderPaymentState.upsert({
        where: { orderRef },
        create: { orderRef, paidFraction: fraction, paidTriggers: [...triggers] },
        update: { paidFraction: fraction, paidTriggers: [...triggers] },
      });

      return { status: 'recorded' as const, orderRef, trigger, paidFraction: fraction };
    });
  }

  /** Booking gate 2 reads this: is the pre-loading installment settled for the order? */
  async isPreLoadingPaid(orderRef: string): Promise<boolean> {
    const state = await this.prisma.orderPaymentState.findUnique({ where: { orderRef } });
    if (!state) return false;
    // A 'new'-tier client pays 50/50 (confirmation/pre_loading); reaching the pre_loading
    // trigger OR a cumulative fraction that has crossed the confirmation split both settle
    // the pre-loading obligation. The trigger set is the authoritative signal.
    return state.paidTriggers.includes('pre_loading');
  }

  /** Release gate (CF-028): is the order FULLY paid? */
  async releaseEligibility(orderRef: string) {
    const state = await this.prisma.orderPaymentState.findUnique({ where: { orderRef } });
    const paidFraction = state?.paidFraction ?? 0;
    const fullyPaid = paidFraction >= FULLY_PAID_FRACTION;
    return {
      orderRef,
      fullyPaid,
      paidFraction,
      outstandingFraction: fullyPaid
        ? 0
        : Math.round((FULLY_PAID_FRACTION - paidFraction) * 10000) / 10000,
      paidTriggers: state?.paidTriggers ?? [],
    };
  }
}
