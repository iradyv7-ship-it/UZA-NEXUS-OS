import { Injectable, NotFoundException } from '@nestjs/common';
import { BILLING_CLAIM_THRESHOLD, revenueTon, type Actor, type Minor } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../platform/authorization/authorization.service';
import { OutboxService } from '../../platform/outbox/outbox.service';
import { CONTAINER_RT_CAPACITY } from '../logistics-policy';

/**
 * Freight: the third of the three volumetric numbers (billed, from the forwarder) and the
 * pro-rata allocation of what we paid.
 *
 * `billedRevenueTon` is recorded ONTO the shipment without ever touching the measured
 * numbers on the packages. Measured-vs-billed is a claim against the FORWARDER, never a
 * client conversation — this service just publishes `shipment.billedWeightRecorded` with
 * the claim flag; finance owns raising the claim (CF-020).
 *
 * Freight allocates PRO-RATA by revenue ton = max(cbm, kg/1000), NOT by CBM (CF-021). The
 * per-order rows sum EXACTLY to freightPaidMinor (remainder to the last).
 */
@Injectable()
export class FreightService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
    private readonly outbox: OutboxService,
  ) {}

  /** The measured revenue ton of a shipment, from its packages' measured kg/cbm. */
  private async measuredRevenueTonOf(shipmentRef: string): Promise<number> {
    const packages = await this.prisma.package.findMany({ where: { shipmentRef } });
    const cbm = packages.reduce((a, p) => a + p.cbm, 0);
    const kg = packages.reduce((a, p) => a + p.kg, 0);
    return revenueTon(cbm, kg);
  }

  /**
   * Record what the forwarder actually charged. Stores the billed numbers on the shipment
   * (never overwriting measured), flags a claim when billed exceeds measured beyond
   * BILLING_CLAIM_THRESHOLD, and emits `shipment.billedWeightRecorded`.
   */
  async recordBilledWeight(actor: Actor, shipmentRef: string, billedRevenueTon: number, freightPaidMinor: Minor) {
    await this.authz.authorize(actor, 'shipment', 'create');
    const shipment = await this.prisma.shipment.findUnique({ where: { ref: shipmentRef } });
    if (!shipment) throw new NotFoundException(`shipment ${shipmentRef} not found`);

    const measuredRevenueTon = await this.measuredRevenueTonOf(shipmentRef);
    const claimRaised = billedRevenueTon > measuredRevenueTon * (1 + BILLING_CLAIM_THRESHOLD);

    return this.outbox.emit(actor.userId, async (tx, emit) => {
      await tx.shipment.update({
        where: { ref: shipmentRef },
        data: { billedRevenueTon, measuredRevenueTon, freightPaidMinor },
      });
      await emit('shipment.billedWeightRecorded', {
        shipmentRef,
        measuredRevenueTon,
        billedRevenueTon,
        freightPaidMinor,
        claimRaised,
      });
      return { shipmentRef, measuredRevenueTon, billedRevenueTon, claimRaised };
    });
  }

  /**
   * Allocate the freight we paid pro-rata by revenue ton across the orders on the
   * container, and keep a per-container P&L. Rows sum exactly to freightPaidMinor; the
   * residual against what customers were quoted is the consolidation profit measured at
   * reporting (needs trade's quoted freight, out of this module's scope — flagged).
   */
  async allocateFreight(actor: Actor, shipmentRef: string) {
    await this.authz.authorize(actor, 'shipment', 'create');
    const shipment = await this.prisma.shipment.findUnique({ where: { ref: shipmentRef } });
    if (!shipment) throw new NotFoundException(`shipment ${shipmentRef} not found`);
    if (shipment.freightPaidMinor === null) {
      throw new NotFoundException(`shipment ${shipmentRef} has no recorded freight paid; record billed weight first`);
    }
    const freightPaidMinor = shipment.freightPaidMinor;

    const packages = await this.prisma.package.findMany({ where: { shipmentRef } });
    const byOrder = new Map<string, { cbm: number; kg: number }>();
    for (const p of packages) {
      const agg = byOrder.get(p.orderRef) ?? { cbm: 0, kg: 0 };
      agg.cbm += p.cbm;
      agg.kg += p.kg;
      byOrder.set(p.orderRef, agg);
    }

    const orders = [...byOrder.entries()].map(([orderRef, agg]) => ({
      orderRef,
      revenueTon: revenueTon(agg.cbm, agg.kg),
    }));
    const totalRevenueTon = orders.reduce((a, o) => a + o.revenueTon, 0);

    // Pro-rata by revenue ton, integer minor units, remainder to the last (exact sum).
    let allocated = 0;
    const allocations = orders.map((o, i) => {
      const amountMinor =
        i === orders.length - 1
          ? freightPaidMinor - allocated
          : Math.round((freightPaidMinor * o.revenueTon) / totalRevenueTon);
      allocated += amountMinor;
      return { orderRef: o.orderRef, revenueTon: o.revenueTon, amountMinor };
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.freightAllocation.deleteMany({ where: { shipmentRef } });
      for (const a of allocations) {
        await tx.freightAllocation.create({
          data: { shipmentRef, orderRef: a.orderRef, revenueTon: a.revenueTon, amountMinor: a.amountMinor },
        });
      }
    });

    return {
      shipmentRef,
      freightPaidMinor,
      totalRevenueTon: round3(totalRevenueTon),
      containerUtilisation: round3(totalRevenueTon / CONTAINER_RT_CAPACITY),
      allocations,
    };
  }
}

const round3 = (n: number): number => Math.round(n * 1000) / 1000;
