import { Injectable, NotFoundException } from '@nestjs/common';
import { type Actor } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../platform/authorization/authorization.service';

/**
 * The Imari partner portal. A `logistics_partner` sees ONLY the shipments assigned to it
 * (scope.shipmentRefs) and NOTHING behind them — never cost.
 *
 * Enforcement is `authorize()` (role + scope via inScope) + masking, NOT by omitting
 * fields from a DTO. Weight/CBM and shipment/package/delivery reach the partner; freight
 * cost is masked.
 *
 * @uza/contracts CONFIDENTIAL_FIELDS masks supplier cost / margins AND the shipment freight
 * figures (freightPaidMinor, billed/measured revenue ton), added from the accepted
 * contract-request 2026-07-26-partner-freight-mask.md. So authz.mask alone masks cost for a
 * logistics_partner — no local override needed.
 */
@Injectable()
export class PartnerPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
  ) {}

  /** Cost masking is entirely driven by @uza/contracts CONFIDENTIAL_FIELDS + maskFields. */
  private maskForPartner<T extends Record<string, unknown>>(actor: Actor, record: T) {
    return this.authz.mask(actor, record);
  }

  async readShipment(actor: Actor, shipmentRef: string) {
    const shipment = await this.prisma.shipment.findUnique({ where: { ref: shipmentRef } });
    if (!shipment) throw new NotFoundException(`shipment ${shipmentRef} not found`);
    await this.authz.authorize(actor, 'shipment', 'read', { shipmentRef, kind: 'shipment', ref: shipmentRef });
    return this.maskForPartner(actor, shipment);
  }

  async readPackages(actor: Actor, shipmentRef: string) {
    // Scope on the shipment the packages belong to.
    await this.authz.authorize(actor, 'package', 'read', { shipmentRef, kind: 'shipment', ref: shipmentRef });
    const packages = await this.prisma.package.findMany({ where: { shipmentRef } });
    return packages.map((p) => this.maskForPartner(actor, p));
  }

  async readDelivery(actor: Actor, shipmentRef: string) {
    await this.authz.authorize(actor, 'delivery', 'read', { shipmentRef, kind: 'shipment', ref: shipmentRef });
    const delivery = await this.prisma.delivery.findFirst({ where: { shipmentRef } });
    if (!delivery) throw new NotFoundException(`no delivery for shipment ${shipmentRef}`);
    return this.maskForPartner(actor, delivery);
  }
}
