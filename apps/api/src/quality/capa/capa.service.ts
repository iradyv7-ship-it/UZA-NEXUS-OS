import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { UzaError, type Actor } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../platform/authorization/authorization.service';
import { OutboxService } from '../../platform/outbox/outbox.service';

/**
 * CAPAs — corrective/preventive actions opened automatically when an inspection fails on
 * a critical defect (InspectionService owns the auto-open). This service handles the two
 * things a human/AI does afterwards:
 *
 *  - `draftCorrectiveAction`: AI or a person may DRAFT the corrective action and submit
 *    evidence. This never closes the CAPA.
 *  - `close`: a human closes the CAPA, and ONLY against a PASSING reinspection. AI may not
 *    close it — closure is gated on `capa:approve`, held by china_sourcing and ceo. A
 *    failed reinspection is rejected with CAPA_REINSPECTION_FAILED. Closing publishes
 *    `capa.closed`.
 */
@Injectable()
export class CapaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
    private readonly outbox: OutboxService,
  ) {}

  /** AI or a person drafts the corrective action. Does NOT close the CAPA. */
  async draftCorrectiveAction(actor: Actor, capaRef: string, text: string, draftedBy: string) {
    await this.authz.authorize(actor, 'capa', 'update');
    const capa = await this.prisma.capa.findUnique({ where: { ref: capaRef } });
    if (!capa) throw new NotFoundException(`capa ${capaRef} not found`);
    if (capa.status === 'closed') {
      throw new BadRequestException(`capa ${capaRef} is already closed`);
    }
    return this.prisma.capa.update({
      where: { ref: capaRef },
      data: { correctiveAction: text, draftedBy, status: 'evidence_submitted' },
    });
  }

  /**
   * Close a CAPA against a passing reinspection. Human-only (capa:approve). The
   * reinspection must have result 'pass' and must not be the failing inspection that
   * opened the CAPA.
   *
   * @throws UzaError CAPA_REINSPECTION_FAILED when the reinspection did not pass.
   */
  async close(actor: Actor, capaRef: string, reinspectionRef: string) {
    await this.authz.authorize(actor, 'capa', 'approve');

    const capa = await this.prisma.capa.findUnique({ where: { ref: capaRef } });
    if (!capa) throw new NotFoundException(`capa ${capaRef} not found`);
    if (capa.status === 'closed') {
      throw new BadRequestException(`capa ${capaRef} is already closed`);
    }

    const reinspection = await this.prisma.inspection.findUnique({
      where: { ref: reinspectionRef },
    });
    if (!reinspection) throw new NotFoundException(`reinspection ${reinspectionRef} not found`);
    if (reinspection.ref === capa.inspectionRef) {
      throw new BadRequestException('a CAPA cannot close against the inspection that opened it');
    }

    if (reinspection.result !== 'pass') {
      throw new UzaError({
        code: 'CAPA_REINSPECTION_FAILED',
        responsibleRole: 'china_sourcing',
        context: { capaRef, reinspectionRef, result: reinspection.result },
      });
    }

    return this.outbox.emit(actor.userId, async (tx, emit) => {
      const closed = await tx.capa.update({
        where: { ref: capaRef },
        data: {
          status: 'closed',
          closedByReinspectionRef: reinspectionRef,
          closedBy: actor.userId,
          closedAt: new Date(),
        },
      });
      await emit('capa.closed', { capaRef, supplierRef: capa.supplierRef });
      return closed;
    });
  }

  async read(actor: Actor, ref: string) {
    await this.authz.authorize(actor, 'capa', 'read');
    const capa = await this.prisma.capa.findUnique({ where: { ref } });
    if (!capa) throw new NotFoundException(`capa ${ref} not found`);
    return capa;
  }
}
