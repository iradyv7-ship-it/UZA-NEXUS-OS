import { Injectable } from '@nestjs/common';
import { UzaError, type Actor, type Destination } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../platform/authorization/authorization.service';
import { QualityGateService } from '../consumers/quality-gate.service';

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
}
