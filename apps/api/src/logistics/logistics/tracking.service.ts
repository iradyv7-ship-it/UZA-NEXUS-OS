import { Injectable, NotFoundException } from '@nestjs/common';
import type { Actor, TrackingSource, NotificationAudience } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../platform/authorization/authorization.service';
import { OutboxService } from '../../platform/outbox/outbox.service';
import { NotificationService } from '../../platform/notification/notification.service';
import { trackingRef } from '../logistics-ids';

/** Optional real recipient ids for a delay fan-out; unknown ones fall back to the role label. */
export interface DelayParties {
  readonly agentId?: string;
  readonly ownerId?: string;
  readonly frontOfficeId?: string;
}

const CONFIRMED_SOURCES: readonly TrackingSource[] = ['carrier', 'partner', 'uza'];

/**
 * Tracking and delay.
 *
 * CF-022 — every tracking event declares its provenance: carrier / partner / uza are
 * CONFIRMED; estimated is not. `confirmed` is derived from the source so a customer-facing
 * read can never present an estimate as fact.
 *
 * CF-023 — a delay fans out to FIVE distinct parties (client, agent, owner, front office,
 * partner), each a role-appropriate message, via NotificationService — and publishes
 * `shipment.delayed`.
 */
@Injectable()
export class TrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
    private readonly outbox: OutboxService,
    private readonly notify: NotificationService,
  ) {}

  static isConfirmed(source: TrackingSource): boolean {
    return CONFIRMED_SOURCES.includes(source);
  }

  async track(
    actor: Actor,
    shipmentRef: string,
    milestone: string,
    source: TrackingSource,
    occurredAt?: Date,
    note?: string,
  ) {
    await this.authz.authorize(actor, 'shipment', 'read');
    const shipment = await this.prisma.shipment.findUnique({ where: { ref: shipmentRef } });
    if (!shipment) throw new NotFoundException(`shipment ${shipmentRef} not found`);

    const seq = (await this.prisma.trackingEvent.count()) + 1;
    const event = await this.prisma.trackingEvent.create({
      data: {
        ref: trackingRef(seq),
        shipmentRef,
        milestone,
        source,
        occurredAt: occurredAt ?? new Date(),
        note: note ?? null,
      },
    });
    return { ...event, confirmed: TrackingService.isConfirmed(source) };
  }

  /** Timeline for a shipment, each event tagged confirmed vs estimated (CF-022). */
  async timeline(actor: Actor, shipmentRef: string) {
    await this.authz.authorize(actor, 'shipment', 'read');
    const events = await this.prisma.trackingEvent.findMany({
      where: { shipmentRef },
      orderBy: { occurredAt: 'asc' },
    });
    return events.map((e) => ({ ...e, confirmed: TrackingService.isConfirmed(e.source) }));
  }

  /**
   * Delay a shipment: update the ETA + status, publish `shipment.delayed`, and fan out to
   * the five affected parties, each in their own role (CF-023).
   */
  async delayShipment(
    actor: Actor,
    shipmentRef: string,
    newEta: string,
    reason: string,
    parties: DelayParties = {},
  ) {
    await this.authz.authorize(actor, 'shipment', 'create');
    const shipment = await this.prisma.shipment.findUnique({ where: { ref: shipmentRef } });
    if (!shipment) throw new NotFoundException(`shipment ${shipmentRef} not found`);
    const oldEta = shipment.eta;

    const aPackage = await this.prisma.package.findFirst({ where: { shipmentRef } });
    const customerRef = aPackage?.customerRef ?? 'customer';

    const result = await this.outbox.emit(actor.userId, async (tx, emit) => {
      const updated = await tx.shipment.update({
        where: { ref: shipmentRef },
        data: { eta: newEta, status: 'delayed' },
      });
      await emit('shipment.delayed', { shipmentRef, oldEta, newEta, reason });
      return updated;
    });

    // Role-appropriate messages — one durable row per recipient, five distinct audiences.
    const targets: { audience: NotificationAudience; recipientId: string; body: string }[] = [
      {
        audience: 'customer',
        recipientId: customerRef,
        body: `Your shipment ${shipmentRef} is delayed. New ETA ${newEta}. We are on it.`,
      },
      {
        audience: 'agent',
        recipientId: parties.agentId ?? 'agent',
        body: `Shipment ${shipmentRef} for ${customerRef} delayed to ${newEta} (${reason}). Manage the client conversation.`,
      },
      {
        audience: 'project_owner',
        recipientId: parties.ownerId ?? 'project_owner',
        body: `Delay on ${shipmentRef}: ${oldEta} → ${newEta}. Reason: ${reason}. Review the plan.`,
      },
      {
        audience: 'front_office',
        recipientId: parties.frontOfficeId ?? 'front_office',
        body: `Front office: ${shipmentRef} delayed to ${newEta}. Expect a client call re ${reason}.`,
      },
      {
        audience: 'logistics_partner',
        recipientId: shipment.partnerId ?? 'logistics_partner',
        body: `Partner: ${shipmentRef} ETA moved to ${newEta}. Confirm downstream handling.`,
      },
    ];
    await this.notify.dispatchMany(shipmentRef, targets);

    return { shipment: result, notified: targets.map((t) => t.audience) };
  }
}
