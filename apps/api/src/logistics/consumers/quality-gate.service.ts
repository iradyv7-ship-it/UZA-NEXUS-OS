import { Injectable } from '@nestjs/common';
import { UzaError, type EventEnvelope } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';

const INSPECTION_CONSUMER = 'logistics.inspection-recorded';
const QUALITY_FAILED_CONSUMER = 'logistics.quality-failed';

/**
 * Locally-projected quality state per PO, built by consuming quality's `inspection.recorded`
 * and `quality.failed`. The QC-release gate reads it: a package on a PO whose latest
 * inspection failed cannot be released.
 *
 * This is the QC HALF of release. It is intentionally SEPARATE from the commercial
 * varianceHold (CF-014): a failed inspection blocks qcReleased; it says nothing about the
 * commercial hold, and vice versa.
 *
 * Both handlers are idempotent on eventId via ProcessedEvent.
 */
@Injectable()
export class QualityGateService {
  constructor(private readonly prisma: PrismaService) {}

  async handleInspectionRecorded(envelope: EventEnvelope<'inspection.recorded'>) {
    const already = await this.prisma.processedEvent.findUnique({
      where: { eventId_consumer: { eventId: envelope.eventId, consumer: INSPECTION_CONSUMER } },
    });
    if (already) return { status: 'duplicate' as const, poRef: envelope.payload.poRef };

    const { poRef, result, critical, major, minor } = envelope.payload;
    return this.prisma.$transaction(async (tx) => {
      await tx.processedEvent.create({
        data: { eventId: envelope.eventId, consumer: INSPECTION_CONSUMER },
      });
      // The latest inspection is authoritative: a pass clears a prior block, a fail sets it.
      await tx.inspectionOutcome.upsert({
        where: { poRef },
        create: { poRef, lastResult: result, releaseBlocked: result === 'fail', critical, major, minor },
        update: { lastResult: result, releaseBlocked: result === 'fail', critical, major, minor },
      });
      return { status: 'recorded' as const, poRef, result };
    });
  }

  async handleQualityFailed(envelope: EventEnvelope<'quality.failed'>) {
    const already = await this.prisma.processedEvent.findUnique({
      where: { eventId_consumer: { eventId: envelope.eventId, consumer: QUALITY_FAILED_CONSUMER } },
    });
    if (already) return { status: 'duplicate' as const, poRef: envelope.payload.poRef };

    const { poRef } = envelope.payload;
    return this.prisma.$transaction(async (tx) => {
      await tx.processedEvent.create({
        data: { eventId: envelope.eventId, consumer: QUALITY_FAILED_CONSUMER },
      });
      await tx.inspectionOutcome.upsert({
        where: { poRef },
        create: { poRef, lastResult: 'fail', releaseBlocked: true },
        update: { lastResult: 'fail', releaseBlocked: true },
      });
      return { status: 'blocked' as const, poRef };
    });
  }

  /**
   * The QC half of the release gate. Throws GATE_QC_NOT_RELEASED while any PO behind the
   * packages has an unresolved quality failure. A PO with no recorded inspection is not
   * blocked here (quality has said nothing) — the physical qcReleased flag still governs.
   */
  async assertReleasable(poRefs: readonly string[]): Promise<void> {
    const blocked = await this.prisma.inspectionOutcome.findMany({
      where: { poRef: { in: [...new Set(poRefs)] }, releaseBlocked: true },
    });
    if (blocked.length > 0) {
      throw new UzaError({
        code: 'GATE_QC_NOT_RELEASED',
        responsibleRole: 'china_warehouse',
        nextAction: 'Resolve the failed inspection / close the CAPA before releasing these packages.',
        context: { blockedPos: blocked.map((b) => b.poRef).join(', ') },
      });
    }
  }
}
