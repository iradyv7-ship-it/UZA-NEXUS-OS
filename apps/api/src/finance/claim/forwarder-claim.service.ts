import { Injectable, NotFoundException } from '@nestjs/common';
import { BILLING_CLAIM_THRESHOLD, type Actor, type EventEnvelope } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../platform/authorization/authorization.service';
import { NotificationService } from '../../platform/notification/notification.service';
import { claimRef } from '../finance-ids';

const BILLED_WEIGHT_CONSUMER = 'finance.billed-weight';

/**
 * Forwarder freight claims. Volumetrics are three numbers, never one: declared (factory),
 * measured (François), billed (forwarder). Measured-vs-billed is OUR problem with the
 * FORWARDER, never a client conversation (CF-020): when the forwarder bills more than
 * measured beyond `BILLING_CLAIM_THRESHOLD`, finance raises a claim and is notified.
 *
 * Consumes logistics' `shipment.billedWeightRecorded` (Sprint 3), idempotent on eventId.
 */
@Injectable()
export class ForwarderClaimService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
    private readonly notify: NotificationService,
  ) {}

  /**
   * The pure determination (CF-020): is a claim warranted, and by how much? Billed over
   * measured beyond the policy threshold. Kept as its own function so the boundary is
   * defined once — the handler and the web claim screen read the same rule.
   */
  static assess(measuredRevenueTon: number, billedRevenueTon: number) {
    const warranted = billedRevenueTon > measuredRevenueTon * (1 + BILLING_CLAIM_THRESHOLD);
    const overRevenueTon = round3(billedRevenueTon - measuredRevenueTon);
    return { warranted, overRevenueTon };
  }

  /**
   * Consume `shipment.billedWeightRecorded`. When the billing is over threshold, raise a
   * ForwarderClaim and notify finance. Idempotent on eventId (ProcessedEvent + the unique
   * sourceEventId column). A billing within tolerance is recorded as processed, no claim.
   */
  async handleBilledWeightRecorded(envelope: EventEnvelope<'shipment.billedWeightRecorded'>) {
    const already = await this.prisma.processedEvent.findUnique({
      where: { eventId_consumer: { eventId: envelope.eventId, consumer: BILLED_WEIGHT_CONSUMER } },
    });
    if (already) return { status: 'duplicate' as const, shipmentRef: envelope.payload.shipmentRef };

    const { shipmentRef, measuredRevenueTon, billedRevenueTon, freightPaidMinor } = envelope.payload;
    const { warranted, overRevenueTon } = ForwarderClaimService.assess(measuredRevenueTon, billedRevenueTon);

    return this.prisma.$transaction(async (tx) => {
      await tx.processedEvent.create({
        data: { eventId: envelope.eventId, consumer: BILLED_WEIGHT_CONSUMER },
      });

      if (!warranted) {
        return { status: 'within_tolerance' as const, shipmentRef, overRevenueTon };
      }

      const seq = (await tx.forwarderClaim.count()) + 1;
      const ref = claimRef(seq);
      await tx.forwarderClaim.create({
        data: {
          ref,
          shipmentRef,
          measuredRevenueTon,
          billedRevenueTon,
          overRevenueTon,
          freightPaidMinor: freightPaidMinor ?? null,
          sourceEventId: envelope.eventId,
        },
      });
      await this.notify.dispatch(
        shipmentRef,
        {
          audience: 'finance',
          recipientId: 'finance',
          body: `Forwarder billed ${billedRevenueTon} RT vs ${measuredRevenueTon} measured on ${shipmentRef}; claim ${ref} raised`,
        },
        tx,
      );
      return { status: 'claim_raised' as const, shipmentRef, claimRef: ref, overRevenueTon };
    });
  }

  async read(actor: Actor, ref: string) {
    await this.authz.authorize(actor, 'claim', 'read');
    const claim = await this.prisma.forwarderClaim.findUnique({ where: { ref } });
    if (!claim) throw new NotFoundException(`claim ${ref} not found`);
    return claim;
  }

  /** Move a claim through its recovery lifecycle (finance-only via claim:*). */
  async setStatus(actor: Actor, ref: string, status: 'submitted' | 'recovered' | 'written_off') {
    await this.authz.authorize(actor, 'claim', 'update');
    const claim = await this.prisma.forwarderClaim.findUnique({ where: { ref } });
    if (!claim) throw new NotFoundException(`claim ${ref} not found`);
    return this.prisma.forwarderClaim.update({ where: { ref }, data: { status } });
  }
}

const round3 = (n: number): number => Math.round(n * 1000) / 1000;
