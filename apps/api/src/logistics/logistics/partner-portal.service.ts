import { Injectable, NotFoundException } from '@nestjs/common';
import { MASK, type Actor } from '@uza/contracts';
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
 * @uza/contracts CONFIDENTIAL_FIELDS masks supplier cost / margins already, but freight
 * cost on the SHIPMENT (freightPaidMinor, billed/measured revenue ton) is not yet in that
 * map. A contract-request is filed (2026-07-25-partner-freight-mask.md); meanwhile this
 * service masks those keys locally for the partner, marked pending. Once the contract
 * lands this local override is deleted and authz.mask alone suffices.
 */
const LOGISTICS_CONFIDENTIAL: readonly string[] = [
  'freightPaidMinor',
  'billedRevenueTon',
  'measuredRevenueTon',
];

@Injectable()
export class PartnerPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
  ) {}

  /** Mask cost for a partner: contract masking first, then the pending freight-cost keys. */
  private maskForPartner<T extends Record<string, unknown>>(actor: Actor, record: T) {
    const masked = this.authz.mask(actor, record) as Record<string, unknown>;
    if (actor.role === 'logistics_partner') {
      for (const key of LOGISTICS_CONFIDENTIAL) {
        if (key in masked) masked[key] = MASK;
      }
    }
    return masked;
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
