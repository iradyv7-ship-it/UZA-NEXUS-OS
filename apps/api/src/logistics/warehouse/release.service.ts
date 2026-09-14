import { BadRequestException, Injectable } from '@nestjs/common';
import { UzaError, type Actor, type Destination } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../platform/authorization/authorization.service';
import { QualityGateService } from '../consumers/quality-gate.service';

export type CargoTypeValue = 'CONSOLIDATED' | 'LOOSE';

export interface CargoDetailsInput {
  readonly cargoType?: CargoTypeValue;
  /** Minor units. Required (>0) once the package is/becomes LOOSE — this is a real
   *  sellable line (customer pays `pricePerCbmMinor * cbm`), not the internal revenueTon
   *  cost-allocation number, which is untouched by this method. */
  readonly pricePerCbmMinor?: number;
  readonly photoUrl?: string;
  readonly goodsDescription?: string;
}

/** `pricePerCbmMinor * cbm`, rounded to the nearest minor unit — the LOOSE-cargo sellable
 *  line total. Exported so it can be unit-tested without a database. */
export const looseCargoPriceMinor = (pricePerCbmMinor: number, cbm: number): number =>
  Math.round(pricePerCbmMinor * cbm);

/**
 * QC release and destination allocation.
 *
 * THE most important rule of this sprint (CF-014): `qcReleased` and `varianceHold` are two
 * SEPARATE fields. Releasing QC here flips ONLY qcReleased. It must never clear a
 * commercial hold — collapsing the two once let unresolved goods sail. This service is
 * written to make that collapse structurally impossible: it never writes varianceHold.
 */
@Injectable()
export class ReleaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
    private readonly qualityGate: QualityGateService,
  ) {}

  /**
   * Release packages for loading. The QC half of the gate: a package on a PO whose latest
   * inspection failed cannot be released (`GATE_QC_NOT_RELEASED`). On success flips
   * `qcReleased=true` and moves the zone to READY_FOR_LOADING — and touches nothing else.
   * varianceHold is deliberately left exactly as it was.
   */
  async qcRelease(actor: Actor, packageRefs: readonly string[]) {
    await this.authz.authorize(actor, 'package', 'update');

    const packages = await this.prisma.package.findMany({
      where: { ref: { in: [...packageRefs] } },
    });
    if (packages.length !== packageRefs.length) {
      const found = new Set(packages.map((p) => p.ref));
      const missing = packageRefs.filter((r) => !found.has(r));
      throw new UzaError({
        code: 'GATE_QC_NOT_RELEASED',
        message: `Unknown package(s): ${missing.join(', ')}`,
        responsibleRole: actor.role,
      });
    }

    // QC half: quality must not be blocking any PO behind these packages.
    await this.qualityGate.assertReleasable(packages.map((p) => p.poRef));

    await this.prisma.package.updateMany({
      where: { ref: { in: [...packageRefs] } },
      // NOTE: varianceHold is intentionally NOT in this update (CF-014).
      data: { qcReleased: true, zone: 'READY_FOR_LOADING' },
    });

    return this.prisma.package.findMany({ where: { ref: { in: [...packageRefs] } } });
  }

  /**
   * Assign a physical destination to packages. Sets `destination` only; the WarehouseZone
   * stays a physical-staging value (the contract enum has no per-city zones), so a
   * destination is never smuggled into the zone column.
   */
  async allocateDestination(
    actor: Actor,
    packageRefs: readonly string[],
    destination: Destination,
  ) {
    await this.authz.authorize(actor, 'package', 'update');
    await this.prisma.package.updateMany({
      where: { ref: { in: [...packageRefs] } },
      data: { destination },
    });
    return this.prisma.package.findMany({ where: { ref: { in: [...packageRefs] } } });
  }

  /**
   * Packages ready to load: QC-released, no commercial hold, a destination assigned, and not
   * already on a shipment — exactly the set `ContainerService.createShipment`'s three gates
   * would accept. Added so an ops workspace (item 5 of the 2026-09-14 gap-closure audit) has
   * a real list to build a booking form from, instead of requiring package refs to be typed
   * in blind. Read-only; touches nothing.
   */
  async listLoadable(actor: Actor, destination?: Destination) {
    await this.authz.authorize(actor, 'package', 'read');
    return this.prisma.package.findMany({
      where: {
        qcReleased: true,
        varianceHold: false,
        shipmentRef: null,
        destination: destination ? destination : { not: null },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * The LOOSE-cargo customer-facing sellable line (2026-09-14 gap-closure audit, item 3):
   * cargo type, price-per-CBM, a photo, and a goods description. Deliberately separate from
   * the freight cost-allocation math in `FreightService` (`revenueTon`/`freightPaidMinor`),
   * which is never touched here — this is what the customer is SOLD, not what forwarding
   * costs UZA.
   */
  async setCargoDetails(actor: Actor, packageRef: string, input: CargoDetailsInput) {
    await this.authz.authorize(actor, 'package', 'update');

    const existing = await this.prisma.package.findUnique({ where: { ref: packageRef } });
    if (!existing) {
      throw new BadRequestException(`package ${packageRef} not found`);
    }

    const cargoType = input.cargoType ?? existing.cargoType;
    const pricePerCbmMinor = input.pricePerCbmMinor ?? existing.pricePerCbmMinor ?? undefined;
    if (cargoType === 'LOOSE' && (pricePerCbmMinor === undefined || pricePerCbmMinor <= 0)) {
      throw new BadRequestException(
        'A LOOSE-cargo package needs a positive pricePerCbmMinor before it can be sold.',
      );
    }

    const updated = await this.prisma.package.update({
      where: { ref: packageRef },
      data: {
        ...(input.cargoType !== undefined ? { cargoType: input.cargoType } : {}),
        ...(input.pricePerCbmMinor !== undefined
          ? { pricePerCbmMinor: input.pricePerCbmMinor }
          : {}),
        ...(input.photoUrl !== undefined ? { photoUrl: input.photoUrl } : {}),
        ...(input.goodsDescription !== undefined
          ? { goodsDescription: input.goodsDescription }
          : {}),
      },
    });

    return {
      ...updated,
      // Present only for LOOSE cargo with a price set — never a claim about consolidated
      // orders, which are priced through the quotation/order chain instead.
      looseCargoPriceMinor:
        updated.cargoType === 'LOOSE' && updated.pricePerCbmMinor !== null
          ? looseCargoPriceMinor(updated.pricePerCbmMinor, updated.cbm)
          : null,
    };
  }
}
