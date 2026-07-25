import { Injectable, NotFoundException } from '@nestjs/common';
import { UzaError, type Actor } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../platform/authorization/authorization.service';
import { OutboxService } from '../../platform/outbox/outbox.service';
import { makeRef, COUNTRY, currentYear } from '../quality-ids';
import { findByClientRequestId } from '../sync';
import { gradeInspection } from '../thresholds';
import type { InspectionStage } from './inspection.types';

export interface EvidenceInput {
  readonly kind: 'photo' | 'video' | 'measurement';
  readonly uri: string;
  /** Evidence is stored bound to the lot + package it documents, never loose. */
  readonly lotRef?: string;
  readonly packageRef?: string;
  readonly note?: string;
}

export interface NewInspection {
  readonly visitRef: string;
  readonly stage: InspectionStage;
  readonly critical: number;
  readonly major: number;
  readonly minor: number;
  readonly evidence?: readonly EvidenceInput[];
  /** True when François captured on a phone with no signal and synced later. */
  readonly capturedOffline?: boolean;
  readonly clientRequestId?: string;
}

/**
 * Inspections — the quality gate. The result is DERIVED, never supplied:
 *   critical > 0 ⇒ fail (blocks release, NO override), major > 2 ⇒ conditional, else pass.
 *
 * Recording always publishes `inspection.recorded`. A FAIL additionally, in the SAME
 * transaction: auto-opens a CAPA and publishes `quality.failed` (which drives the project
 * red via its subscriber — Project is trade's aggregate, so quality signals rather than
 * writes it). Every inspection appends a SupplierQualityRecord to the supplier's quality
 * history. Evidence is stored bound to its lot + package refs.
 *
 * Offline-safe: a replayed clientRequestId returns the existing inspection and re-emits
 * nothing — a resynced capture cannot double-open a CAPA or double-publish a failure.
 */
@Injectable()
export class InspectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
    private readonly outbox: OutboxService,
  ) {}

  async record(actor: Actor, input: NewInspection) {
    await this.authz.authorize(actor, 'inspection', 'create');

    const existing = await findByClientRequestId(this.prisma.inspection, input.clientRequestId);
    if (existing) return { inspection: existing, capa: null, replayed: true as const };

    const visit = await this.prisma.visit.findUnique({ where: { ref: input.visitRef } });
    if (!visit) throw new NotFoundException(`visit ${input.visitRef} not found`);
    const po = await this.prisma.purchaseOrder.findUnique({ where: { ref: visit.poRef } });
    if (!po) throw new NotFoundException(`purchase order ${visit.poRef} not found`);

    const result = gradeInspection(input.critical, input.major);

    return this.outbox.emit(actor.userId, async (tx, emit) => {
      const seq = (await tx.inspection.count()) + 1;
      const ref = makeRef('inspection', { country: COUNTRY, year: currentYear(), seq });

      const inspection = await tx.inspection.create({
        data: {
          ref,
          visitRef: input.visitRef,
          poRef: visit.poRef,
          supplierRef: po.supplierRef,
          stage: input.stage,
          critical: input.critical,
          major: input.major,
          minor: input.minor,
          result,
          inspectorId: actor.userId,
          capturedOffline: input.capturedOffline ?? false,
          clientRequestId: input.clientRequestId ?? null,
        },
      });

      for (const e of input.evidence ?? []) {
        await tx.inspectionEvidence.create({
          data: {
            inspectionRef: ref,
            kind: e.kind,
            uri: e.uri,
            lotRef: e.lotRef ?? null,
            packageRef: e.packageRef ?? null,
            note: e.note ?? null,
          },
        });
      }

      // Quality history, denormalised onto the supplier (a competitive signal).
      await tx.supplierQualityRecord.create({
        data: {
          supplierRef: po.supplierRef,
          inspectionRef: ref,
          poRef: visit.poRef,
          stage: input.stage,
          result,
          critical: input.critical,
          major: input.major,
          minor: input.minor,
        },
      });

      await emit('inspection.recorded', {
        inspectionRef: ref,
        poRef: visit.poRef,
        result,
        critical: input.critical,
        major: input.major,
        minor: input.minor,
      });

      let capa = null;
      if (result === 'fail') {
        // A critical defect fails and blocks release with no override. The CAPA opens
        // automatically here; it can only be CLOSED later by a human against a passing
        // reinspection (CapaService.close).
        const capaSeq = (await tx.capa.count()) + 1;
        const capaRef = makeRef('capa', { country: COUNTRY, year: currentYear(), seq: capaSeq });
        capa = await tx.capa.create({
          data: {
            ref: capaRef,
            inspectionRef: ref,
            supplierRef: po.supplierRef,
            poRef: visit.poRef,
          },
        });
        await emit('quality.failed', {
          inspectionRef: ref,
          poRef: visit.poRef,
          supplierRef: po.supplierRef,
        });
      }

      return { inspection, capa, replayed: false as const };
    });
  }

  async read(actor: Actor, ref: string) {
    await this.authz.authorize(actor, 'inspection', 'read');
    const inspection = await this.prisma.inspection.findUnique({
      where: { ref },
      include: { evidence: true, capas: true },
    });
    if (!inspection) throw new NotFoundException(`inspection ${ref} not found`);
    return inspection;
  }

  /**
   * Quality's contribution to the release gate. A PO's goods cannot be released while any
   * CAPA against it is still open (a critical defect was found and not yet corrected +
   * closed by a human). Warehouse enforces release on the physical packages; this is the
   * quality-state check it (and any caller) asks first.
   *
   * @throws UzaError GATE_QC_NOT_RELEASED when an open CAPA blocks the PO.
   */
  async assertReleasable(actor: Actor, poRef: string): Promise<void> {
    await this.authz.authorize(actor, 'inspection', 'read');
    const openCapa = await this.prisma.capa.findFirst({
      where: { poRef, status: { not: 'closed' } },
    });
    if (openCapa) {
      throw new UzaError({
        code: 'GATE_QC_NOT_RELEASED',
        responsibleRole: 'china_sourcing',
        context: { poRef, capaRef: openCapa.ref },
      });
    }
  }
}
