import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Actor } from '@uza/contracts';
import { nextSequence } from '../../platform/ids/next-sequence';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../platform/authorization/authorization.service';
import { consigneeRef as makeConsigneeRef } from '../logistics-ids';

export interface ConsigneeInput {
  readonly name: string;
  readonly phone: string;
  readonly address: string;
  readonly tinNumber?: string;
  readonly email?: string;
}

/**
 * The receiving party for a Package/Shipment's communications — a real record, distinct
 * from (and often different to) the ordering `Customer` (2026-09-14 gap-closure audit, item
 * 2). No shared `consignee` resource exists in @uza/contracts ROLE_GRANTS, so authorisation
 * is deliberately anchored on the resource being TOUCHED (`package:update` /
 * `shipment:create`, the existing mutation grants for those aggregates) rather than
 * inventing a new grant here — the same reasoning `ReleaseService.allocateDestination` uses
 * for a Package sub-field.
 */
@Injectable()
export class ConsigneeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
  ) {}

  async create(actor: Actor, input: ConsigneeInput) {
    await this.authz.authorize(actor, 'package', 'update');

    const name = input.name.trim();
    const phone = input.phone.trim();
    const address = input.address.trim();
    if (!name || !phone || !address) {
      // A plain input-validation failure, not a gate — `UzaErrorCode` is a closed union of
      // the gate/authorisation taxonomy in @uza/contracts and deliberately not extended here.
      throw new BadRequestException('A consignee needs a name, phone and address.');
    }

    const seq = await nextSequence(this.prisma.consignee, (n) => makeConsigneeRef(n));
    const ref = makeConsigneeRef(seq);
    return this.prisma.consignee.create({
      data: {
        ref,
        name,
        phone,
        address,
        tinNumber: input.tinNumber?.trim() || null,
        email: input.email?.trim() || null,
      },
    });
  }

  async read(actor: Actor, ref: string) {
    await this.authz.authorize(actor, 'package', 'update');
    const consignee = await this.prisma.consignee.findUnique({ where: { ref } });
    if (!consignee) throw new NotFoundException(`consignee ${ref} not found`);
    return consignee;
  }

  /** Attach an existing consignee to a package — the receiving party for THAT package's
   *  communications, independent of the shipment it eventually travels on. */
  async attachToPackage(actor: Actor, packageRef: string, consigneeRef: string) {
    await this.authz.authorize(actor, 'package', 'update');
    await this.assertConsigneeExists(consigneeRef);
    const pkg = await this.prisma.package.findUnique({ where: { ref: packageRef } });
    if (!pkg) throw new NotFoundException(`package ${packageRef} not found`);
    return this.prisma.package.update({ where: { ref: packageRef }, data: { consigneeRef } });
  }

  /** Attach an existing consignee to a shipment as the DEFAULT receiving party for packages
   *  on it that don't carry their own. Mutating an existing shipment reuses `shipment:create`
   *  — the same authorisation this module already uses for shipment mutations after booking
   *  (TrackingService.delayShipment, FreightService.recordBilledWeight). */
  async attachToShipment(actor: Actor, shipmentRef: string, consigneeRef: string) {
    await this.authz.authorize(actor, 'shipment', 'create');
    await this.assertConsigneeExists(consigneeRef);
    const shipment = await this.prisma.shipment.findUnique({ where: { ref: shipmentRef } });
    if (!shipment) throw new NotFoundException(`shipment ${shipmentRef} not found`);
    return this.prisma.shipment.update({ where: { ref: shipmentRef }, data: { consigneeRef } });
  }

  private async assertConsigneeExists(ref: string): Promise<void> {
    const found = await this.prisma.consignee.findUnique({ where: { ref } });
    if (!found) throw new NotFoundException(`consignee ${ref} not found`);
  }
}
