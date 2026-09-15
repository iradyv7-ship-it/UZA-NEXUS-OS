import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Actor } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../platform/authorization/authorization.service';
import { ContainerService, type EntryPortValue } from './container.service';
import { shipmentTiming, type ShipmentTiming } from './shipment-timing';

export interface UpdateShipmentDetailsInput {
  readonly vesselName?: string;
  readonly voyageNumber?: string;
  readonly entryPort?: EntryPortValue;
  /** Confirmed actual departure/arrival — NEVER written to the `*Planned` columns. */
  readonly etdActual?: string;
  readonly etaActual?: string;
  /** A correction to the container number after booking (the carrier swapped it, a typo is
   *  fixed, etc). Re-fires the container-confirmed fan-out (item 6) exactly like booking
   *  did, so client/customer-care are never left looking at a stale container number. */
  readonly container?: string;
  readonly ventureCode?: string;
}

/**
 * Operational shipment detail updates — vessel/voyage, entry port, actual dates, venture
 * tag, and container corrections. Split out from `ContainerService` deliberately (2026-09-14
 * gap-closure audit): the three booking gates in `ContainerService.createShipment` are NOT
 * touched by this file, only the data they operate on is extended.
 *
 * Authorisation reuses `shipment:create` — the existing convention for shipment mutations
 * after booking (`TrackingService.delayShipment`, `FreightService.recordBilledWeight`). Only
 * `venture_manager`/`ceo` hold it today; see
 * docs/contract-requests/2026-09-14-logistics-coordinator-role.md for the internal ops role
 * this should move to.
 */
@Injectable()
export class ShipmentDetailsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
    private readonly containers: ContainerService,
  ) {}

  async updateDetails(actor: Actor, shipmentRef: string, patch: UpdateShipmentDetailsInput) {
    await this.authz.authorize(actor, 'shipment', 'create');

    const shipment = await this.prisma.shipment.findUnique({ where: { ref: shipmentRef } });
    if (!shipment) throw new NotFoundException(`shipment ${shipmentRef} not found`);

    const nextContainer = patch.container?.trim();
    if (patch.container !== undefined && !nextContainer) {
      throw new BadRequestException('container cannot be blank');
    }
    const containerChanged =
      nextContainer !== undefined && nextContainer !== shipment.container;

    const updated = await this.prisma.shipment.update({
      where: { ref: shipmentRef },
      data: {
        ...(patch.vesselName !== undefined ? { vesselName: patch.vesselName } : {}),
        ...(patch.voyageNumber !== undefined ? { voyageNumber: patch.voyageNumber } : {}),
        ...(patch.entryPort !== undefined ? { entryPort: patch.entryPort } : {}),
        // Actual dates only — `etdPlanned`/`etaPlanned` are never written here (planned vs
        // actual discipline; a delay that revises the PLAN goes through
        // TrackingService.delayShipment instead).
        ...(patch.etdActual !== undefined ? { etdActual: patch.etdActual } : {}),
        ...(patch.etaActual !== undefined ? { etaActual: patch.etaActual } : {}),
        ...(containerChanged ? { container: nextContainer } : {}),
        ...(patch.ventureCode !== undefined ? { ventureCode: patch.ventureCode } : {}),
      },
    });

    if (containerChanged) {
      const packages = await this.prisma.package.findMany({ where: { shipmentRef } });
      await this.containers.notifyContainerConfirmed(updated, packages, updated.destination);
    }

    return updated;
  }

  /** The shipment plus its derived departure/arrival/transit-time — never persisted, always
   *  computed from the planned/actual pair (see shipment-timing.ts). */
  async readWithTiming(
    actor: Actor,
    shipmentRef: string,
  ): Promise<{ shipment: unknown; timing: ShipmentTiming }> {
    await this.authz.authorize(actor, 'shipment', 'read');
    const shipment = await this.prisma.shipment.findUnique({ where: { ref: shipmentRef } });
    if (!shipment) throw new NotFoundException(`shipment ${shipmentRef} not found`);
    return { shipment, timing: shipmentTiming(shipment) };
  }
}
